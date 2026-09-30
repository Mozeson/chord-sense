// Chord detection engine — runs fully in the browser.
// Pipeline: decode → mono resample → STFT → chroma (HPCP) →
// windowed smoothing → template matching (Pearson) → merge → key estimate.

import FFT from 'fft.js'

export interface ChordSegment {
  start: number // seconds
  end: number // seconds
  root: number // 0-11, -1 = no chord
  quality: 'maj' | 'min' | 'none'
}

export interface AnalysisResult {
  segments: ChordSegment[]
  duration: number
  sampleRate: number
  peaks: Float32Array // waveform peaks for drawing
  key: { root: number; quality: 'maj' | 'min'; confidence: number } | null
}

export const NOTE_NAMES_SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']

export function chordName(seg: { root: number; quality: string }, transpose = 0): string {
  if (seg.root < 0 || seg.quality === 'none') return '—'
  const r = ((seg.root + transpose) % 12 + 12) % 12
  return NOTE_NAMES_SHARP[r] + (seg.quality === 'min' ? 'm' : '')
}

// ---------- Decode & preprocess ----------

const TARGET_SR = 22050

export async function decodeToMono(file: File): Promise<{ samples: Float32Array; sampleRate: number }> {
  const arrayBuffer = await file.arrayBuffer()
  const ctx = new OfflineAudioContext(1, 1, TARGET_SR)
  const decoded = await ctx.decodeAudioData(arrayBuffer)
  const length = Math.ceil(decoded.duration * TARGET_SR)
  const off = new OfflineAudioContext(1, length, TARGET_SR)
  const src = off.createBufferSource()
  src.buffer = decoded
  src.connect(off.destination)
  src.start(0)
  const rendered = await off.startRendering()
  return { samples: rendered.getChannelData(0), sampleRate: TARGET_SR }
}

// ---------- DSP ----------

const FFT_SIZE = 8192
const HOP = 2048

function hannWindow(n: number): Float32Array {
  const w = new Float32Array(n)
  for (let i = 0; i < n; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)))
  return w
}

// Precompute bin → pitch-class mapping weights
function buildChromaMap(sr: number): { pc: number; bin: number }[] {
  const map: { pc: number; bin: number }[] = []
  const binHz = sr / FFT_SIZE
  const minBin = Math.max(1, Math.floor(55 / binHz)) // ~A1
  const maxBin = Math.min(FFT_SIZE / 2 - 1, Math.ceil(3520 / binHz)) // ~A7
  for (let b = minBin; b <= maxBin; b++) {
    const f = b * binHz
    const midi = 69 + 12 * Math.log2(f / 440)
    const pc = ((Math.round(midi) % 12) + 12) % 12
    map.push({ pc, bin: b })
  }
  return map
}

// Chord templates: [root..], binary triads
function buildTemplates(): { root: number; quality: 'maj' | 'min'; vec: number[] }[] {
  const templates: { root: number; quality: 'maj' | 'min'; vec: number[] }[] = []
  for (let root = 0; root < 12; root++) {
    const maj = new Array(12).fill(0)
    maj[root] = 1
    maj[(root + 4) % 12] = 1
    maj[(root + 7) % 12] = 1
    templates.push({ root, quality: 'maj', vec: maj })
    const min = new Array(12).fill(0)
    min[root] = 1
    min[(root + 3) % 12] = 1
    min[(root + 7) % 12] = 1
    templates.push({ root, quality: 'min', vec: min })
  }
  return templates
}

function pearson(a: number[] | Float32Array, b: number[]): number {
  let sa = 0, sb = 0
  const n = a.length
  for (let i = 0; i < n; i++) { sa += a[i]; sb += b[i] }
  const ma = sa / n, mb = sb / n
  let num = 0, da = 0, db = 0
  for (let i = 0; i < n; i++) {
    const xa = a[i] - ma, xb = b[i] - mb
    num += xa * xb
    da += xa * xa
    db += xb * xb
  }
  const den = Math.sqrt(da * db)
  return den === 0 ? 0 : num / den
}

// Krumhansl–Schmuckler key profiles
const KS_MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const KS_MIN = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

function rotate(arr: number[], k: number): number[] {
  return arr.map((_, i) => arr[(i + k) % 12])
}

export interface ProgressInfo {
  stage: 'decode' | 'chroma' | 'chords'
  percent: number // 0-100
}

export async function analyzeAudio(
  samples: Float32Array,
  sampleRate: number,
  onProgress?: (p: ProgressInfo) => void,
): Promise<AnalysisResult> {
  const duration = samples.length / sampleRate
  const fft = new FFT(FFT_SIZE)
  const window = hannWindow(FFT_SIZE)
  const chromaMap = buildChromaMap(sampleRate)
  const templates = buildTemplates()

  const frameCount = Math.max(1, Math.floor((samples.length - FFT_SIZE) / HOP) + 1)
  const chromas: Float32Array[] = new Array(frameCount)
  const frameEnergy = new Float32Array(frameCount)

  const input = new Float32Array(FFT_SIZE)
  const spectrum = fft.createComplexArray()

  const yieldEvery = 40
  for (let f = 0; f < frameCount; f++) {
    const offset = f * HOP
    input.fill(0)
    for (let i = 0; i < FFT_SIZE; i++) input[i] = samples[offset + i] * window[i]
    fft.realTransform(spectrum, input)
    fft.completeSpectrum(spectrum)

    const chroma = new Float32Array(12)
    for (const { pc, bin } of chromaMap) {
      const re = spectrum[2 * bin]
      const im = spectrum[2 * bin + 1]
      chroma[pc] += Math.sqrt(re * re + im * im)
    }
    // log compression
    let total = 0
    for (let i = 0; i < 12; i++) {
      chroma[i] = Math.log1p(100 * chroma[i])
      total += chroma[i]
    }
    chromas[f] = chroma
    frameEnergy[f] = total

    if (onProgress && f % yieldEvery === 0) {
      onProgress({ stage: 'chroma', percent: (f / frameCount) * 70 })
      await new Promise((r) => setTimeout(r, 0))
    }
  }

  // median energy for silence detection
  const sortedEnergy = Array.from(frameEnergy).sort((a, b) => a - b)
  const medianEnergy = sortedEnergy[Math.floor(sortedEnergy.length / 2)] || 0

  // ---- Windowed chord estimation ----
  // frames per analysis block: ~0.74s window, 50% overlap → ~0.37s resolution
  const WIN = 8
  const STEP = 4
  const frameDur = HOP / sampleRate
  type Raw = { time: number; root: number; quality: 'maj' | 'min' | 'none' }
  const raw: Raw[] = []

  const nBlocks = Math.max(1, Math.floor((frameCount - WIN) / STEP) + 1)
  for (let b = 0; b < nBlocks; b++) {
    const start = b * STEP
    const avg = new Float32Array(12)
    let energy = 0
    for (let i = 0; i < WIN && start + i < frameCount; i++) {
      const c = chromas[start + i]
      for (let p = 0; p < 12; p++) avg[p] += c[p]
      energy += frameEnergy[start + i]
    }

    let root = -1
    let quality: 'maj' | 'min' | 'none' = 'none'

    if (energy / WIN > medianEnergy * 0.35) {
      let best = -Infinity
      let bestRoot = -1
      let bestQ: 'maj' | 'min' = 'maj'
      for (const t of templates) {
        const s = pearson(avg, t.vec)
        if (s > best) {
          best = s
          bestRoot = t.root
          bestQ = t.quality
        }
      }
      if (best > 0.35) {
        root = bestRoot
        quality = bestQ
      }
    }
    raw.push({ time: start * frameDur, root, quality })

    if (onProgress && b % 30 === 0) {
      onProgress({ stage: 'chords', percent: 70 + (b / nBlocks) * 30 })
      await new Promise((r) => setTimeout(r, 0))
    }
  }

  // ---- Merge consecutive identical chords ----
  let segments: ChordSegment[] = []
  for (const r of raw) {
    const last = segments[segments.length - 1]
    if (last && last.root === r.root && last.quality === r.quality) {
      last.end = r.time + WIN * frameDur
    } else {
      segments.push({ start: r.time, end: r.time + WIN * frameDur, root: r.root, quality: r.quality })
    }
  }

  // ---- Remove very short segments (<0.45s) by merging into the longer neighbour ----
  const MIN_DUR = 0.45
  let changed = true
  while (changed) {
    changed = false
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i]
      if (s.end - s.start < MIN_DUR && segments.length > 1) {
        // merge into previous if exists, else next
        if (i > 0) {
          segments[i - 1].end = s.end
          segments.splice(i, 1)
        } else {
          segments[1].start = s.start
          segments.splice(0, 1)
        }
        changed = true
        break
      }
    }
  }
  // clamp to duration
  for (const s of segments) {
    s.end = Math.min(s.end, duration)
  }

  // ---- Key estimate from average chroma ----
  const avgChroma = new Float32Array(12)
  for (let f = 0; f < frameCount; f++) {
    if (frameEnergy[f] > medianEnergy * 0.35) {
      for (let p = 0; p < 12; p++) avgChroma[p] += chromas[f][p]
    }
  }
  let key: AnalysisResult['key'] = null
  let bestKey = -Infinity
  for (let k = 0; k < 12; k++) {
    const sm = pearson(avgChroma, rotate(KS_MAJ, k))
    if (sm > bestKey) { bestKey = sm; key = { root: k, quality: 'maj', confidence: sm } }
    const sn = pearson(avgChroma, rotate(KS_MIN, k))
    if (sn > bestKey) { bestKey = sn; key = { root: k, quality: 'min', confidence: sn } }
  }

  // ---- Waveform peaks (for drawing) ----
  const N_PEAKS = 1200
  const peaks = new Float32Array(N_PEAKS)
  const per = samples.length / N_PEAKS
  for (let i = 0; i < N_PEAKS; i++) {
    let peak = 0
    const start = Math.floor(i * per)
    const end = Math.min(samples.length, Math.floor((i + 1) * per))
    for (let j = start; j < end; j += 8) {
      const v = Math.abs(samples[j])
      if (v > peak) peak = v
    }
    peaks[i] = peak
  }

  onProgress?.({ stage: 'chords', percent: 100 })
  return { segments, duration, sampleRate, peaks, key }
}
