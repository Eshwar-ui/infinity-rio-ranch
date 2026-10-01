import type { CSSProperties } from 'react'

import imageSources from '@/lib/image-sources.json'

/**
 * Serves the responsive ladder built by `npm run optimize:images`, falling back
 * to a plain <img> for anything the manifest doesn't know — CMS uploads pointing
 * at Supabase Storage, or images added since the last optimiser run. That
 * fallback is why this is safe to use everywhere: an unknown src still renders,
 * it just doesn't get a srcset.
 *
 * PNG sources are served as WebP through <picture> (measured −77% on this photo
 * set); JPEG sources stay JPEG and only gain smaller widths, because WebP does
 * not beat mozjpeg here. AVIF does, so where a photo has an AVIF ladder it goes
 * first in the <picture> and the JPEG/WebP behind it is only the fallback. See
 * scripts/optimize-images.mjs for the measurements.
 */

type Entry = {
  /** Public path prefix of the generated files, e.g. `/assets/_r/site/wed`. */
  base: string
  /** WebP ladder widths (PNG sources where WebP wins). */
  webp?: number[]
  /** Extra same-format widths below the original. */
  jpg?: number[]
  png?: number[]
  /** Intrinsic width of the original file. */
  w?: number
  /** Intrinsic height, so the box can be reserved before the bytes arrive. */
  h?: number
  /** True when the WebP ladder reaches full width and can fully replace the PNG. */
  full?: boolean
  /** AVIF ladder, offered ahead of everything else (~35% smaller than mozjpeg here). */
  avif?: number[]
}

const SOURCES = imageSources as Record<string, Entry>

type SmartImageProps = {
  src: string
  alt: string
  /** Layout hint for srcset selection. Get this right — a wrong `sizes` is worse than none. */
  sizes?: string
  className?: string
  style?: CSSProperties
  /** Above the fold: load eagerly at high priority instead of lazily. */
  priority?: boolean
  /**
   * Largest candidate to offer, for full-bleed art where an upscale is invisible.
   *
   * `sizes` describes the slot and must stay truthful, so the only honest way to
   * stop a phone pulling a 1600px file for a photo it will show under a
   * near-opaque gradient is to not offer one. The hero is the whole argument:
   * at 412 CSS px and DPR 2.6 the browser asked for the 1600w original — 442 kB
   * on the LCP element over a throttled connection — where the 960w step is
   * 161 kB and, behind a 0.62→0.92 wash, indistinguishable.
   *
   * Only for art direction of that kind. A photo the visitor is meant to *look*
   * at keeps its full ladder.
   */
  maxWidth?: number
}

export const SmartImage = ({
  src,
  alt,
  sizes = '100vw',
  className,
  style,
  priority = false,
  maxWidth,
}: SmartImageProps) => {
  const entry = SOURCES[src]
  const base = entry?.base

  const loading = priority ? 'eager' : 'lazy'
  const fetchPriority = priority ? 'high' : undefined

  const cap = maxWidth ?? Number.POSITIVE_INFINITY
  const within = (widths?: number[]) => widths?.filter((w) => w <= cap)

  // Same-format ladder: the original file is the full-width candidate, unless a
  // cap says it is more bytes than the slot is worth.
  const sameExt = entry?.jpg ? 'jpg' : entry?.png ? 'png' : null
  const sameWidths = within(entry?.jpg ?? entry?.png)
  const offerOriginal = entry?.w !== undefined && entry.w <= cap
  const sameCandidates =
    sameExt && sameWidths
      ? [
          ...sameWidths.map((w) => `${base}-${w}.${sameExt} ${w}w`),
          ...(offerOriginal ? [`${src} ${entry.w}w`] : []),
        ]
      : []
  const sameSrcSet = sameCandidates.length > 0 ? sameCandidates.join(', ') : undefined

  /*
   * Intrinsic dimensions, so the browser can reserve the box from the aspect
   * ratio before a single byte of the photo arrives. Every layout here sizes
   * images with CSS (`h-full w-full object-cover`, `h-[62px] w-auto`), which
   * still wins over these attributes — they exist only to stop the reflow, and
   * a page of unsized photos is a page that jumps as it loads.
   */
  const intrinsic = entry?.w && entry.h ? { width: entry.w, height: entry.h } : {}

  const img = (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      loading={loading}
      /* Async decode lets the browser paint the text first and the photo a few
         frames later — measured ~280 ms after FCP on the homepage hero, which is
         the LCP element. A priority image is the reason the page was opened;
         it belongs in the first frame. */
      decoding={priority ? 'sync' : 'async'}
      fetchPriority={fetchPriority}
      srcSet={sameSrcSet}
      sizes={sameSrcSet ? sizes : undefined}
      {...intrinsic}
    />
  )

  // Only offer WebP when the ladder covers everything we are willing to serve —
  // otherwise a large slot picks the biggest WebP available and upscales it.
  // With a cap, "everything" is the cap rather than the source's own width.
  // The same rule decides AVIF.
  const covers = (widths?: number[]) =>
    widths?.length ? widths.at(-1)! >= Math.min(cap, entry?.w ?? cap) : false
  const ladder = (widths: number[], ext: string) =>
    widths.map((w) => `${base}-${w}.${ext} ${w}w`).join(', ')

  const webpWidths = within(entry?.webp)
  const webpCovers = Boolean(entry?.full) && covers(webpWidths)
  const avifWidths = within(entry?.avif)
  const avifCovers = covers(avifWidths)
  if (!webpCovers && !avifCovers) return img

  return (
    <picture>
      {avifCovers && <source type="image/avif" srcSet={ladder(avifWidths!, 'avif')} sizes={sizes} />}
      {webpCovers && <source type="image/webp" srcSet={ladder(webpWidths!, 'webp')} sizes={sizes} />}
      {img}
    </picture>
  )
}
