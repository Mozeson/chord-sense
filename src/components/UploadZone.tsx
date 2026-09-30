import { useCallback, useRef, useState } from 'react'
import { Music, UploadCloud } from 'lucide-react'

interface Props {
  onFile: (file: File) => void
}

const ACCEPT = 'audio/*,.mp3,.wav,.m4a,.ogg,.flac,.aac,.opus,.webm'

export default function UploadZone({ onFile }: Props) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files?.[0]
      if (file) onFile(file)
    },
    [onFile],
  )

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      className={`group relative mx-auto w-full max-w-2xl cursor-pointer rounded-3xl border-2 border-dashed px-8 py-16 text-center transition-all duration-300 sm:py-24 ${
        dragging
          ? 'border-[#00ff66] bg-[#00ff66]/10 shadow-[0_0_60px_rgba(0,255,102,0.15)]'
          : 'border-white/15 glass hover:border-[#00ff66]/50 hover:bg-[#00ff66]/5'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          e.target.value = ''
        }}
      />

      {/* spinning vinyl icon */}
      <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-black/40 transition-transform duration-500 group-hover:scale-105">
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-[#00ff66]/40">
          <div className="absolute h-10 w-10 rounded-full border border-white/10" />
          <div className="absolute h-2 w-2 rounded-full bg-[#00ff66]" />
          <Music className="absolute h-5 w-5 text-[#d8e2ed]/0" strokeWidth={1.5} />
        </div>
      </div>

      <p className="mb-2 text-2xl font-bold text-[#d8e2ed] sm:text-3xl">
        גררו לכאן שיר או קובץ סאונד
      </p>
      <p className="mb-8 text-base text-[#d8e2ed]/50">או לחצו לבחירת קובץ מהמחשב</p>

      <span className="inline-flex items-center gap-2 rounded-full bg-[#00ff66] px-8 py-3 text-sm font-bold text-black transition-all duration-300 group-hover:shadow-[0_0_30px_rgba(0,255,102,0.4)]">
        <UploadCloud className="h-4 w-4" />
        בחירת קובץ
      </span>

      <p className="mt-8 font-mono-chord text-xs tracking-widest text-[#d8e2ed]/30">
        MP3 · WAV · M4A · OGG · FLAC
      </p>
    </div>
  )
}
