import { Link } from 'react-router-dom'
import { Check } from '@phosphor-icons/react'

import { amenities, included, venueImg } from '@/data/site'
import { glanceFacts } from '@/lib/seo'
import { Button } from '@/components/ui/button'
import { SectionHeading } from '@/components/ui/section-heading'
import { StatList } from '@/components/ui/stat-list'
import { Reveal } from '@/components/effects/reveal'
import { PageHero } from '@/components/layout/page-hero'
import { Polaroid } from '@/components/ui/polaroid'

const ABOUT_IMG = '/assets/site/f11.jpg'

export const AboutPage = () => (
  <div style={{ animation: 'riseIn .6s ease forwards' }}>
    <PageHero
      eyebrow="Our story"
      title="About Us"
      crumb="About"
      image={venueImg(6)}
      className="min-h-[58vh]"
    />

    {/* Intro */}
    <section className="relative bg-ink px-[clamp(20px,6vw,80px)] py-[clamp(80px,12vw,150px)]">
      <div className="mx-auto grid max-w-content grid-cols-1 items-center gap-[clamp(40px,6vw,90px)] md:grid-cols-2">
        <Reveal className="relative pb-10 pr-10 md:pb-0">
          <Polaroid
            src={ABOUT_IMG}
            alt="Golden-hour couple portraits on the grounds at Infinity at Rio Ranch"
            rotate={2}
            className="mx-auto w-full max-w-[400px]"
          />
          <Polaroid
            src={venueImg(11)}
            alt="The outdoor cocktail garden at Infinity at Rio Ranch"
            rotate={-5}
            aspect="aspect-square"
            className="absolute -bottom-2 -right-2 hidden w-[180px] md:block"
          />
        </Reveal>
        <div>
          <Reveal>
            <SectionHeading
              eyebrow="Welcome to Infinity"
              title="Two acres of timeless charm and modern amenities."
              titleClassName="text-[clamp(2rem,4.4vw,3.4rem)] leading-[1.1] mb-[26px]"
            />
          </Reveal>
          <Reveal delay={0.14}>
            <p className="mb-5 text-[15.5px] font-light leading-[1.85] text-muted">
              Infinity at Rio Ranch is a wedding and event venue in Liberty
              Hill, Texas, in the Greater Austin area. It spreads across two
              acres, featuring 2,600 sq ft of indoor space and 12,400 sq ft of
              outdoor space — perfect for hosting unforgettable celebrations.
              Whether you're planning an intimate gathering or a grand
              celebration, our venue offers the perfect blend of sophistication
              and natural beauty.
            </p>
          </Reveal>
          <Reveal delay={0.22}>
            <p className="mb-[34px] text-[15.5px] font-light leading-[1.85] text-muted">
              Combining rustic elegance with contemporary comfort, Infinity is
              designed to be the backdrop for your most meaningful moments — and
              the stunning photographs you'll treasure long after.
            </p>
          </Reveal>
          <Reveal delay={0.28}>
            <Button asChild variant="brass">
              <Link to="/contact">Schedule a Tour</Link>
            </Button>
          </Reveal>
        </div>
      </div>
    </section>

    {/*
      Venue at a glance — a flat, factual key/value block. This is the shape
      answer engines and featured snippets extract cleanly, and it gives AI
      search a citable set of specifics (where, how big, what for, how to book).
    */}
    <section
      aria-labelledby="venue-at-a-glance"
      className="relative bg-ink px-[clamp(20px,6vw,80px)] pb-[clamp(50px,7vw,90px)]"
    >
      <Reveal className="mx-auto max-w-content">
        <h2
          id="venue-at-a-glance"
          className="mb-7 text-[11px] uppercase tracking-[0.28em] text-brass"
        >
          The venue at a glance
        </h2>
        <dl className="grid grid-cols-1 border-t border-line">
          {glanceFacts.map((fact) => (
            <div
              key={fact.term}
              className="grid grid-cols-1 gap-1 border-b border-line py-[18px] sm:grid-cols-[200px_1fr] sm:gap-6"
            >
              <dt className="text-[11px] uppercase tracking-[0.2em] text-muted">
                {fact.term}
              </dt>
              <dd className="m-0 text-[15px] font-light leading-[1.7] text-cream">
                {fact.detail}
              </dd>
            </div>
          ))}
        </dl>
      </Reveal>
    </section>

    {/* Stats band */}
    <section className="relative bg-[linear-gradient(180deg,var(--ink),var(--panel2)_60%,var(--ink))] px-[clamp(20px,6vw,80px)] py-[clamp(60px,8vw,110px)]">
      <Reveal className="mx-auto max-w-[1100px]">
        <StatList variant="band" />
      </Reveal>
    </section>

    {/* Owners & amenities */}
    <section className="relative bg-ink px-[clamp(20px,6vw,80px)] py-[clamp(70px,10vw,130px)]">
      <div className="mx-auto grid max-w-content grid-cols-1 items-center gap-[clamp(40px,6vw,80px)] md:grid-cols-[0.9fr_1.1fr]">
        <Reveal>
          <SectionHeading
            eyebrow="Owners & amenities"
            title="Family-owned, personally hosted."
            titleClassName="text-[clamp(2rem,4.4vw,3.2rem)] leading-[1.1] mb-6"
          />
          <p className="text-[15.5px] font-light leading-[1.85] text-muted">
            Infinity Weddings &amp; Events pairs attentive, personal service with
            thoughtfully appointed spaces — so every detail of your celebration
            feels effortless from your first tour to your final dance.
          </p>
        </Reveal>
        <Reveal delay={0.1} className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {amenities.map((am) => (
            <div
              key={am.title}
              className="border border-line bg-[rgba(201,168,106,0.03)] px-[22px] py-6 transition-all duration-500 hover:border-brass hover:bg-[rgba(201,168,106,0.06)]"
            >
              <div className="font-serif text-[26px] leading-none text-brass2">
                {am.icon}
              </div>
              <div className="mt-3.5 text-[13.5px] font-medium tracking-[0.02em] text-cream">
                {am.title}
              </div>
              <div className="mt-1.5 text-[12.5px] font-light leading-[1.55] text-muted">
                {am.sub}
              </div>
            </div>
          ))}
        </Reveal>
      </div>
    </section>

    {/* What's Included */}
    <section className="relative bg-[linear-gradient(180deg,var(--ink),var(--panel2)_60%,var(--ink))] px-[clamp(20px,6vw,80px)] py-[clamp(70px,10vw,130px)]">
      <div className="mx-auto max-w-content">
        <Reveal className="mb-14 text-center">
          <SectionHeading
            eyebrow="Effortless from the start"
            title="Every celebration includes"
            align="center"
          />
        </Reveal>
        <Reveal delay={0.08} className="mx-auto grid max-w-[880px] grid-cols-1 gap-x-12 gap-y-1 sm:grid-cols-2">
          {included.map((item) => (
            <div
              key={item}
              className="flex items-center gap-4 border-b border-line py-[18px]"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brass/40 text-brass2">
                <Check size={15} weight="bold" />
              </span>
              <span className="text-[15px] font-light text-cream">{item}</span>
            </div>
          ))}
        </Reveal>
        <Reveal delay={0.16} className="mt-14 text-center">
          <Button asChild variant="brass">
            <Link to="/contact">Inquire About Your Date</Link>
          </Button>
        </Reveal>
      </div>
    </section>
  </div>
)
