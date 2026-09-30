import { useCallback, useEffect, useRef, useState } from 'react'
import { AudioWaveform, AlertTriangle } from 'lucide-react'
import UploadZone from '@/components/UploadZone'
import AnalysisView from '@/components/AnalysisView'
import PlayerBar from '@/components/PlayerBar'
import { analyzeAudio, decodeToMono, type AnalysisResult, type ProgressInfo } from '@/lib/chordEngine'

type Phase = 'idle' | 'working' | 'done' | 'error'

export default function Home() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState<ProgressInfo>({ stage: 'decode', percent: 0 })
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [fileName, setFileName] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [volume, setVolume] = useState(0.9)
  const [muted, setMuted] = useState(false)
  const [transpose, setTranspose] = useState(0)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [])

  useEffect(() => cleanupAudio, [cleanupAudio])

  // keep UI clock in sync with the audio element
  useEffect(() => {
    if (!playing) return
    let raf = 0
    const tick = () => {
      if (audioRef.current) setCurrentTime(audioRef.current.currentTime)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  const handleFile = useCallback(
    async (file: File) => {
      cleanupAudio()
      setPhase('working')
      setErrorMsg('')
      setFileName(file.name)
      setTranspose(0)
      setCurrentTime(0)
      setPlaying(false)
      setProgress({ stage: 'decode', percent: 0 })

      try {
        const { samples, sampleRate } = await decodeToMono(file)
        const res = await analyzeAudio(samples, sampleRate, setProgress)
        setResult(res)

        const url = URL.createObjectURL(file)
        objectUrlRef.current = url
        const audio = new Audio(url)
        audio.volume = volume
        audio.addEventListener('ended', () => setPlaying(false))
        audioRef.current = audio

        setPhase('done')
      } catch (err) {
        console.error(err)
        setErrorMsg(
          'לא הצלחנו לנתח את הקובץ. ודאו שזהו קובץ אודיו תקין (MP3, WAV, M4A, OGG או FLAC) ונסו שוב.',
        )
        setPhase('error')
      }
    },
    [cleanupAudio, volume],
  )

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      audio.play()
      setPlaying(true)
    }
  }, [playing])

  const seek = useCallback((t: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.max(0, Math.min(t, audio.duration || t))
    setCurrentTime(audio.currentTime)
  }, [])

  const changeVolume = useCallback((v: number) => {
    setVolume(v)
    setMuted(false)
    if (audioRef.current) audioRef.current.volume = v
  }, [])

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      if (audioRef.current) audioRef.current.volume = m ? volume : 0
      return !m
    })
  }, [volume])

  const newFile = useCallback(() => {
    cleanupAudio()
    setResult(null)
    setPhase('idle')
    setPlaying(false)
    setCurrentTime(0)
  }, [cleanupAudio])

  return (
    <div className="bg-atmosphere min-h-screen">
      {/* header */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00ff66]">
            <AudioWaveform className="h-5 w-5 text-black" />
          </div>
          <div>
            <p className="text-lg font-black leading-tight text-[#d8e2ed]">גלאי אקורדים</p>
            <p className="font-mono-chord text-[10px] uppercase tracking-[0.3em] text-[#00ff66]/60">
              Chord Sense
            </p>
          </div>
        </div>
        <p className="hidden text-xs text-[#d8e2ed]/40 sm:block">
          הניתוח מתבצע במלואו בדפדפן — הקובץ לא נשלח לשום שרת
        </p>
      </header>

      {/* idle / error */}
      {(phase === 'idle' || phase === 'error') && (
        <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
          <div className="mb-14 mt-6 text-center sm:mt-12">
            <h1 className="mx-auto max-w-3xl text-5xl font-black leading-[1.05] tracking-tight text-[#d8e2ed] sm:text-7xl">
              העלו שיר.
              <br />
              <span className="text-glow text-[#00ff66]">קבלו את האקורדים.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[#d8e2ed]/50">
              גררו קובץ אודיו, ותוך שניות תקבלו את רצף האקורדים המלא — עם סנכרון לנגן,
              זיהוי סולם משוער וטרנספוזיציה בלחיצה.
            </p>
          </div>

          <UploadZone onFile={handleFile} />

          {phase === 'error' && (
            <div className="mx-auto mt-6 flex max-w-2xl items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-300">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              {errorMsg}
            </div>
          )}

          <div className="mx-auto mt-16 grid max-w-3xl grid-cols-1 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-3">
            {[
              { n: '01', t: 'מעלים קובץ', d: 'כל פורמט אודיו נפוץ, עד כמה דקות של שיר' },
              { n: '02', t: 'המנוע מנתח', d: 'פירוק תדרים בזמן אמת וזיהוי הרמוני' },
              { n: '03', t: 'מנגנים ישר', d: 'אקורדים מסונכרנים לנגן, עם טרנספוזיציה' },
            ].map((s) => (
              <div key={s.n} className="bg-[#0c0f0d] p-6">
                <p className="font-mono-chord text-xs font-bold text-[#00ff66]">{s.n}</p>
                <p className="mt-2 font-bold text-[#d8e2ed]">{s.t}</p>
                <p className="mt-1 text-sm leading-relaxed text-[#d8e2ed]/45">{s.d}</p>
              </div>
            ))}
          </div>
        </main>
      )}

      {/* working */}
      {phase === 'working' && (
        <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 text-center">
          <div className="relative mb-10 flex h-28 w-28 items-center justify-center">
            <div className="absolute inset-0 animate-ping rounded-full border border-[#00ff66]/30" />
            <div className="absolute inset-3 rounded-full border border-[#00ff66]/50" />
            <AudioWaveform className="h-10 w-10 text-[#00ff66]" />
          </div>
          <h2 className="mb-2 text-2xl font-bold text-[#d8e2ed]">מנתח את «{fileName}»…</h2>
          <p className="mb-8 text-sm text-[#d8e2ed]/45">
            {progress.stage === 'decode' && 'מפענח את קובץ האודיו'}
            {progress.stage === 'chroma' && 'מפרק את השיר לתדרים וצלילים'}
            {progress.stage === 'chords' && 'מזהה אקורדים לאורך הזמן'}
          </p>
          <div className="h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[#00ff66] shadow-[0_0_16px_rgba(0,255,102,0.6)] transition-all duration-300"
              style={{ width: `${Math.max(3, progress.percent)}%` }}
            />
          </div>
          <p className="mt-3 font-mono-chord text-xs font-bold text-[#00ff66]">
            {Math.round(progress.percent)}%
          </p>
        </main>
      )}

      {/* results */}
      {phase === 'done' && result && (
        <>
          <AnalysisView
            result={result}
            fileName={fileName}
            currentTime={currentTime}
            transpose={transpose}
            onTranspose={(d) => setTranspose((t) => Math.max(-11, Math.min(11, t + d)))}
            onResetTranspose={() => setTranspose(0)}
            onSeekTime={seek}
            onNewFile={newFile}
          />
          <PlayerBar
            playing={playing}
            currentTime={currentTime}
            duration={result.duration}
            volume={volume}
            muted={muted}
            onTogglePlay={togglePlay}
            onSeek={seek}
            onVolume={changeVolume}
            onToggleMute={toggleMute}
          />
        </>
      )}

      {/* footer */}
      {phase !== 'done' && (
        <footer className="mx-auto max-w-6xl px-4 pb-10 pt-6 text-center sm:px-6">
          <p className="font-mono-chord text-[10px] uppercase tracking-[0.3em] text-[#d8e2ed]/20">
            In-browser audio analysis · No upload · No server
          </p>
        </footer>
      )}
    </div>
  )
}
