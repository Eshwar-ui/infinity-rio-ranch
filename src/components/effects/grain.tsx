import { useAfterPaint } from '@/hooks/use-after-paint'

const GRAIN_SVG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

/**
 * Fixed film-grain overlay across the whole viewport.
 *
 * Mounted only once the browser is idle: `mix-blend-mode` on a full-viewport
 * fixed layer forces every repaint underneath it to re-blend the whole screen,
 * which is expensive precisely while the page is first painting.
 */
export const Grain = () => {
  if (!useAfterPaint()) return null

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[70] opacity-[0.055] mix-blend-overlay"
      style={{ backgroundImage: GRAIN_SVG }}
    />
  )
}
