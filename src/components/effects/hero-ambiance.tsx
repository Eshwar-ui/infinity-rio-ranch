import { useAfterPaint } from '@/hooks/use-after-paint'
import { useParallax } from '@/hooks/use-parallax'
import { SmartImage } from '@/components/ui/smart-image'

export const HERO_SLIDES = [
  '/assets/site/DSC3699-2.jpg',
  '/assets/site/DSC3669-2.jpg',
  '/assets/site/arch.png',
]

/**
 * Cross-fading, Ken-Burns hero background with a parallax layer.
 *
 * Only the first slide is mounted on load. The other two used to be
 * background-images on always-present divs, so all three downloaded during the
 * initial page load — 964 kB for one visible photo. They now mount once the
 * browser is idle (and always before the 5.5 s first transition), which keeps
 * ~520 kB off the critical path without changing what the visitor sees.
 */
export const HeroSlideshow = ({ active }: { active: number }) => {
  const parallaxRef = useParallax<HTMLDivElement>(0.16)
  const mountRest = useAfterPaint(3000)
  /*
   * Ken Burns is held back separately, and it matters more than it looks: this
   * animation runs on the direct parent of the LCP element. Starting an
   * infinite `transform` animation on the first frame means the browser is
   * compositing and recalculating style for the hero before it has even painted
   * it once. Measured on mobile: LCP was 5.2 s with 4557 ms of *render delay*
   * against only 189 ms of image load time — the photo was long since
   * downloaded and simply couldn't get painted.
   */
  const animate = useAfterPaint()

  return (
    <div
      ref={parallaxRef}
      className="absolute inset-x-0 -top-[10%] bottom-0 z-0"
      style={{ background: 'var(--hero-bg)' }}
    >
      <div className="absolute inset-0 overflow-hidden">
        {/* `i === active` keeps the dots working for reduced-motion visitors,
            for whom useAfterPaint never flips and the hero stays static. */}
        {HERO_SLIDES.map((src, i) =>
          i === 0 || i === active || mountRest ? (
            <div
              key={src}
              className="absolute inset-0"
              style={{
                opacity: i === active ? 1 : 0,
                transition: 'opacity 1.7s ease',
                ...(animate
                  ? { animation: `kenburns ${17 + i * 2}s ease-in-out infinite alternate` }
                  : null),
              }}
            >
              <SmartImage
                src={src}
                alt=""
                sizes="100vw"
                priority={i === 0}
                /* Capped: this photo sits under a 0.62→0.92 gradient and an
                   inset shadow, and it is the LCP element on every phone. A
                   1600w original is 442 kB of a picture nobody can quite see;
                   the 960w step is 161 kB of the same picture. */
                maxWidth={960}
                className="h-full w-full object-cover"
              />
            </div>
          ) : null,
        )}
      </div>
    </div>
  )
}

/** Soft floating light orbs. Deferred — 9 blurred, continuously-animating layers. */
export const HeroBokeh = () => {
  if (!useAfterPaint()) return null

  return (
  <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
    {Array.from({ length: 9 }, (_, i) => {
      const left = (i * 11 + 5) % 100
      const top = (i * 23 + 15) % 78
      const size = 44 + (i % 4) * 30
      return (
        <span
          key={i}
          className="absolute rounded-full blur-[6px]"
          style={{
            left: `${left}%`,
            top: `${top}%`,
            width: size,
            height: size,
            background:
              'radial-gradient(circle, rgba(240,200,130,.18), transparent 70%)',
            animation: `floatY ${8 + (i % 5)}s ease-in-out ${i * 0.5}s infinite`,
          }}
        />
      )
    })}
  </div>
  )
}

/**
 * Twinkling brass points along the top of the hero. Deferred — 22 elements
 * animating scale under a `box-shadow` glow repaint that glow every frame.
 */
export const HeroLights = () => {
  if (!useAfterPaint()) return null

  return (
  <div className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-[42%]">
    {Array.from({ length: 22 }, (_, i) => {
      const left = ((i + 0.5) / 22) * 100
      const top = Math.abs(Math.sin(i * 1.7)) * 16 + 6
      const size = i % 4 === 0 ? 4 : 2.5
      return (
        <span
          key={i}
          className="absolute rounded-full bg-brass2"
          style={{
            left: `${left}%`,
            top: `${top}%`,
            width: size,
            height: size,
            boxShadow: '0 0 9px 2px rgba(226,198,144,.7)',
            animation: `twinkle ${2 + (i % 3)}s ease-in-out ${(i * 0.31) % 3}s infinite`,
          }}
        />
      )
    })}
  </div>
  )
}

/** Bottom-right scroll indicator. */
export const ScrollCue = () => (
  <div className="hide-sm absolute bottom-[30px] right-[clamp(20px,5vw,54px)] z-[6] hidden flex-col items-center gap-2.5 md:flex">
    <span className="text-[9px] uppercase tracking-[0.32em] text-cream/55">
      Scroll
    </span>
    <span className="relative h-9 w-px overflow-hidden bg-cream/25">
      <span className="absolute left-0 top-0 h-3 w-px animate-scrolldot bg-brass2" />
    </span>
  </div>
)
