import { useEffect, useRef } from 'react'

interface Props {
  peaks: Float32Array
  progress: number // 0..1
  onSeek: (fraction: number) => void
}

// Canvas waveform with played/unplayed split and click-to-seek
export default function Waveform({ peaks, progress, onSeek }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return

    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const w = wrap.clientWidth
      const h = wrap.clientHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, w, h)

      const n = peaks.length
      const mid = h / 2
      const barW = w / n
      const playedX = progress * w

      for (let i = 0; i < n; i++) {
        const x = i * barW
        const amp = Math.max(0.04, peaks[i])
        const bh = amp * (h * 0.9)
        const played = x < playedX
        ctx.fillStyle = played ? '#00ff66' : 'rgba(216,226,237,0.22)'
        ctx.fillRect(x, mid - bh / 2, Math.max(1, barW - 1), bh)
      }

      // playhead
      ctx.fillStyle = '#00ff66'
      ctx.fillRect(playedX - 1, 0, 2, h)
    }

    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [peaks, progress])

  return (
    <div
      ref={wrapRef}
      className="relative h-24 w-full cursor-pointer sm:h-32"
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        onSeek((e.clientX - rect.left) / rect.width)
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  )
}
