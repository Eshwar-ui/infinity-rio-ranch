import { Link } from 'react-router-dom'

import { cn } from '@/lib/utils'
import { venueImg } from '@/data/site'
import { usePosts } from '@/hooks/use-site-content'
import { postRoute } from '@/lib/seo'
import { formatPostDate } from '@/lib/post-format'
import { Reveal } from '@/components/effects/reveal'
import { SmartImage } from '@/components/ui/smart-image'
import { PageHero } from '@/components/layout/page-hero'

type Post = ReturnType<typeof usePosts>[number]

/**
 * A standard blog card: cover, date, title, excerpt, read-more.
 *
 * `h-full` + `mt-auto` on the footer is what keeps a row of cards the same
 * height with the "Read more" lines level, whatever length the copy runs; the
 * clamps stop one long title or excerpt from setting the height for everyone.
 */
const PostCard = ({ post, priority }: { post: Post; priority?: boolean }) => (
  <article className="h-full">
    <Link
      to={postRoute(post.slug)}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-line bg-panel transition-all duration-500 hover:-translate-y-1.5 hover:border-brass hover:shadow-[0_22px_50px_-30px_rgba(0,0,0,0.55)]"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-panel2">
        {post.coverImage ? (
          <SmartImage
            src={post.coverImage}
            alt={post.coverAlt || post.title}
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            priority={priority}
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center font-serif text-[46px] text-line">∞</div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-6">
        {post.publishedAt && (
          <time
            dateTime={post.publishedAt}
            className="text-[11px] uppercase tracking-[0.18em] text-brass2"
          >
            {formatPostDate(post.publishedAt)}
          </time>
        )}

        <h3 className="mt-3 line-clamp-2 font-serif text-[1.35rem] font-normal leading-[1.3] text-cream transition-colors duration-300 group-hover:text-brass2">
          {post.title}
        </h3>

        {post.excerpt && (
          <p className="mt-3 line-clamp-3 text-[14.5px] font-light leading-[1.7] text-muted">
            {post.excerpt}
          </p>
        )}

        <span className="mt-auto flex items-center gap-2 pt-5 text-[11px] uppercase tracking-[0.18em] text-brass2">
          Read more
          <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
            →
          </span>
        </span>
      </div>
    </Link>
  </article>
)

/**
 * The blog index.
 *
 * Copy here is hardcoded rather than driven by `site_copy`: the headings are
 * structural ("Latest", "Planning guides"), not brand voice the owner tunes,
 * and every string that *does* vary — titles, excerpts, dates — comes from the
 * posts themselves.
 */
export const BlogPage = () => {
  const posts = usePosts()

  /**
   * With one or two posts the track has to lose columns, not just width — a
   * narrower container over `lg:grid-cols-3` still splits into three and renders
   * the card as a sliver.
   */
  const gridClass =
    posts.length === 1
      ? 'max-w-[420px]'
      : posts.length === 2
        ? 'max-w-[880px] sm:grid-cols-2'
        : 'sm:grid-cols-2 lg:grid-cols-3'

  return (
    <div style={{ animation: 'riseIn .6s ease forwards' }}>
      <PageHero
        eyebrow="Guides & stories"
        title="The Blog"
        crumb="Blog"
        image={venueImg(4)}
      />

      <section className="relative bg-ink px-[clamp(20px,6vw,80px)] pb-[clamp(70px,10vw,120px)] pt-[clamp(50px,7vw,80px)]">
        <div className="mx-auto max-w-wide">
          <Reveal className="mx-auto mb-14 max-w-[720px] text-center">
            <h2 className="mb-4 font-serif text-[clamp(1.6rem,3.2vw,2.4rem)] font-normal leading-[1.15] text-cream">
              Planning a wedding or event in the Texas Hill Country
            </h2>
            <p className="text-[15.5px] font-light leading-[1.85] text-muted">
              Practical guides from the team at Infinity at Rio Ranch — how to
              compare venues, what to ask before you book, and how to plan around
              Texas weather.
            </p>
          </Reveal>

          {posts.length === 0 ? (
            <p className="py-16 text-center text-[15px] font-light text-muted">
              No articles published yet — check back soon.
            </p>
          ) : (
            <div className={cn('mx-auto grid gap-8', gridClass)}>
              {posts.map((post, i) => (
                /* Stagger by column so the fifteenth card isn't waiting a second. */
                <Reveal key={post.slug} delay={(i % 3) * 0.08}>
                  {/* The first row is above the fold on most viewports. */}
                  <PostCard post={post} priority={i < 3} />
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
