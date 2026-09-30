import { useEffect, useRef } from 'react'
import type { ChordSegment } from '@/lib/chordEngine'
import { chordName } from '@/lib/chordEngine'

interface Props {
  segments: ChordSegment[]
  duration: number
  currentIndex: number
  transpose: number
  onSeek: (time: number) => void
}

// Horizontal chord strip — blocks sized by duration, auto-scrolls to current chord
export default function ChordStrip({ segments, duration, currentIndex, transpose, onSeek }: Props) {
  const activeRef = useRef<HTMLButtonElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = activeRef.current
    const scroller = scrollRef.current
    if (!el || !scroller) return
    const target = el.offsetLeft - scroller.clientWidth / 2 + el.clientWidth / 2
    scroller.scrollTo({ left: target, behavior: 'smooth' })
  }, [currentIndex])

  return (
    <div
      ref={scrollRef}
      dir="ltr"
      className="strip-scroll flex w-full items-stretch gap-[2px] overflow-x-auto rounded-2xl border border-white/10 bg-black/30 p-[3px]"
    >
      {segments.map((s, i) => {
        const wPct = Math.max(((s.end - s.start) / duration) * 100, 3.5)
        const active = i === currentIndex
        const isNone = s.root < 0
        return (
          <button
            key={i}
            ref={active ? activeRef : undefined}
            onClick={() => onSeek(s.start + 0.01)}
            style={{ width: `${wPct}%`, minWidth: 56 }}
            className={`flex shrink-0 items-center justify-center rounded-xl py-4 font-mono-chord text-base font-bold transition-all duration-200 sm:py-5 sm:text-lg ${
              active
                ? 'chord-active bg-[#00ff66] text-black shadow-[0_0_24px_rgba(0,255,102,0.45)]'
                : isNone
                  ? 'bg-white/[0.03] text-[#d8e2ed]/25 hover:bg-white/[0.07]'
                  : 'glass text-[#d8e2ed]/80 hover:bg-white/10 hover:text-[#00ff66]'
            }`}
          >
            {chordName(s, transpose)}
          </button>
        )
      })}
    </div>
  )
}
