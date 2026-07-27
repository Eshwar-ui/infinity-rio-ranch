import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { cn } from '@/lib/utils'
import { logoFor } from '@/store/theme'
import { StatList } from '@/components/ui/stat-list'
import { Button } from '@/components/ui/button'
import { SmartImage } from '@/components/ui/smart-image'
import {
  HERO_SLIDES,
  HeroBokeh,
  HeroLights,
  HeroSlideshow,
  ScrollCue,
} from '@/components/effects/hero-ambiance'

const rise = (delay: number) => ({
  animation: `riseIn 1.1s ease ${delay}s forwards`,
})

export const HomeHero = () => {
  const [slide, setSlide] = useState(0)

  useEffect(() => {
    const timer = setInterval(
      () => setSlide((s) => (s + 1) % HERO_SLIDES.length),
      5500,
    )
    return () => clearInterval(timer)
  }, [])

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <HeroSlideshow active={slide} />
      <div className="absolute inset-0 z-[1] bg-[linear-gradient(180deg,rgba(12,10,7,0.62)_0%,rgba(12,10,7,0.20)_32%,rgba(12,10,7,0.5)_64%,rgba(12,10,7,0.92)_100%)]" />
      <div className="pointer-events-none absolute inset-0 z-[2] shadow-[inset_0_0_260px_70px_rgba(8,6,4,0.6)]" />
      <HeroBokeh />
      <HeroLights />

      <div className="relative z-[5] mx-auto w-full max-w-[1260px] px-[clamp(20px,6vw,64px)] pb-[104px] pt-[132px]">
        <div className="grid grid-cols-1 items-center gap-[clamp(30px,5vw,72px)] md:grid-cols-[1.12fr_0.88fr]">
          <div className="text-left">
            <div className="mb-[26px] inline-flex items-center gap-3.5 opacity-0" style={rise(0.1)}>
              <span className="h-px w-[42px] bg-[rgba(230,207,160,0.75)]" />
              <span className="text-[11px] font-medium uppercase tracking-[0.4em] text-[#e6cfa0]">
                Austin, Texas · Wedding &amp; Event Venue
              </span>
            </div>

            <h1
              className="m-0 font-serif text-[clamp(2.9rem,6.6vw,6rem)] font-normal leading-[0.97] tracking-[0.005em] text-[#f6efe4] opacity-0 [text-shadow:0_4px_44px_rgba(0,0,0,0.5)]"
              style={rise(0.3)}
            >
              Where Endless
              <br />
              <span className="italic text-brass2">Celebrations</span> Begin
            </h1>

            <p
              className="mt-[30px] max-w-[470px] text-base font-light leading-[1.78] text-[rgba(246,239,228,0.82)] opacity-0"
              style={rise(0.5)}
            >
              Timeless charm meets modern amenities across two acres of indoor
              and outdoor space — the perfect backdrop for your most
              unforgettable moments.
            </p>

            <div
              className="mt-10 flex flex-col gap-4 opacity-0 sm:flex-row"
              style={rise(0.68)}
            >
              <Button asChild variant="brass">
                <Link to="/contact">Inquire About a Date</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="border-[rgba(243,237,226,0.35)] text-[#f3ede2] hover:border-[#e2c690] hover:text-[#e2c690]"
              >
                <Link to="/gallery">Explore the Venue</Link>
              </Button>
            </div>

            <div
              className="mt-12 max-w-[540px] border-t border-[rgba(246,239,228,0.16)] pt-[30px] opacity-0"
              style={rise(0.84)}
            >
              <StatList tone="onDark" />
            </div>
          </div>

          <div className="flex flex-col items-center gap-7">
            <SmartImage
              src={logoFor('dark')}
              alt="Infinity at Rio Ranch"
              sizes="(max-width: 1233px) 30vw, 370px"
              priority
              className="block h-auto w-[clamp(240px,30vw,370px)] opacity-0 [filter:drop-shadow(0_30px_84px_rgba(0,0,0,0.62))]"
              style={rise(0.4)}
            />
            <div className="flex items-center gap-1 opacity-0" style={rise(0.72)}>
              {HERO_SLIDES.map((src, i) => (
                // The button itself is a 24px WCAG 2.5.8 target; the visible dot
                // is the span inside it. A small button with an oversized
                // ::before hit area fails instead on *spacing*, because the
                // neighbouring targets then overlap.
                <button
                  key={src}
                  type="button"
                  onClick={() => setSlide(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  className="flex h-6 w-6 items-center justify-center"
                >
                  <span
                    className={cn(
                      'block h-2 rounded-[20px] transition-all',
                      i === slide ? 'w-6 bg-brass2' : 'w-2 bg-[rgba(246,239,228,0.42)]',
                    )}
                    style={{ transitionDuration: '450ms' }}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <ScrollCue />
    </section>
  )
}
