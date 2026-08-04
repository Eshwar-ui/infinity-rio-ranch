import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'

import { useContact, usePost } from '@/hooks/use-site-content'
import { useJsonLd } from '@/hooks/use-document-head'
import { FAQ_JSONLD_ID, faqPageNode, postRoute } from '@/lib/seo'
import { formatPostDate } from '@/lib/post-format'
import { PostBody } from '@/lib/markdown'
import { Reveal } from '@/components/effects/reveal'
import { SmartImage } from '@/components/ui/smart-image'
import { Button } from '@/components/ui/button'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { NotFoundPage } from '@/pages/not-found'

export const BlogPostPage = () => {
  const { slug } = useParams<{ slug: string }>()
  const { post, loading } = usePost(slug)
  const contact = useContact()

  /*
   * FAQ schema built from the live answers, keyed so it replaces the block the
   * prerenderer baked in rather than duplicating it. Google only shows FAQ rich
   * results when the same Q&A is visible on the page, which is why the markup
   * below renders the identical list.
   */
  useJsonLd(
    FAQ_JSONLD_ID,
    useMemo(
      () =>
        post && post.faqs.length > 0
          ? faqPageNode(post.faqs, postRoute(post.slug))
          : null,
      [post],
    ),
  )

  /*
   * Three states, not two. A slug that isn't in the build-time snapshot might
   * still be a real post published since the last deploy, so "not found" is
   * only true once the lookup has actually come back empty — otherwise a
   * client-side visit to a fresh post would flash the 404 page.
   */
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink text-sm uppercase tracking-[0.24em] text-muted">
        Loading…
      </div>
    )
  }

  if (!post) return <NotFoundPage />

  const date = formatPostDate(post.publishedAt)
  const ctaHeading = post.ctaHeading || 'Ready to see it in person?'
  const ctaBody =
    post.ctaBody ||
    'The fastest way to know if a venue is right for your day is to walk it yourself. Book a tour, or call to check date availability.'

  return (
    <div style={{ animation: 'riseIn .6s ease forwards' }}>
      <article>
        {/* ---- Header ------------------------------------------------- */}
        {/*
          Always dark, in both themes — and that is not decoration.
          `Navbar` styles its unscrolled state for light-on-dark because on every
          other route it floats over a PageHero. A post rendered on the themed
          `bg-ink` put near-white nav links on a cream background in light mode,
          which was unreadable. Giving the post a real header band restores the
          assumption the navbar is built on, and matches /about and /gallery.

          The colours are fixed hex rather than theme tokens for the same reason
          PageHero's are: this surface does not change with the theme, so a token
          that does would break it.
        */}
        <header className="relative overflow-hidden bg-[linear-gradient(180deg,#1c1710_0%,#151109_55%,var(--ink)_100%)] px-[clamp(20px,6vw,80px)] pb-[clamp(48px,7vw,72px)] pt-[clamp(120px,15vw,170px)]">
          <div className="mx-auto max-w-[820px]">
            {/*
              Visible breadcrumb matching the BreadcrumbList in the JSON-LD.
              A trail that disagrees with the structured data gets the
              enhancement dropped, so both come from the same route shape.
            */}
            <nav
              aria-label="Breadcrumb"
              className="mb-7 flex flex-wrap items-center gap-2.5 text-[10.5px] uppercase tracking-[0.2em] text-[rgba(245,239,230,0.62)]"
            >
              <Link to="/" className="transition-colors hover:text-[#e6cfa0]">
                Home
              </Link>
              <span aria-hidden="true">·</span>
              <Link to="/blog" className="transition-colors hover:text-[#e6cfa0]">
                Blog
              </Link>
              <span aria-hidden="true">·</span>
              {/* The title can be long — let it wrap instead of stretching the row. */}
              <span className="text-[#e6cfa0]">{post.title}</span>
            </nav>

            <h1 className="m-0 font-serif text-[clamp(2.1rem,5vw,3.4rem)] font-normal leading-[1.12] text-[#f5efe6]">
              {post.title}
            </h1>

            {(date || post.author) && (
              <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] uppercase tracking-[0.2em] text-[rgba(245,239,230,0.62)]">
                {date && <time dateTime={post.publishedAt ?? undefined}>{date}</time>}
                {date && post.author && <span aria-hidden="true">·</span>}
                {post.author && <span>{post.author}</span>}
              </div>
            )}

            {post.excerpt && (
              <p className="mt-7 max-w-[68ch] text-[17px] font-light leading-[1.7] text-[rgba(245,239,230,0.85)]">
                {post.excerpt}
              </p>
            )}
          </div>
        </header>

        {/*
          ---- Cover ----
          A real <img>, not a background on the header. `routeImages()` declares
          this file in sitemap.xml, and a CSS background is not crawlable — so
          putting it behind the title would make that declaration a claim Google
          cannot verify. Pulled up into the header's tail so it reads as one unit.
        */}
        {post.coverImage && (
          <div className="-mt-[clamp(28px,5vw,52px)] bg-transparent px-[clamp(20px,6vw,80px)]">
            <div className="mx-auto max-w-[980px]">
              <SmartImage
                src={post.coverImage}
                alt={post.coverAlt || post.title}
                sizes="(min-width: 1040px) 980px, 100vw"
                priority
                className="h-auto w-full rounded-[2px]"
              />
            </div>
          </div>
        )}

        {/*
          ---- Body ----
          Modest top padding: the header already carries its own bottom padding,
          and stacking both left a dead band between the excerpt and the first
          paragraph. `[&>*:first-child]:mt-0` stops a leading `##` in the markdown
          from adding its 3rem heading margin on top of that again.
        */}
        <section className="relative bg-ink px-[clamp(20px,6vw,80px)] pb-[clamp(50px,7vw,80px)] pt-[clamp(32px,4vw,48px)]">
          <div className="mx-auto max-w-[820px] [&>*:first-child]:mt-0">
            <PostBody>{post.body}</PostBody>
          </div>
        </section>

        {/* ---- FAQ ---------------------------------------------------- */}
        {post.faqs.length > 0 && (
          <section className="relative bg-[linear-gradient(180deg,var(--ink),var(--panel)_50%,var(--ink))] px-[clamp(20px,6vw,80px)] py-[clamp(60px,9vw,110px)]">
            <div className="mx-auto max-w-[820px]">
              <Reveal className="mb-10">
                <h2 className="font-serif text-[clamp(1.6rem,3.2vw,2.3rem)] font-normal leading-[1.15] text-cream">
                  Frequently asked questions
                </h2>
              </Reveal>
              <Reveal delay={0.08}>
                <Accordion type="single" collapsible className="border-t border-line">
                  {post.faqs.map((faq, i) => (
                    <AccordionItem key={faq.q} value={`faq-${i}`}>
                      <AccordionTrigger>{faq.q}</AccordionTrigger>
                      <AccordionContent>{faq.a}</AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </Reveal>
            </div>
          </section>
        )}

        {/* ---- CTA ---------------------------------------------------- */}
        <section className="relative bg-ink px-[clamp(20px,6vw,80px)] pb-[clamp(70px,10vw,120px)] pt-[clamp(40px,6vw,70px)]">
          <div className="mx-auto max-w-[820px] border-t border-line pt-[clamp(40px,6vw,64px)] text-center">
            <Reveal>
              <h2 className="font-serif text-[clamp(1.7rem,3.4vw,2.5rem)] font-normal leading-[1.15] text-cream">
                {ctaHeading}
              </h2>
              <p className="mx-auto mt-4 max-w-[560px] text-[15.5px] font-light leading-[1.85] text-muted">
                {ctaBody}
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Button asChild variant="brass">
                  <Link to="/contact">Schedule a tour</Link>
                </Button>
                {/*
                  The number is read from the CMS, never hardcoded — editing the
                  phone in the admin panel has to move it everywhere at once.
                */}
                {contact.phones[0] && (
                  <a
                    href={contact.phoneHref}
                    className="text-[13px] uppercase tracking-[0.18em] text-brass2 transition-colors hover:text-brass"
                  >
                    or call {contact.phones[0]}
                  </a>
                )}
              </div>
            </Reveal>

            <div className="mt-12">
              <Link
                to="/blog"
                className="text-[11px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-brass2"
              >
                ← All articles
              </Link>
            </div>
          </div>
        </section>
      </article>
    </div>
  )
}
