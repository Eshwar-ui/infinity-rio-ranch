import { useEffect } from 'react'
import { CaretLeft, CaretRight, X } from '@phosphor-icons/react'

import { useLightboxStore } from '@/store/lightbox'

export const Lightbox = () => {
  const items = useLightboxStore((s) => s.items)
  const index = useLightboxStore((s) => s.index)
  const close = useLightboxStore((s) => s.close)
  const next = useLightboxStore((s) => s.next)
  const prev = useLightboxStore((s) => s.prev)

  useEffect(() => {
    if (index === null) return

    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [index, close, next, prev])

  if (index === null) return null
  const item = items[index]
  if (!item) return null

  return (
    <div
      onClick={close}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(8,6,4,0.94)] p-[clamp(20px,5vw,70px)] backdrop-blur-[4px]"
      role="dialog"
      aria-modal="true"
      aria-label={item.label}
    >
      <button
        type="button"
        onClick={close}
        aria-label="Close"
        className="absolute right-6 top-6 z-[3] flex h-[50px] w-[50px] items-center justify-center rounded-full border border-[rgba(243,237,226,0.3)] text-[#f3ede2] transition-all duration-300 ease-out hover:scale-110 hover:rotate-90 hover:border-[#e2c690] hover:text-[#e2c690] active:scale-90 active:duration-150"
      >
        <X size={24} />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          prev()
        }}
        aria-label="Previous"
        className="absolute left-[clamp(12px,3vw,40px)] top-1/2 z-[3] flex h-[54px] w-[54px] -translate-y-1/2 items-center justify-center rounded-full border border-[rgba(243,237,226,0.3)] text-[#f3ede2] transition-all duration-300 ease-out hover:-translate-x-1 hover:scale-110 hover:border-[#e2c690] hover:text-[#e2c690] active:scale-90 active:duration-150"
      >
        <CaretLeft size={22} />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          next()
        }}
        aria-label="Next"
        className="absolute right-[clamp(12px,3vw,40px)] top-1/2 z-[3] flex h-[54px] w-[54px] -translate-y-1/2 items-center justify-center rounded-full border border-[rgba(243,237,226,0.3)] text-[#f3ede2] transition-all duration-300 ease-out hover:translate-x-1 hover:scale-110 hover:border-[#e2c690] hover:text-[#e2c690] active:scale-90 active:duration-150"
      >
        <CaretRight size={22} />
      </button>

      <div onClick={(e) => e.stopPropagation()} className="w-[min(1000px,86vw)] max-w-full">
        <div
          className="aspect-[16/10] w-full rounded-[3px] bg-cover bg-center shadow-[0_40px_120px_rgba(0,0,0,0.7)]"
          style={{ backgroundImage: `url(${item.src})` }}
        />
        <div className="mt-5 flex items-center justify-between">
          <span className="font-serif text-[22px] text-[#f3ede2]">{item.label}</span>
          <span className="text-xs tracking-[0.2em] text-[rgba(243,237,226,0.6)]">
            {index + 1} / {items.length}
          </span>
        </div>
      </div>
    </div>
  )
}
