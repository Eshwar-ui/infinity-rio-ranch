import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { cn } from '@/lib/utils'
import { useContact, usePost, usePosts } from '@/hooks/use-site-content'
import { useJsonLd } from '@/hooks/use-document-head'
import { FAQ_JSONLD_ID, faqPageNode, postRoute } from '@/lib/seo'
import { articleHeadings, formatPostDate } from '@/lib/post-format'
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

type Heading = ReturnType<typeof articleHeadings>[number]

/*
 * CTA fallbacks, at module scope because the contents rail needs the heading
 * before the component's early returns — a hook can't run after them.
 */
const DEFAULT_CTA_HEADING = 'Ready to see it in person?'
const DEFAULT_CTA_BODY =
  'The fastest way to know if a venue is right for your day is to walk it yourself. Book a tour, or call to check date availability.'

/**
 * Contents rail, with the section you're reading marked.
 *
 * A list of links tells you what's in the article; it doesn't tell you where you
 * are in it, which is the question a reader halfway down a 2,000-word guide
 * actually has. The observer answers that — and on `lg` the rail sticks, so the
 * answer stays on screen instead of being something you scroll back up to.
 *
 * The active id is deliberately empty on the first render: an effect can't run
 * during prerender, so anything else here would be a hydration mismatch.
 */
const TableOfContents = ({ headings }: { headings: Heading[] }) => {
  const [activeId, setActiveId] = useState('')

  useEffect(() => {
    const targets = headings
      .map((heading) => document.getElementById(heading.id))
      .filter((el): el is HTMLElement => el !== null)
    if (targets.length === 0) return

    /*
     * The band is the top ~third of the viewport, below the fixed navbar. A
     * heading is "current" from the moment it reaches that band until the next
     * one does, which is what makes the highlight track reading rather than
     * flicker between whatever happens to be visible.
     */
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting)
        if (visible.length === 0) return
        const topmost = visible.reduce((a, b) =>
          a.boundingClientRect.top <= b.boundingClientRect.top ? a : b,
        )
        setActiveId(topmost.target.id)
      },
      { rootMargin: '-112px 0px -68% 0px', threshold: 0 },
    )
    targets.forEach((target) => observer.observe(target))
    return () => observer.disconnect()
  }, [headings])

  return (
    <nav
      aria-label="On this page"
      className="lg:sticky lg:top-28 lg:self-start lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto"
    >
      <p className="flex items-center gap-3 text-[10.5px] uppercase tracking-[0.2em] text-brass2">
        <span aria-hidden className="h-px w-6 bg-brass" />
        On this page
      </p>

      <ol className="mt-4 border-l border-line">
        {headings.map((heading) => {
          const active = activeId === heading.id
          return (
            <li key={heading.id}>
              <a
                href={`#${heading.id}`}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  '-ml-px block border-l-2 py-2 text-[13.5px] leading-snug transition-colors duration-300',
                  heading.level > 2 ? 'pl-7' : 'pl-4',
                  active
                    ? 'border-brass text-brass2'
                    : 'border-transparent text-muted hover:border-line hover:text-cream',
                )}
              >
                {heading.text}
              </a>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export const BlogPostPage = () => {
  const { slug } = useParams<{ slug: string }>()
  const { post, loading } = usePost(slug)
  const posts = usePosts()
  const contact = useContact()

  const headings = useMemo(() => articleHeadings(post?.body ?? ''), [post?.body])
  const headingIds = useMemo(
    () => Object.fromEntries(headings.map((heading) => [heading.line, heading.id])),
    [headings],
  )

  /*
   * Anchors for the two sections the markdown can't declare.
   *
   * `faq` is not an arbitrary choice: `faqPageNode` gives the FAQPage an `@id`
   * of `<url>#faq`, so this is what makes that fragment resolve to a real
   * element instead of nothing. (It doesn't clash with `FAQ_JSONLD_ID` — that
   * keys a `data-seo-id` attribute, not a DOM id.)
   *
   * Both are checked against the body's own heading ids: a post with an `##
   * FAQ` section would otherwise put the same id on two elements, and
   * `getElementById` would return whichever came first.
   */
  const sectionIds = useMemo(() => {
    const taken = new Set(headings.map((heading) => heading.id))
    const free = (id: string) => (taken.has(id) ? `${id}-section` : id)
    return { faq: free('faq'), cta: free('tour') }
  }, [headings])

  /*
   * The rail lists top-level sections only, plus the two below the article.
   *
   * `###` subheadings are deliberately left out. They keep their ids, stay
   * linkable, and still appear in the article's JSON-LD `hasPart` — but a rail
   * that lists every sub-point stops being a map of the article and becomes the
   * article again. On a post with four seasons and three ceremony criteria it
   * ran to 15 entries and pushed the real sections off a laptop screen.
   *
   * The FAQ block and the closing CTA are real sections that no `##` in the
   * body produces, so they're appended by hand. Their labels are the headings
   * actually rendered further down, not fixed strings: a rail entry that
   * disagrees with the heading it scrolls to is worse than a missing one.
   * `line` is negative because nothing indexes these into the body.
   */
  const tocHeadings = useMemo(() => {
    if (!post) return []
    const top = headings.filter((heading) => heading.level === 2)
    if (top.length === 0) return []

    const extra: Heading[] = []
    if (post.faqs.length > 0) {
      extra.push({ id: sectionIds.faq, level: 2, text: 'Frequently asked questions', line: -1 })
    }
    extra.push({
      id: sectionIds.cta,
      level: 2,
      text: post.ctaHeading || DEFAULT_CTA_HEADING,
      line: -2,
    })
    return [...top, ...extra]
  }, [headings, post, sectionIds])
  /*
   * "Keep reading" — every other post, best match first, never fewer than what
   * exists. Category and tags *rank* the list; they no longer decide whether
   * the reader is offered anything at all.
   *
   * They used to. A post with no tags returned nothing, and so did a post whose
   * tags happened to match nobody — so on a young blog the block was invisible
   * on exactly the articles a first-time reader lands on, which is the moment
   * it earns its keep. A section that only sometimes appears is one nobody
   * learns to look for; the sort is what makes it useful, not the filter.
   *
   * `sort` is stable, so posts on equal footing keep the order `usePosts` gives
   * them — newest first.
   */
  const relatedPosts = useMemo(() => {
    if (!post) return []
    const tags = new Set(post.tags.map((tag) => tag.toLowerCase()))
    // The category test is guarded: without it two *uncategorised* posts both
    // hold '' and score as a match, which ranks by an absence of information.
    const score = (candidate: (typeof posts)[number]) =>
      (post.category && candidate.category === post.category ? 2 : 0) +
      candidate.tags.reduce((total, tag) => total + Number(tags.has(tag.toLowerCase())), 0)

    return posts
      .filter((candidate) => candidate.slug !== post.slug)
      .sort((a, b) => score(b) - score(a))
      .slice(0, 3)
  }, [post, posts])

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
  const ctaHeading = post.ctaHeading || DEFAULT_CTA_HEADING
  const ctaBody = post.ctaBody || DEFAULT_CTA_BODY

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
        <header
          className={cn(
            'relative flex items-end overflow-hidden px-[clamp(20px,6vw,80px)] pb-[clamp(44px,6vw,76px)] pt-[clamp(120px,15vw,180px)]',
            post.coverImage
              ? 'min-h-[clamp(440px,62vh,680px)]'
              : 'bg-[linear-gradient(180deg,#1c1710_0%,#151109_55%,var(--ink)_100%)]',
          )}
        >
          {/*
            The cover is the header's background, but it stays a real <img> with
            alt text: `routeImages()` declares this file in sitemap.xml, and a CSS
            background is not crawlable, so that declaration would be a claim
            Google cannot verify. Absolutely positioned + object-cover gives the
            hero treatment without giving that up.
          */}
          {post.coverImage && (
            <>
              <SmartImage
                src={post.coverImage}
                alt={post.coverAlt || post.title}
                sizes="100vw"
                priority
                className="absolute inset-0 z-0 h-full w-full object-cover"
              />
              {/*
                Every stop is a fixed near-black, deliberately — this scrim does
                not follow the theme.

                The bottom stop used to be `--ink`, to resolve the photo into the
                page's own background instead of ending on a seam. That works in
                dark mode and fails in light, where `--ink` *is* the cream page
                background: the header washed out to near-white under text that
                is fixed light-on-dark (#f5efe6 title, 0.85-alpha excerpt), so
                the bottom third of the hero lost its contrast entirely.

                Everything drawn on this band — title, breadcrumb, tags, excerpt,
                and the unscrolled navbar floating above it — is styled for dark,
                so the band has to be dark in both themes. Ending on a fixed
                near-black is also what `PageHero` does (rgba(10,8,6,0.97)), so
                /blog/<slug> now meets the section below it exactly the way
                /about and /gallery already do.
              */}
              <div className="absolute inset-0 z-[1] bg-[linear-gradient(180deg,rgba(12,9,6,0.78)_0%,rgba(12,9,6,0.58)_34%,rgba(11,8,5,0.9)_76%,rgba(10,8,6,0.97)_100%)]" />
            </>
          )}

          <div className="relative z-[2] mx-auto w-full max-w-[820px]">
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

            {post.updatedAt && post.updatedAt !== post.publishedAt && (
              <p className="mt-2 text-[10.5px] uppercase tracking-[0.18em] text-[rgba(245,239,230,0.52)]">
                Updated <time dateTime={post.updatedAt}>{formatPostDate(post.updatedAt)}</time>
              </p>
            )}

            {(post.category || post.tags.length > 0) && (
              <div className="mt-6 flex flex-wrap gap-2" aria-label="Article topics">
                {/* Not `border-brass/45` — the palette is bare `var()` colors, so
                    an opacity modifier on it emits no CSS at all. */}
                {post.category && (
                  <span className="border border-brass px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-brass2">
                    {post.category}
                  </span>
                )}
                {post.tags.map((tag) => (
                  <span key={tag} className="border border-[rgba(245,239,230,0.18)] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[rgba(245,239,230,0.66)]">
                    {tag}
                  </span>
                ))}
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
          ---- Body ----
          Modest top padding: the header already carries its own bottom padding,
          and stacking both left a dead band between the excerpt and the first
          paragraph. `[&>*:first-child]:mt-0` stops a leading `##` in the markdown
          from adding its 3rem heading margin on top of that again.

          The contents rail shares this grid rather than sitting in a band of its
          own above the article: as a stack it scrolled away with the first
          paragraph, which is the moment it starts being useful. The reading
          column keeps its 820px measure — the rail is added beside it, never
          taken out of it.
        */}
        <section className="relative bg-ink px-[clamp(20px,6vw,80px)] pb-[clamp(50px,7vw,80px)] pt-[clamp(32px,4vw,48px)]">
          <div
            className={cn(
              'mx-auto grid gap-x-[clamp(28px,4vw,60px)] gap-y-10',
              tocHeadings.length > 1
                ? 'max-w-[1180px] lg:grid-cols-[240px_minmax(0,820px)]'
                : 'max-w-[820px]',
            )}
          >
            {tocHeadings.length > 1 && <TableOfContents headings={tocHeadings} />}
            <div className="min-w-0 [&>*:first-child]:mt-0">
              <PostBody headingIds={headingIds}>{post.body}</PostBody>
            </div>
          </div>
        </section>

        {/* ---- FAQ ---------------------------------------------------- */}
        {post.faqs.length > 0 && (
          <section className="relative bg-[linear-gradient(180deg,var(--ink),var(--panel)_50%,var(--ink))] px-[clamp(20px,6vw,80px)] py-[clamp(60px,9vw,110px)]">
            <div className="mx-auto max-w-[820px]">
              <Reveal className="mb-10">
                {/* `scroll-mt-28` matches the body headings in markdown.tsx —
                    without it the fixed navbar covers the target on a jump. */}
                <h2
                  id={sectionIds.faq}
                  className="scroll-mt-28 font-serif text-[clamp(1.6rem,3.2vw,2.3rem)] font-normal leading-[1.15] text-cream"
                >
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

        {relatedPosts.length > 0 && (
          <section className="relative bg-ink px-[clamp(20px,6vw,80px)] py-[clamp(48px,7vw,80px)]">
            <div className="mx-auto max-w-[820px] border-t border-line pt-10">
              <p className="text-[10.5px] uppercase tracking-[0.2em] text-brass2">Keep planning</p>
              <h2 className="mt-3 font-serif text-[clamp(1.6rem,3.2vw,2.3rem)] font-normal leading-[1.15] text-cream">
                Related guides
              </h2>
              <div className="mt-7 grid gap-4 sm:grid-cols-3">
                {relatedPosts.map((related) => (
                  <Link
                    key={related.slug}
                    to={postRoute(related.slug)}
                    className="group rounded-lg border border-line bg-panel p-5 transition-colors duration-300 hover:border-brass"
                  >
                    {related.category && (
                      <span className="text-[10px] uppercase tracking-[0.16em] text-brass2">
                        {related.category}
                      </span>
                    )}
                    <span className="mt-2 block font-serif text-[1.25rem] leading-[1.2] text-cream transition-colors group-hover:text-brass2">
                      {related.title}
                    </span>
                    <span className="mt-4 block text-[11px] uppercase tracking-[0.16em] text-brass2">
                      Read guide →
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ---- CTA ---------------------------------------------------- */}
        <section className="relative bg-ink px-[clamp(20px,6vw,80px)] pb-[clamp(70px,10vw,120px)] pt-[clamp(40px,6vw,70px)]">
          <div className="mx-auto max-w-[820px] border-t border-line pt-[clamp(40px,6vw,64px)] text-center">
            <Reveal>
              <h2
                id={sectionIds.cta}
                className="scroll-mt-28 font-serif text-[clamp(1.7rem,3.4vw,2.5rem)] font-normal leading-[1.15] text-cream"
              >
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
