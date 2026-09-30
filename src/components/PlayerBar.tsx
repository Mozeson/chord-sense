import { Pause, Play, Volume2, VolumeX } from 'lucide-react'

interface Props {
  playing: boolean
  currentTime: number
  duration: number
  volume: number
  muted: boolean
  onTogglePlay: () => void
  onSeek: (t: number) => void
  onVolume: (v: number) => void
  onToggleMute: () => void
}

function fmt(t: number): string {
  if (!isFinite(t)) return '0:00'
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// Fixed glass player bar at viewport bottom
export default function PlayerBar({
  playing,
  currentTime,
  duration,
  volume,
  muted,
  onTogglePlay,
  onSeek,
  onVolume,
  onToggleMute,
}: Props) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50">
      <div className="mx-auto max-w-5xl px-4 pb-4 sm:px-6">
        <div className="glass-dark rounded-full border border-white/10 px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.5)] sm:px-6">
          <div className="flex items-center gap-3 sm:gap-5">
            {/* play button */}
            <button
              onClick={onTogglePlay}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#00ff66] text-black transition hover:shadow-[0_0_20px_rgba(0,255,102,0.5)]"
              aria-label={playing ? 'השהה' : 'נגן'}
            >
              {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
            </button>

            {/* time */}
            <span className="w-12 shrink-0 text-center font-mono-chord text-xs text-[#d8e2ed]/60" dir="ltr">
              {fmt(currentTime)}
            </span>

            {/* seek */}
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.05}
              value={currentTime}
              onChange={(e) => onSeek(parseFloat(e.target.value))}
              className="neon-range w-full"
              dir="ltr"
              aria-label="מיקום בשיר"
            />

            <span className="w-12 shrink-0 text-center font-mono-chord text-xs text-[#d8e2ed]/60" dir="ltr">
              {fmt(duration)}
            </span>

            {/* volume */}
            <div className="hidden items-center gap-2 sm:flex">
              <button
                onClick={onToggleMute}
                className="text-[#d8e2ed]/60 transition hover:text-[#00ff66]"
                aria-label={muted ? 'בטל השתקה' : 'השתק'}
              >
                {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={muted ? 0 : volume}
                onChange={(e) => onVolume(parseFloat(e.target.value))}
                className="neon-range w-20"
                dir="ltr"
                aria-label="עוצמה"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
