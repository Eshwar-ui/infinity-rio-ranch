import type { ReactNode } from 'react'

import { Reveal } from '@/components/effects/reveal'

const h2 = 'mb-3 mt-11 font-serif text-[22px] font-normal text-cream first:mt-0'
const p = 'mb-4 text-[15px] font-light leading-[1.85] text-muted'
const li = 'mb-2 text-[15px] font-light leading-[1.85] text-muted'
const ul = 'mb-4 list-disc space-y-1 pl-6'

/** Shared prose primitives for the privacy policy and terms pages. */
export const legal = { h2, p, li, ul }

type LegalPageProps = {
  eyebrow: string
  title: string
  updated: string
  children: ReactNode
}

/**
 * Plain article shell for the two legal pages — no parallax hero, since these
 * are reference documents someone lands on to read, not to be sold on.
 */
export const LegalPage = ({ eyebrow, title, updated, children }: LegalPageProps) => (
  <div className="page-enter">
    <section className="relative bg-ink px-[clamp(20px,6vw,80px)] pb-8 pt-[clamp(120px,14vw,160px)]">
      <div className="mx-auto max-w-[760px] text-center">
        <div className="font-script text-[28px] font-bold text-brass2">{eyebrow}</div>
        <h1 className="mt-1 font-serif text-[clamp(2rem,4.4vw,3rem)] font-normal text-cream">
          {title}
        </h1>
        <p className="mt-4 text-[11px] uppercase tracking-[0.24em] text-muted">
          Last updated {updated}
        </p>
      </div>
    </section>

    <section className="relative bg-ink px-[clamp(20px,6vw,80px)] pb-[clamp(80px,10vw,130px)]">
      <Reveal className="mx-auto max-w-[760px] border-t border-line pt-10">
        {children}
      </Reveal>
    </section>
  </div>
)
