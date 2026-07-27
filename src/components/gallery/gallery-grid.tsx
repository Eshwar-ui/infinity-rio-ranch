import type { CSSProperties } from 'react'
import { Plus } from '@phosphor-icons/react'

import { cn } from '@/lib/utils'
import { SmartImage } from '@/components/ui/smart-image'
import { useLightboxStore, type LightboxItem } from '@/store/lightbox'

export type Tile = {
  label: string
  src: string
  span?: 'tall' | 'wide' | null
}

const toLightbox = (tiles: Tile[]): LightboxItem[] =>
  tiles.map((t) => ({ src: t.src, label: t.label }))

const tileBase =
  'group relative overflow-hidden rounded-[3px] border border-line shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-[transform,filter,box-shadow] duration-500 hover:brightness-110'

/**
 * Photos are real <img> elements, not CSS backgrounds: background images are
 * invisible to Google Images and to AI crawlers, and can't be lazy-loaded or
 * given alt text. `object-cover` reproduces what `bg-cover bg-center` did.
 */
const photoAlt = (label: string) => `${label} — Infinity at Rio Ranch`

type GalleryTileProps = {
  tile: Tile
  onOpen: () => void
  className?: string
  style?: CSSProperties
  /** Grid tiles and carousel cards occupy very different widths. */
  sizes?: string
}

/** A single photo tile: opens the lightbox via `onOpen`, shows a caption + plus affordance. */
export const GalleryTile = ({
  tile,
  onOpen,
  className,
  style,
  sizes = '(max-width: 768px) 50vw, 25vw',
}: GalleryTileProps) => (
  <button
    type="button"
    onClick={onOpen}
    className={cn(tileBase, 'hover:shadow-[0_14px_34px_rgba(0,0,0,0.22)]', className)}
    style={style}
  >
    <SmartImage
      src={tile.src}
      alt={photoAlt(tile.label)}
      sizes={sizes}
      className="absolute inset-0 h-full w-full object-cover"
    />
    <span className="absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.45)]" />
    <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-[rgba(10,8,6,0.88)] to-transparent p-[18px]">
      {/*
        The caption *is* the button's accessible name. An aria-label of
        "Open <label>" instead of this fails WCAG 2.5.3 (label in name), because
        the accessible name must be built from the visible text rather than
        replacing it. The sr-only suffix supplies the affordance.
      */}
      <span className="min-w-0 line-clamp-2 text-[10px] font-medium uppercase leading-snug tracking-[0.24em] text-[#f3ede2]">
        {tile.label}
        <span className="sr-only"> — open larger</span>
      </span>
      <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border border-[rgba(243,237,226,0.6)] bg-[rgba(10,8,6,0.3)] text-[#f3ede2] transition-transform duration-300 group-hover:scale-110">
        <Plus size={14} />
      </span>
    </span>
  </button>
)

type GalleryGridProps = {
  tiles: Tile[]
  rowHeight?: number
  className?: string
}

/** Dense masonry; each tile opens the lightbox over the grid's own (filtered) list. */
export const GalleryGrid = ({ tiles, rowHeight = 210, className }: GalleryGridProps) => {
  const open = useLightboxStore((s) => s.open)
  const list = toLightbox(tiles)

  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-3.5 [grid-auto-flow:dense] md:grid-cols-4',
        className,
      )}
      style={{ gridAutoRows: `${rowHeight}px` }}
    >
      {tiles.map((tile, i) => (
        <GalleryTile
          key={`${tile.label}-${i}`}
          tile={tile}
          onOpen={() => open(list, i)}
          className="hover:scale-[1.015]"
          style={{
            gridRow: tile.span === 'tall' ? 'span 2' : undefined,
            gridColumn: tile.span === 'wide' ? 'span 2' : undefined,
          }}
        />
      ))}
    </div>
  )
}

type GalleryFeaturedProps = {
  tile: Tile
  onOpen: () => void
  className?: string
}

/** A large, editorial "signature shot" — bigger caption, standalone. */
export const GalleryFeatured = ({ tile, onOpen, className }: GalleryFeaturedProps) => (
  <button
    type="button"
    onClick={onOpen}
    className={cn(
      tileBase,
      'block w-full hover:shadow-[0_26px_64px_rgba(0,0,0,0.26)]',
      className,
    )}
  >
    {/* Above the fold on /gallery — this is the page's LCP element. */}
    <SmartImage
      src={tile.src}
      alt={`${tile.label} at Infinity at Rio Ranch, a wedding and event venue in Liberty Hill, TX`}
      sizes="100vw"
      priority
      className="absolute inset-0 h-full w-full object-cover"
    />
    <span className="absolute inset-0 shadow-[inset_0_0_180px_rgba(0,0,0,0.42)]" />
    {/* aria-hidden: decorative chrome. Left visible to assistive tech it would
        become part of the button's visible label without appearing in its
        aria-label, which fails WCAG 2.5.3 (label in name). */}
    <span
      aria-hidden
      className="absolute left-4 top-4 rounded-full border border-[rgba(243,237,226,0.5)] bg-[rgba(10,8,6,0.35)] px-3.5 py-1.5 text-[10px] uppercase tracking-[0.24em] text-[#f3ede2]"
    >
      Featured
    </span>
    <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-gradient-to-t from-[rgba(10,8,6,0.85)] to-transparent p-[clamp(20px,3vw,32px)]">
      <span className="min-w-0 line-clamp-2 font-serif text-[clamp(20px,2.6vw,30px)] text-[#f3ede2]">
        {tile.label}
        <span className="sr-only"> — open larger</span>
      </span>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[rgba(243,237,226,0.6)] bg-[rgba(10,8,6,0.3)] text-[#f3ede2] transition-transform duration-300 group-hover:scale-110">
        <Plus size={18} />
      </span>
    </span>
  </button>
)
