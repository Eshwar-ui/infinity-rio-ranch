import { Link } from 'react-router-dom'

import { useContact, useCopy, useEvents, useGallery } from '@/hooks/use-site-content'
import { Button } from '@/components/ui/button'
import { SectionHeading } from '@/components/ui/section-heading'
import { Reveal } from '@/components/effects/reveal'
import { useParallax } from '@/hooks/use-parallax'
import { useNearViewport } from '@/hooks/use-near-viewport'
import { GalleryCarousel } from '@/components/gallery/gallery-carousel'
import { HomeHero } from '@/components/sections/home-hero'
import { Testimonials } from '@/components/sections/testimonials'
import { Polaroid } from '@/components/ui/polaroid'
import { SmartImage } from '@/components/ui/smart-image'

const WELCOME_IMG = '/assets/site/wed.jpg'
const WELCOME_INSET = '/assets/site/DSC3669-2.jpg'

const CtaBand = () => {
  const t = useCopy()
  const parallaxRef = useParallax<HTMLDivElement>(0.14)
  /*
   * A CSS background can't be lazy-loaded — the browser fetches it as soon as
   * the rule applies. This one is a full-screen band *below* the fold, and it
   * was being requested at 53 ms, ahead of the hero photo it was competing
   * with. Holding it until the band is near the viewport keeps those 39 kB out
   * of the critical path and still has it loaded by the time anyone scrolls
   * here; the section keeps its height either way, so nothing shifts.
   *
   * Not `useAfterPaint`: that one stays false forever under reduced motion,
   * which left this section permanently photo-less for those visitors.
   */
  const { ref: bandRef, near: showBackdrop } = useNearViewport<HTMLElement>()
  return (
    <section
      ref={bandRef}
      className="relative flex min-h-screen items-center overflow-hidden"
    >
      <div
        ref={parallaxRef}
        className="absolute inset-x-0 -inset-y-[14%] z-0 bg-cover bg-[position:60%_center] md:bg-[position:72%_center]"
        style={showBackdrop ? { backgroundImage: 'url(/assets/site/ss.jpg)' } : undefined}
      />
      <div className="absolute inset-0 z-[1]" style={{ background: 'var(--band-overlay)' }} />
      <div className="relative z-[3] mx-auto w-full max-w-content px-[clamp(20px,6vw,80px)] py-20">
        <Reveal className="max-w-[560px]">
          <SectionHeading
            eyebrow={t('home.band.eyebrow')}
            title={t('home.band.title')}
            className="[&>span]:text-[#e6cfa0]"
            titleClassName="mb-6 text-[clamp(2.3rem,5vw,4rem)] leading-[1.04] text-[#f5efe6]"
          />
          <p className="mb-9 text-[15.5px] font-light leading-[1.85] text-[rgba(245,239,230,0.78)]">
            {t('home.band.body')}
          </p>
          <Button asChild variant="brass">
            <Link to="/gallery">{t('home.band.cta')}</Link>
          </Button>
        </Reveal>
      </div>
    </section>
  )
}

export const HomePage = () => {
  const t = useCopy()
  const contact = useContact()
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
            <SectionHeading eyebrow={t('home.welcome.eyebrow')} title={t('home.welcome.title')} withRule titleClassName="mb-[26px]" />
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mb-5 text-[15.5px] font-light leading-[1.85] text-muted">
              {t('home.welcome.body1')}
            </p>
          </Reveal>
          <Reveal delay={0.24}>
            <p className="text-[15.5px] font-light leading-[1.85] text-muted">
              {t('home.welcome.body2')}
            </p>
          </Reveal>
        </div>
        <Reveal delay={0.12} className="relative pb-10 pl-10 md:pb-0">
          <Polaroid
            src={WELCOME_IMG}
            alt="Wedding ceremony on the lawn at Infinity at Rio Ranch, Liberty Hill, TX"
            caption={t('home.welcome.caption')}
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
            eyebrow={t('home.events.eyebrow')}
            title={t('home.events.title')}
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
                {/* A real gradient, not an inset shadow — the shadow's falloff
                    left the caption band sitting on whatever the photo was, and
                    these covers run bright. Same scrim the gallery tiles use. */}
                <div className="absolute inset-0 z-[1] bg-[linear-gradient(180deg,transparent_30%,rgba(10,8,6,0.5)_58%,rgba(8,6,4,0.93)_100%)]" />
                {/*
                 * Fixed light-on-dark colors, never the theme tokens: this text
                 * sits on a photo behind a dark scrim in *both* themes, so
                 * `text-cream` flipped to near-black in light mode and the
                 * captions vanished. Same reasoning as the navbar over the hero.
                 */}
                <div className="relative z-[2] flex min-h-[190px] flex-col justify-end gap-2.5 px-6 pb-7 pt-[26px]">
                  <span className="font-serif text-[15px] text-[#e2c690]">{evt.n}</span>
                  <h3 className="m-0 font-serif text-[23px] font-medium leading-[1.12] text-[#f3ede2]">
                    {evt.title}
                  </h3>
                  <p className="m-0 text-[13px] font-light leading-[1.6] text-[rgba(243,237,226,0.75)]">
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
          <SectionHeading eyebrow={t('home.gallery.eyebrow')} title={t('home.gallery.title')} titleClassName="mt-2" />
          <Link
            to="/gallery"
            className="border-b border-brass pb-[5px] text-[11px] uppercase tracking-[0.24em] text-brass2 transition-colors duration-300 hover:text-brass"
          >
            {t('home.gallery.link')}
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
            {t('home.cta.script')}
          </div>
        </Reveal>
        <Reveal delay={0.06}>
          <h2 className="mb-6 font-serif text-[clamp(2.4rem,5.6vw,4.4rem)] font-normal leading-[1.04] text-cream">
            {t('home.cta.title_lead')}{' '}
            <span className="font-script text-[1.15em] font-bold text-brass2">
              {t('home.cta.title_accent')}
            </span>
            .
          </h2>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="mx-auto mb-11 max-w-[520px] text-base font-light leading-[1.8] text-muted">
            {t('home.cta.body')}
          </p>
        </Reveal>
        <Reveal delay={0.18} className="flex flex-col justify-center gap-4 sm:flex-row">
          <Button asChild variant="brass" size="lg">
            <Link to="/contact">{t('home.cta.button_primary')}</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <a href={contact.phoneHref}>{t('home.cta.button_secondary')}</a>
          </Button>
        </Reveal>
      </div>
    </section>
  </div>
  )
}
