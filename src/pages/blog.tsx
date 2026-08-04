import { Link } from 'react-router-dom'

import { venueImg } from '@/data/site'
import { usePosts } from '@/hooks/use-site-content'
import { postRoute } from '@/lib/seo'
import { formatPostDate } from '@/lib/post-format'
import { Reveal } from '@/components/effects/reveal'
import { SmartImage } from '@/components/ui/smart-image'
import { PageHero } from '@/components/layout/page-hero'

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
            <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post, i) => (
                <Reveal key={post.slug} delay={Math.min(i, 5) * 0.06}>
                  <article className="group h-full">
                    <Link to={postRoute(post.slug)} className="block">
                      <div className="relative mb-5 aspect-[3/2] overflow-hidden rounded-[2px] bg-panel">
                        {post.coverImage ? (
                          <SmartImage
                            src={post.coverImage}
                            alt={post.coverAlt || post.title}
                            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                            /* The first row is above the fold on most viewports. */
                            priority={i < 3}
                            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                          />
                        ) : (
                          <div className="grid h-full place-items-center font-serif text-[42px] text-line">
                            ∞
                          </div>
                        )}
                      </div>

                      {post.publishedAt && (
                        <time
                          dateTime={post.publishedAt}
                          className="text-[11px] uppercase tracking-[0.2em] text-brass2"
                        >
                          {formatPostDate(post.publishedAt)}
                        </time>
                      )}

                      <h3 className="mt-2.5 font-serif text-[clamp(1.25rem,2vw,1.55rem)] font-normal leading-[1.25] text-cream transition-colors group-hover:text-brass2">
                        {post.title}
                      </h3>

                      {post.excerpt && (
                        <p className="mt-3 text-[14.5px] font-light leading-[1.75] text-muted">
                          {post.excerpt}
                        </p>
                      )}

                      <span className="mt-4 inline-block text-[11px] uppercase tracking-[0.2em] text-brass2">
                        Read more →
                      </span>
                    </Link>
                  </article>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
