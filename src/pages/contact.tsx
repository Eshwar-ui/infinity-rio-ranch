import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { CaretDown } from '@phosphor-icons/react'

import { cn } from '@/lib/utils'
import { venueImg } from '@/data/site'
import { useContact, useCopy, useFaqs, useList } from '@/hooks/use-site-content'
import { useJsonLd } from '@/hooks/use-document-head'
import { FAQ_JSONLD_ID, faqPageNode } from '@/lib/seo'
import { inquirySchema, type InquiryValues } from '@/lib/inquiry-schema'
import { Reveal } from '@/components/effects/reveal'
import { PageHero } from '@/components/layout/page-hero'
import { SectionHeading } from '@/components/ui/section-heading'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

const CONTACT_IMG = '/assets/site/DSC3699-Edit-2.jpg'

const fieldClass =
  'w-full rounded-[1px] border border-line bg-transparent px-[15px] py-3.5 text-sm text-cream outline-none transition-colors duration-300 focus:border-brass'
const labelText =
  'text-[10px] uppercase tracking-[0.24em] text-muted'
const errorText = 'text-[11px] text-[#d98a6a]'

export const ContactPage = () => {
  const t = useCopy()
  const contact = useContact()
  const eventTypes = useList('event_types')
  const faqs = useFaqs()

  // FAQ schema is rebuilt from whatever the CMS is actually serving, so the
  // markup can never claim answers that differ from the ones on the page.
  useJsonLd(FAQ_JSONLD_ID, useMemo(() => faqPageNode(faqs), [faqs]))

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitSuccessful, isSubmitting },
  } = useForm<InquiryValues>({
    resolver: zodResolver(inquirySchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      date: '',
      type: 'Wedding',
      message: '',
    },
  })

  const onSubmit = async (values: InquiryValues) => {
    // Loaded on submit rather than on render — see use-site-content.ts.
    const { supabase } = await import('@/lib/supabase')
    const { error } = await supabase.from('leads').insert({
      name: values.name,
      email: values.email,
      phone: values.phone || null,
      event_date: values.date || null,
      type: values.type,
      message: values.message || null,
    })

    if (error) {
      // Throwing keeps isSubmitSuccessful false, so the form stays visible to retry.
      toast.error('Something went wrong sending your inquiry. Please try again.')
      throw error
    }

    toast.success("Inquiry sent — we'll be in touch within one business day.")
  }

  return (
    <div style={{ animation: 'riseIn .6s ease forwards' }}>
      <PageHero
        eyebrow={t('contact.hero.eyebrow')}
        title={t('contact.hero.title')}
        crumb="Contact"
        image={venueImg(1)}
        className="min-h-[50vh]"
      />

      <section className="relative bg-ink px-[clamp(20px,6vw,80px)] py-[clamp(70px,10vw,130px)]">
        <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-start gap-[clamp(40px,6vw,80px)] md:grid-cols-[1.1fr_0.9fr]">
          <Reveal>
            <span className="font-script text-[30px] font-bold text-brass2">
              {t('contact.form.script')}
            </span>
            <h2 className="mb-[30px] mt-2 font-serif text-[clamp(1.9rem,4vw,3rem)] font-normal leading-[1.1] text-cream">
              {t('contact.form.title')}
            </h2>

            {isSubmitSuccessful ? (
              <div className="border border-brass bg-[rgba(201,168,106,0.06)] px-[34px] py-10 text-center">
                <div className="font-serif text-[28px] text-brass2">
                  {t('contact.success.title')}
                </div>
                <p className="mx-auto mb-6 mt-3 max-w-[380px] text-[14.5px] font-light leading-[1.7] text-muted">
                  {t('contact.success.body')}
                </p>
                <button
                  type="button"
                  onClick={() => reset()}
                  className="border border-[var(--btn-outline)] px-[26px] py-3.5 text-[11px] uppercase tracking-[0.2em] text-cream transition-colors duration-300 hover:border-brass hover:text-brass2"
                >
                  {t('contact.success.button')}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} noValidate>
                <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2">
                  <label className="flex flex-col gap-2.5">
                    <span className={labelText}>Your Name</span>
                    <input className={fieldClass} placeholder="Full name" {...register('name')} />
                    {errors.name && <span className={errorText}>{errors.name.message}</span>}
                  </label>
                  <label className="flex flex-col gap-2.5">
                    <span className={labelText}>Email</span>
                    <input className={fieldClass} placeholder="you@email.com" {...register('email')} />
                    {errors.email && <span className={errorText}>{errors.email.message}</span>}
                  </label>
                  <label className="flex flex-col gap-2.5">
                    <span className={labelText}>Phone</span>
                    <input className={fieldClass} placeholder="(512) 000-0000" {...register('phone')} />
                  </label>
                  <label className="flex flex-col gap-2.5">
                    <span className={labelText}>Preferred Date</span>
                    <input type="date" className={fieldClass} {...register('date')} />
                  </label>
                </div>

                <label className="mt-[18px] flex flex-col gap-2.5">
                  <span className={labelText}>Event Type</span>
                  {/*
                   * A native select paints its own dropdown arrow in the OS
                   * colours and sizes the control to its own metrics, so it
                   * ignored the theme and sat taller than the inputs beside it.
                   * `appearance-none` drops both; the caret below replaces the
                   * arrow and follows the accent like every other icon here.
                   * `pointer-events-none` keeps clicks falling through to the
                   * select, so the native menu still opens when you hit it.
                   */}
                  <div className="relative">
                    <select className={cn(fieldClass, 'appearance-none pr-10')} {...register('type')}>
                      {eventTypes.map((t) => (
                        <option key={t} className="bg-ink text-cream">
                          {t}
                        </option>
                      ))}
                    </select>
                    <CaretDown
                      size={16}
                      weight="light"
                      aria-hidden
                      className="pointer-events-none absolute right-[15px] top-1/2 -translate-y-1/2 text-brass"
                    />
                  </div>
                </label>

                <label className="mt-[18px] flex flex-col gap-2.5">
                  <span className={labelText}>Message</span>
                  <textarea
                    rows={4}
                    className={cn(fieldClass, 'min-h-[110px] resize-y')}
                    placeholder="Tell us about your vision, guest count, and any questions."
                    {...register('message')}
                  />
                </label>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-[26px] inline-flex items-center gap-2.5 bg-brass px-10 py-[17px] text-xs font-medium uppercase tracking-[0.2em] text-onbrass transition-all duration-300 hover:-translate-y-0.5 hover:bg-brass2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? 'Sending…' : t('contact.form.submit')}
                </button>
              </form>
            )}
          </Reveal>

          <Reveal delay={0.1}>
            <div
              className="mb-[34px] aspect-[5/4] overflow-hidden rounded-[2px] bg-cover bg-center shadow-[0_30px_70px_rgba(0,0,0,0.5)]"
              style={{ backgroundImage: `url(${CONTACT_IMG})` }}
            />
            <div className="flex flex-col gap-[26px]">
              <div>
                <div className="mb-2.5 text-[10px] uppercase tracking-[0.28em] text-brass">Email</div>
                <a href={`mailto:${contact.email}`} className="text-[15px] text-cream">
                  {contact.email}
                </a>
              </div>
              <div>
                <div className="mb-2.5 text-[10px] uppercase tracking-[0.28em] text-brass">Call</div>
                <div className="text-[15px] leading-[1.7] text-cream">
                  {contact.phones[0]}
                  <br />
                  {contact.phones[1]}
                </div>
              </div>
              <div>
                <div className="mb-2.5 text-[10px] uppercase tracking-[0.28em] text-brass">Follow</div>
                <a
                  href={contact.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[15px] text-cream"
                >
                  {contact.instagramHandle}
                </a>
              </div>
              <div>
                <div className="mb-2.5 text-[10px] uppercase tracking-[0.28em] text-brass">Location</div>
                <a
                  href={contact.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[15px] leading-[1.6] text-cream transition-colors duration-300 hover:text-brass2"
                >
                  {contact.address}
                </a>
              </div>
              <div className="overflow-hidden rounded-[2px] border border-line shadow-[0_20px_45px_rgba(0,0,0,0.25)]">
                <iframe
                  title="Infinity at Rio Ranch location"
                  src={contact.mapEmbedUrl}
                  className="h-[280px] w-full border-0 grayscale-[0.2]"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section className="relative bg-[linear-gradient(180deg,var(--ink),var(--panel)_50%,var(--ink))] px-[clamp(20px,6vw,80px)] py-[clamp(70px,10vw,120px)]">
        <div className="mx-auto max-w-[820px]">
          <Reveal className="mb-10 text-center">
            <SectionHeading
              eyebrow={t('contact.faq.eyebrow')}
              title={t('contact.faq.title')}
              align="center"
            />
          </Reveal>
          <Reveal delay={0.08}>
            <Accordion type="single" collapsible className="border-t border-line">
              {faqs.map((faq, i) => (
                <AccordionItem key={faq.q} value={`faq-${i}`}>
                  <AccordionTrigger>{faq.q}</AccordionTrigger>
                  <AccordionContent>{faq.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </div>
      </section>
    </div>
  )
}
