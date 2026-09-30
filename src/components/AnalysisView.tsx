import { useMemo } from 'react'
import { Minus, Plus, RotateCcw, KeyRound, ListMusic } from 'lucide-react'
import type { AnalysisResult } from '@/lib/chordEngine'
import { chordName, NOTE_NAMES_SHARP } from '@/lib/chordEngine'
import Waveform from './Waveform'
import ChordStrip from './ChordStrip'

interface Props {
  result: AnalysisResult
  fileName: string
  currentTime: number
  transpose: number
  onTranspose: (delta: number) => void
  onResetTranspose: () => void
  onSeekTime: (t: number) => void
  onNewFile: () => void
}

function fmt(t: number): string {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function AnalysisView({
  result,
  fileName,
  currentTime,
  transpose,
  onTranspose,
  onResetTranspose,
  onSeekTime,
  onNewFile,
}: Props) {
  const currentIndex = useMemo(() => {
    let idx = -1
    for (let i = 0; i < result.segments.length; i++) {
      if (currentTime >= result.segments[i].start && currentTime < result.segments[i].end) {
        idx = i
        break
      }
    }
    return idx
  }, [currentTime, result.segments])

  const current = currentIndex >= 0 ? result.segments[currentIndex] : null
  const next = currentIndex >= 0 ? result.segments[currentIndex + 1] : null

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-40 pt-10 sm:px-6">
      {/* file header */}
      <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono-chord text-[11px] uppercase tracking-[0.25em] text-[#00ff66]/70">
            Now Analyzed
          </p>
          <h2 className="truncate text-xl font-bold text-[#d8e2ed] sm:text-2xl">{fileName}</h2>
          <p className="mt-1 text-sm text-[#d8e2ed]/40">
            {result.segments.filter((s) => s.root >= 0).length} אקורדים · {fmt(result.duration)}
            {result.key && (
              <span className="mr-3 inline-flex items-center gap-1.5 text-[#d8e2ed]/60">
                <KeyRound className="h-3.5 w-3.5 text-[#00ff66]" />
                סולם משוער:{' '}
                <span className="font-mono-chord font-bold text-[#00ff66]">
                  {NOTE_NAMES_SHARP[result.key.root]}
                  {result.key.quality === 'min' ? 'm' : ''}
                </span>
              </span>
            )}
          </p>
        </div>
        <button
          onClick={onNewFile}
          className="glass rounded-full px-5 py-2.5 text-sm font-semibold text-[#d8e2ed]/80 transition hover:bg-white/10 hover:text-[#00ff66]"
        >
          קובץ חדש
        </button>
      </div>

      {/* giant current chord */}
      <div className="mb-8 flex items-end justify-center gap-6 text-center" dir="ltr">
        <div className="w-24 text-right">
          <p className="font-mono-chord text-[10px] uppercase tracking-widest text-[#d8e2ed]/30">Prev</p>
          <p className="font-mono-chord text-2xl font-bold text-[#d8e2ed]/25 sm:text-3xl">
            {currentIndex > 0 ? chordName(result.segments[currentIndex - 1], transpose) : ''}
          </p>
        </div>
        <div>
          <p
            className={`font-mono-chord font-extrabold leading-none tracking-tight transition-colors duration-300 ${
              current && current.root >= 0 ? 'text-glow text-[#00ff66]' : 'text-[#d8e2ed]/15'
            }`}
            style={{ fontSize: 'clamp(5rem, 16vw, 11rem)' }}
          >
            {current ? chordName(current, transpose) : '—'}
          </p>
        </div>
        <div className="w-24 text-left">
          <p className="font-mono-chord text-[10px] uppercase tracking-widest text-[#d8e2ed]/30">Next</p>
          <p className="font-mono-chord text-2xl font-bold text-[#d8e2ed]/25 sm:text-3xl">
            {next ? chordName(next, transpose) : ''}
          </p>
        </div>
      </div>

      {/* transpose */}
      <div className="mb-10 flex items-center justify-center gap-3">
        <span className="text-xs text-[#d8e2ed]/40">טרנספוזיציה</span>
        <div className="glass flex items-center gap-1 rounded-full p-1">
          <button
            onClick={() => onTranspose(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#d8e2ed]/70 transition hover:bg-white/10 hover:text-[#00ff66]"
            aria-label="חצי טון למטה"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-12 text-center font-mono-chord text-sm font-bold text-[#00ff66]">
            {transpose > 0 ? `+${transpose}` : transpose}
          </span>
          <button
            onClick={() => onTranspose(1)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#d8e2ed]/70 transition hover:bg-white/10 hover:text-[#00ff66]"
            aria-label="חצי טון למעלה"
          >
            <Plus className="h-4 w-4" />
          </button>
          {transpose !== 0 && (
            <button
              onClick={onResetTranspose}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[#d8e2ed]/50 transition hover:bg-white/10"
              aria-label="איפוס"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* waveform */}
      <div className="mb-6 rounded-2xl border border-white/10 bg-black/30 p-4">
        <Waveform
          peaks={result.peaks}
          progress={result.duration > 0 ? currentTime / result.duration : 0}
          onSeek={(f) => onSeekTime(f * result.duration)}
        />
      </div>

      {/* chord strip */}
      <ChordStrip
        segments={result.segments}
        duration={result.duration}
        currentIndex={currentIndex}
        transpose={transpose}
        onSeek={onSeekTime}
      />

      {/* full chord list */}
      <div className="mt-12">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-[#d8e2ed]/50">
          <ListMusic className="h-4 w-4 text-[#00ff66]" />
          כל האקורדים לפי סדר
        </h3>
        <div className="overflow-hidden rounded-2xl border border-white/10">
          {result.segments.map((s, i) => (
            <button
              key={i}
              onClick={() => onSeekTime(s.start + 0.01)}
              className={`flex w-full items-center gap-4 border-b border-white/5 px-4 py-3 text-right transition last:border-b-0 sm:px-6 ${
                i === currentIndex ? 'bg-[#00ff66]/10' : 'hover:bg-white/[0.04]'
              }`}
            >
              <span className="w-8 text-center font-mono-chord text-xs text-[#d8e2ed]/30">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span
                className={`font-mono-chord text-lg font-bold ${
                  i === currentIndex
                    ? 'text-[#00ff66]'
                    : s.root < 0
                      ? 'text-[#d8e2ed]/25'
                      : 'text-[#d8e2ed]'
                }`}
              >
                {chordName(s, transpose)}
              </span>
              <span className="mr-auto font-mono-chord text-xs text-[#d8e2ed]/40" dir="ltr">
                {fmt(s.start)} – {fmt(s.end)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
