import { Link } from 'react-router-dom'

import { useEvents, useGallery } from '@/hooks/use-site-content'
import { Button } from '@/components/ui/button'
import { SectionHeading } from '@/components/ui/section-heading'
import { StatList } from '@/components/ui/stat-list'
import { Reveal } from '@/components/effects/reveal'
import { useParallax } from '@/hooks/use-parallax'
import { useAfterPaint } from '@/hooks/use-after-paint'
import { GalleryCarousel } from '@/components/gallery/gallery-carousel'
import { HomeHero } from '@/components/sections/home-hero'
import { Testimonials } from '@/components/sections/testimonials'
import { Polaroid } from '@/components/ui/polaroid'
import { SmartImage } from '@/components/ui/smart-image'

const WELCOME_IMG = '/assets/site/wed.jpg'
const WELCOME_INSET = '/assets/site/DSC3669-2.jpg'

const CtaBand = () => {
  const parallaxRef = useParallax<HTMLDivElement>(0.14)
  /*
   * A CSS background can't be lazy-loaded — the browser fetches it as soon as
   * the rule applies. This one is a full-screen band *below* the fold, and it
   * was being requested at 53 ms, ahead of the hero photo it was competing
   * with. Applying it after the settle window keeps 39 kB out of the critical
   * path; the section keeps its height either way, so nothing shifts.
   */
  const showBackdrop = useAfterPaint()
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden">
      <div
        ref={parallaxRef}
        className="absolute inset-x-0 -inset-y-[14%] z-0 bg-cover bg-center"
        style={showBackdrop ? { backgroundImage: 'url(/assets/site/ss.jpg)' } : undefined}
      />
      <div className="absolute inset-0 z-[1]" style={{ background: 'var(--band-overlay)' }} />
      <div className="relative z-[3] mx-auto w-full max-w-content px-[clamp(20px,6vw,80px)] py-20">
        <Reveal className="max-w-[560px]">
          <SectionHeading
            eyebrow="Begin your journey"
            title="Discover the perfect setting for your special moments."
            titleClassName="text-[clamp(2.3rem,5vw,4rem)] leading-[1.04] mb-6"
          />
          <p className="mb-9 text-[15.5px] font-light leading-[1.85] text-muted">
            Spanning two acres with stunning indoor and outdoor spaces, Infinity
            at Rio Ranch is designed for unforgettable weddings, celebrations,
            corporate events, and community gatherings — elegance, versatility,
            and natural beauty all in one place.
          </p>
          <Button asChild variant="brass">
            <Link to="/gallery">View the Gallery →</Link>
          </Button>
        </Reveal>
      </div>
    </section>
  )
}

export const HomePage = () => {
  const events = useEvents()
  const previewTiles = useGallery().slice(0, 8)
  return (
  <div style={{ animation: 'riseIn .6s ease forwards' }}>
    <HomeHero />

    {/* Welcome */}
    <section className="relative flex min-h-screen flex-col justify-center bg-ink px-[clamp(20px,6vw,80px)] py-[clamp(80px,12vw,150px)]">
      <div className="mx-auto grid max-w-content grid-cols-1 items-center gap-[clamp(40px,6vw,90px)] md:grid-cols-[1.05fr_0.95fr]">
        <div>
          <Reveal>
            <SectionHeading eyebrow="Welcome" title="A premier venue where rustic elegance meets refined celebration." withRule titleClassName="mb-[26px]" />
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mb-5 text-[15.5px] font-light leading-[1.85] text-muted">
              Welcome to Infinity at Rio Ranch, a premier wedding venue and
              event center in Liberty Hill, Texas, just outside Austin.
              Combining timeless charm with modern amenities, our rustic
              elegance provides the perfect backdrop for your most unforgettable
              moments. Whether you're exchanging vows in a breathtaking
              indoor/outdoor setting or envisioning stunning photos to share,
              Infinity is the perfect place to make your dreams come true.
            </p>
          </Reveal>
          <Reveal delay={0.24}>
            <p className="mb-[38px] text-[15.5px] font-light leading-[1.85] text-muted">
              From intimate gatherings to grand celebrations, our venue offers
              the perfect blend of sophistication and natural beauty.
            </p>
          </Reveal>
          <Reveal delay={0.3}>
            <StatList className="border-t border-line pt-[34px]" />
          </Reveal>
        </div>
        <Reveal delay={0.12} className="relative pb-10 pl-10 md:pb-0">
          <Polaroid
            src={WELCOME_IMG}
            alt="Wedding ceremony on the lawn at Infinity at Rio Ranch, Liberty Hill, TX"
            caption="The Grand Reception Hall"
            rotate={-3}
            className="mx-auto w-full max-w-[420px]"
          />
          <Polaroid
            src={WELCOME_INSET}
            alt="The grand reception hall set for dinner at Infinity at Rio Ranch"
            rotate={5}
            aspect="aspect-square"
            className="absolute -bottom-2 -left-2 hidden w-[190px] md:block"
          />
        </Reveal>
      </div>
    </section>

    {/* Events */}
    <section className="relative flex min-h-screen flex-col justify-center bg-[linear-gradient(180deg,var(--ink),var(--panel)_50%,var(--ink))] px-[clamp(20px,6vw,80px)] py-[clamp(70px,10vw,130px)]">
      <div className="mx-auto max-w-content">
        <Reveal className="mb-16 text-center">
          <SectionHeading
            eyebrow="Every Occasion"
            title="Made for your most meaningful gatherings"
            align="center"
          />
        </Reveal>
        <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
          {events.map((evt, i) => (
            <Reveal key={evt.n} delay={i * 0.08}>
              <Link
                to="/contact"
                className="group relative flex min-h-[320px] flex-col justify-end overflow-hidden rounded-[2px] border border-line transition-all duration-500 hover:-translate-y-2 hover:border-brass"
              >
                <SmartImage
                  src={evt.image}
                  alt={`${evt.title} at Infinity at Rio Ranch in Liberty Hill, TX`}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="absolute inset-0 z-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 z-[1] shadow-[inset_0_-120px_120px_rgba(10,8,6,0.85)]" />
                <div className="relative z-[2] flex min-h-[190px] flex-col justify-end gap-2.5 px-6 pb-7 pt-[26px]">
                  <span className="font-serif text-[15px] text-brass2">{evt.n}</span>
                  <h3 className="m-0 font-serif text-[23px] font-medium leading-[1.12] text-cream">
                    {evt.title}
                  </h3>
                  <p className="m-0 text-[13px] font-light leading-[1.6] text-cream/70">
                    {evt.blurb}
                  </p>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>

    <CtaBand />

    {/* Gallery preview */}
    <section className="relative flex min-h-screen flex-col justify-center bg-ink px-[clamp(20px,6vw,80px)] py-[clamp(70px,10vw,130px)]">
      <div className="mx-auto w-full min-w-0 max-w-wide">
        <Reveal className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <SectionHeading eyebrow="Get inspired" title="Photo Gallery" titleClassName="mt-2" />
          <Link
            to="/gallery"
            className="border-b border-brass pb-[5px] text-[11px] uppercase tracking-[0.24em] text-brass2 transition-colors duration-300 hover:text-brass"
          >
            View Full Gallery →
          </Link>
        </Reveal>
        <Reveal delay={0.1}>
          <GalleryCarousel tiles={previewTiles} />
        </Reveal>
      </div>
    </section>

    <Testimonials />

    {/* Contact CTA */}
    <section
      className="relative flex min-h-screen flex-col justify-center overflow-hidden px-[clamp(20px,6vw,80px)] py-[clamp(80px,12vw,150px)]"
      style={{ background: 'var(--contact-glow), var(--ink)' }}
    >
      <div className="mx-auto max-w-[920px] text-center">
        <Reveal>
          <div className="mb-1.5 font-script text-[36px] font-bold text-brass2">
            Take a tour
          </div>
        </Reveal>
        <Reveal delay={0.06}>
          <h2 className="mb-6 font-serif text-[clamp(2.4rem,5.6vw,4.4rem)] font-normal leading-[1.04] text-cream">
            Let's plan something{' '}
            <span className="font-script text-[1.15em] font-bold text-brass2">
              unforgettable
            </span>
            .
          </h2>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="mx-auto mb-11 max-w-[520px] text-base font-light leading-[1.8] text-muted">
            We'd love to show you around, reserve your event date, or discuss
            your wedding-day dreams.
          </p>
        </Reveal>
        <Reveal delay={0.18} className="flex flex-col justify-center gap-4 sm:flex-row">
          <Button asChild variant="brass" size="lg">
            <Link to="/contact">Contact Us</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <a href="tel:+15126302236">Call to Schedule</a>
          </Button>
        </Reveal>
      </div>
    </section>
  </div>
  )
}
