import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Link } from 'react-router-dom'

import { SmartImage } from '@/components/ui/smart-image'

/**
 * Markdown renderer for blog post bodies.
 *
 * Every element is mapped explicitly rather than styled with a `prose` sheet:
 * the site's typography is bespoke (Cormorant Garamond headings against Jost
 * body copy, a hand-tuned scale) and a generic typography plugin would render
 * posts that look like a different website. Mapping here also means the same
 * component tree renders at prerender time and in the browser, which is what
 * keeps hydration intact.
 *
 * Deliberately *not* `dangerouslySetInnerHTML` over a markdown-to-HTML string.
 * Only admins can write posts, so this isn't primarily an XSS story — it is
 * that React elements let images go through `<SmartImage>` and internal links
 * through the router, neither of which is possible with an HTML blob.
 */

/** Internal links use the router; external ones open safely in a new tab. */
const isInternal = (href: string) => href.startsWith('/') && !href.startsWith('//')

export const PostBody = ({
  children,
  headingIds = {},
}: {
  children: string
  /** Heading IDs derived from the source body, for table-of-contents links. */
  headingIds?: Record<number, string>
}) => (
  <Markdown
    remarkPlugins={[remarkGfm]}
    components={{
      /*
       * h1 is the post title, rendered by the page — so a `#` in the body maps
       * to h2. Two h1s on a page is a real (if minor) structural SEO fault, and
       * the owner writing `#` out of habit shouldn't be able to cause it.
       */
      h1: ({ children, node }) => (
        <h2
          id={headingIds[node?.position?.start.line ?? 0]}
          className="mb-4 mt-12 scroll-mt-28 font-serif text-[clamp(1.6rem,3.2vw,2.3rem)] font-normal leading-[1.2] text-cream"
        >
          {children}
        </h2>
      ),
      h2: ({ children, node }) => (
        <h2
          id={headingIds[node?.position?.start.line ?? 0]}
          className="mb-4 mt-12 scroll-mt-28 font-serif text-[clamp(1.6rem,3.2vw,2.3rem)] font-normal leading-[1.2] text-cream"
        >
          {children}
        </h2>
      ),
      h3: ({ children, node }) => (
        <h3
          id={headingIds[node?.position?.start.line ?? 0]}
          className="mb-3 mt-9 scroll-mt-28 font-serif text-[clamp(1.3rem,2.4vw,1.7rem)] font-normal leading-[1.25] text-cream"
        >
          {children}
        </h3>
      ),
      h4: ({ children, node }) => (
        <h4
          id={headingIds[node?.position?.start.line ?? 0]}
          className="mb-2.5 mt-7 scroll-mt-28 text-[15px] font-medium uppercase tracking-[0.14em] text-brass2"
        >
          {children}
        </h4>
      ),
      p: ({ children }) => (
        <p className="mb-5 text-[15.5px] font-light leading-[1.85] text-muted">{children}</p>
      ),
      /*
       * The brass dash is scoped to `ul` rather than set on `li`, because `li`
       * has no idea which list it is in — styling it globally drew a dash
       * *and* a number on every ordered-list item. Ordered lists keep their
       * real numbers, which is what makes a "questions to ask" list readable.
       */
      ul: ({ children }) => (
        <ul className="mb-6 list-none space-y-2.5 pl-0 [&>li]:relative [&>li]:pl-6 [&>li]:before:absolute [&>li]:before:left-0 [&>li]:before:top-[0.85em] [&>li]:before:h-px [&>li]:before:w-3 [&>li]:before:bg-brass">
          {children}
        </ul>
      ),
      ol: ({ children }) => (
        <ol className="mb-6 list-decimal space-y-2.5 pl-5 marker:font-medium marker:text-brass">
          {children}
        </ol>
      ),
      li: ({ children }) => (
        <li className="text-[15.5px] font-light leading-[1.8] text-muted">{children}</li>
      ),
      strong: ({ children }) => <strong className="font-medium text-cream">{children}</strong>,
      em: ({ children }) => <em className="italic">{children}</em>,
      /*
       * The paragraph overrides are load-bearing: markdown wraps a blockquote's
       * text in <p>, which would otherwise pick up the `p` mapping's 15.5px
       * muted body style and undo the pull-quote entirely. `text-[length:...]`
       * sets size, `text-cream` sets colour — spelled out so they don't read as
       * two competing colour utilities.
       */
      blockquote: ({ children }) => (
        <blockquote className="my-8 border-l-2 border-brass py-1 pl-6 font-serif text-[clamp(1.15rem,2.2vw,1.45rem)] font-light italic leading-[1.5] text-cream [&_p]:mb-0 [&_p]:text-[length:inherit] [&_p]:font-light [&_p]:leading-[inherit] [&_p]:text-cream">
          {children}
        </blockquote>
      ),
      a: ({ href, children }) => {
        const to = href ?? ''
        const className =
          'text-brass2 underline decoration-brass/40 underline-offset-4 transition-colors hover:decoration-brass'
        return isInternal(to) ? (
          <Link to={to} className={className}>
            {children}
          </Link>
        ) : (
          <a href={to} target="_blank" rel="noopener noreferrer" className={className}>
            {children}
          </a>
        )
      },
      /*
       * Markdown gives us no dimensions, so `SmartImage` falls back to a plain
       * <img> for CMS uploads. `sizes` is truthful for the article column below.
       */
      img: ({ src, alt }) => (
        <SmartImage
          src={typeof src === 'string' ? src : ''}
          alt={alt ?? ''}
          sizes="(min-width: 820px) 760px, 100vw"
          className="my-8 h-auto w-full rounded-[2px]"
        />
      ),
      hr: () => <hr className="my-12 border-0 border-t border-line" />,
      code: ({ children }) => (
        <code className="rounded-[2px] bg-panel px-1.5 py-0.5 text-[0.9em] text-brass2">
          {children}
        </code>
      ),
      // GFM tables — wrapped so a wide table scrolls itself instead of the page.
      table: ({ children }) => (
        <div className="my-8 overflow-x-auto">
          <table className="w-full border-collapse text-left text-[14.5px]">{children}</table>
        </div>
      ),
      th: ({ children }) => (
        <th className="border-b border-line pb-2.5 pr-6 text-[12px] font-medium uppercase tracking-[0.12em] text-brass2">
          {children}
        </th>
      ),
      td: ({ children }) => (
        <td className="border-b border-line py-3 pr-6 font-light text-muted">{children}</td>
      ),
    }}
  >
    {children}
  </Markdown>
)
