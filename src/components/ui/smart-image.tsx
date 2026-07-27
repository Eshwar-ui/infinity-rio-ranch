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
 * not beat mozjpeg here. See scripts/optimize-images.mjs for the measurements.
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
  /** True when the WebP ladder reaches full width and can fully replace the PNG. */
  full?: boolean
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
}

export const SmartImage = ({
  src,
  alt,
  sizes = '100vw',
  className,
  style,
  priority = false,
}: SmartImageProps) => {
  const entry = SOURCES[src]
  const base = entry?.base

  const loading = priority ? 'eager' : 'lazy'
  const fetchPriority = priority ? 'high' : undefined

  // Same-format ladder: the original file is always the full-width candidate.
  const sameExt = entry?.jpg ? 'jpg' : entry?.png ? 'png' : null
  const sameWidths = entry?.jpg ?? entry?.png
  const sameSrcSet =
    sameExt && sameWidths && entry?.w
      ? [...sameWidths.map((w) => `${base}-${w}.${sameExt} ${w}w`), `${src} ${entry.w}w`].join(', ')
      : undefined

  const img = (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      loading={loading}
      decoding="async"
      fetchPriority={fetchPriority}
      srcSet={sameSrcSet}
      sizes={sameSrcSet ? sizes : undefined}
    />
  )

  // Only offer WebP when the ladder covers full width — otherwise a large slot
  // would pick the biggest WebP available and upscale it.
  if (!entry?.webp?.length || !entry.full) return img

  return (
    <picture>
      <source
        type="image/webp"
        srcSet={entry.webp.map((w) => `${base}-${w}.webp ${w}w`).join(', ')}
        sizes={sizes}
      />
      {img}
    </picture>
  )
}
