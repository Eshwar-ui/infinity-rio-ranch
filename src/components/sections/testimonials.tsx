import { SectionHeading } from '@/components/ui/section-heading'
import { Reveal } from '@/components/effects/reveal'
import { useTestimonials } from '@/hooks/use-site-content'

/** Social-proof band: couples' words, on the Home page before the final CTA. */
export const Testimonials = () => {
  const testimonials = useTestimonials()
  return (
  <section className="relative flex min-h-screen flex-col justify-center bg-[linear-gradient(180deg,var(--ink),var(--panel)_50%,var(--ink))] px-[clamp(20px,6vw,80px)] py-[clamp(70px,10vw,130px)]">
    <div className="mx-auto max-w-content">
      <Reveal className="mb-16 text-center">
        <SectionHeading
          eyebrow="Kind words"
          title="Loved by couples & families"
          align="center"
        />
      </Reveal>

      <div className="grid grid-cols-1 gap-[18px] md:grid-cols-3">
        {testimonials.map((t, i) => (
          <Reveal key={t.name} delay={i * 0.08}>
            <figure className="flex h-full flex-col border border-line bg-[rgba(201,168,106,0.03)] p-8 transition-all duration-500 hover:border-brass hover:bg-[rgba(201,168,106,0.06)]">
              <span
                aria-hidden
                className="font-serif text-[46px] leading-[0.5] text-brass2"
              >
                &ldquo;
              </span>
              <blockquote className="mt-4 flex-1 text-[15px] font-light italic leading-[1.8] text-cream/90">
                {t.quote}
              </blockquote>
              <figcaption className="mt-6 border-t border-line pt-5">
                <div className="font-serif text-[19px] text-brass2">{t.name}</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.24em] text-muted">
                  {t.event}
                </div>
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
  )
}
