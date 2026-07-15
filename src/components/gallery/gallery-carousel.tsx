import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight } from '@phosphor-icons/react'

import { cn } from '@/lib/utils'
import { GalleryTile, type Tile } from '@/components/gallery/gallery-grid'
import { useLightboxStore } from '@/store/lightbox'

/** Horizontal snap-scroll row of square photos, with dot + arrow nav (native CSS scroll-snap, no carousel lib). */
export const GalleryCarousel = ({ tiles }: { tiles: Tile[] }) => {
  const open = useLightboxStore((s) => s.open)
  const list = tiles.map((t) => ({ src: t.src, label: t.label }))
  const trackRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  const step = () => {
    const card = trackRef.current?.firstElementChild as HTMLElement | null
    return (card?.offsetWidth ?? 320) + 14
  }

  const advance = (dir: 1 | -1) => {
    const el = trackRef.current
    if (!el) return
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4
    if (dir === 1 && atEnd) {
      el.scrollTo({ left: 0, behavior: 'smooth' })
    } else {
      el.scrollBy({ left: dir * step(), behavior: 'smooth' })
    }
  }

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const onScroll = () => setActive(Math.round(el.scrollLeft / step()))
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // Auto-advance every 4s; pauses while the pointer is over the carousel.
  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    let paused = false
    const timer = setInterval(() => !paused && advance(1), 4000)
    const pause = () => (paused = true)
    const resume = () => (paused = false)
    el.addEventListener('mouseenter', pause)
    el.addEventListener('mouseleave', resume)
    return () => {
      clearInterval(timer)
      el.removeEventListener('mouseenter', pause)
      el.removeEventListener('mouseleave', resume)
    }
  }, [])

  return (
    <div>
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-3.5 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tiles.map((tile, i) => (
          <GalleryTile
            key={`${tile.label}-${i}`}
            tile={tile}
            onOpen={() => open(list, i)}
            className="aspect-square w-[clamp(220px,32vw,380px)] shrink-0 snap-start"
          />
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {tiles.map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                i === active ? 'w-5 bg-brass2' : 'w-1.5 bg-line',
              )}
            />
          ))}
        </div>
        <div className="flex gap-2.5">
          <button
            type="button"
            aria-label="Previous photo"
            onClick={() => advance(-1)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-cream transition-colors duration-300 hover:border-brass hover:text-brass2"
          >
            <ArrowLeft size={18} />
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={() => advance(1)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-cream transition-colors duration-300 hover:border-brass hover:text-brass2"
          >
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
