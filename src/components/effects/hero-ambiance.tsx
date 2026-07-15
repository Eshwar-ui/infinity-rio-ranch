import { useParallax } from '@/hooks/use-parallax'

export const HERO_SLIDES = [
  '/assets/site/DSC3699-2.jpg',
  '/assets/site/DSC3669-2.jpg',
  '/assets/site/arch.png',
]

/** Cross-fading, Ken-Burns hero background with a parallax layer. */
export const HeroSlideshow = ({ active }: { active: number }) => {
  const parallaxRef = useParallax<HTMLDivElement>(0.16)

  return (
    <div
      ref={parallaxRef}
      className="absolute inset-x-0 -top-[10%] bottom-0 z-0"
      style={{ background: 'var(--hero-bg)' }}
    >
      <div className="absolute inset-0 overflow-hidden">
        {HERO_SLIDES.map((src, i) => (
          <div
            key={src}
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${src})`,
              opacity: i === active ? 1 : 0,
              transition: 'opacity 1.7s ease',
              animation: `kenburns ${17 + i * 2}s ease-in-out infinite alternate`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

/** Soft floating light orbs. */
export const HeroBokeh = () => (
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

/** Twinkling brass points along the top of the hero. */
export const HeroLights = () => (
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
