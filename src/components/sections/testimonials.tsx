import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Star } from '@phosphor-icons/react'
import GoogleReviewsWidgetModule from 'google-reviews-widget'

import { Reveal } from '@/components/effects/reveal'
import { Button } from '@/components/ui/button'
import { SectionHeading } from '@/components/ui/section-heading'
import { useNearViewport } from '@/hooks/use-near-viewport'
import { useTestimonials } from '@/hooks/use-site-content'
import {
  isGoogleReviewsResponse,
  type GoogleReview,
  type GoogleReviewsResponse,
} from '@/lib/google-reviews'

const GOOGLE_PLACE_ID = 'ChIJpyGeLm3VWoYRSg2J_y46wmk'
const WIDGET_INSTANCE_ID = 'BFnQb3gBYxetO8NZWHYM'

// `google-reviews-widget` ships a CommonJS `main` with no `exports` map and no
// `module` field, so its own `dist/index.mjs` is never picked up and the CJS
// interop nests the component at `.default`. Rendering the import directly
// throws "Element type is invalid ... but got: object". Unwrap it here rather
// than deep-importing `dist/index.mjs`, which would break if the package ever
// grows a proper exports map.
const GoogleReviewsWidget =
  (GoogleReviewsWidgetModule as unknown as { default?: typeof GoogleReviewsWidgetModule })
    .default ?? GoogleReviewsWidgetModule

type ReviewStatus = 'loading' | 'ready' | 'error'

type DisplayReview = {
  id: string
  name: string
  authorUrl: string
  avatar: string
  rating?: number
  text: string
  date: string
  googleReviewUrl: string
  source: 'google' | 'fallback'
}

const useGoogleReviews = (enabled: boolean) => {
  const [data, setData] = useState<GoogleReviewsResponse | null>(null)
  const [status, setStatus] = useState<ReviewStatus>('loading')

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()

    void fetch('/api/google-reviews', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Review endpoint returned ${response.status}`)
        const payload: unknown = await response.json()
        if (
          !isGoogleReviewsResponse(payload) ||
          payload.placeId !== GOOGLE_PLACE_ID ||
          payload.reviews.length === 0
        ) {
          throw new Error('Review endpoint returned an invalid payload')
        }
        return payload
      })
      .then((payload) => {
        setData(payload)
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        console.error('[testimonials] Live Google reviews are unavailable; using CMS fallback.', error)
        setStatus('error')
      })

    return () => controller.abort()
  }, [enabled])

  return { data, status }
}

const RatingStars = ({ rating, compact = false }: { rating: number; compact?: boolean }) => (
  <span
    role="img"
    aria-label={`${rating.toFixed(1)} out of 5 stars`}
    className="inline-flex items-center gap-0.5 text-brass2"
  >
    {Array.from({ length: 5 }, (_, index) => (
      <Star
        key={index}
        aria-hidden
        size={compact ? 13 : 17}
        weight="fill"
        className={index < Math.round(rating) ? 'opacity-100' : 'opacity-25'}
      />
    ))}
  </span>
)

const ReviewerAvatar = ({ review }: { review: DisplayReview }) => {
  const initials = review.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  return (
    <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-panel2 font-serif text-sm text-brass2">
      <span aria-hidden>{initials}</span>
      {review.avatar ? (
        <img
          src={review.avatar}
          alt={`${review.name}'s profile photo`}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-cover"
          onError={(event) => {
            event.currentTarget.hidden = true
          }}
        />
      ) : null}
    </span>
  )
}

const AuthorAttribution = ({ review }: { review: DisplayReview }) => {
  const content = (
    <>
      <ReviewerAvatar review={review} />
      <span className="min-w-0">
        <span className="block truncate font-serif text-[18px] text-brass2">
          {review.name}
        </span>
        {review.date ? (
          <span className="mt-0.5 block text-[11px] uppercase tracking-[0.16em] text-muted">
            {review.date}
          </span>
        ) : null}
      </span>
    </>
  )

  return review.authorUrl ? (
    <a
      href={review.authorUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open ${review.name}'s Google Maps profile`}
      className="flex min-w-0 items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brass"
    >
      {content}
    </a>
  ) : (
    <div className="flex min-w-0 items-center gap-3">{content}</div>
  )
}

const GoogleReviewCard = ({ review }: { review: DisplayReview }) => {
  const [expanded, setExpanded] = useState(false)
  const canExpand = review.text.length > 230

  return (
    <figure className="flex h-full flex-col border border-line bg-[rgba(201,168,106,0.03)] p-7 transition-colors duration-500 hover:border-brass hover:bg-[rgba(201,168,106,0.06)] sm:p-8">
      <div className="flex items-start justify-between gap-4">
        {review.rating !== undefined ? <RatingStars rating={review.rating} compact /> : (
          <span aria-hidden className="font-serif text-[42px] leading-[0.55] text-brass2">
            &ldquo;
          </span>
        )}
        {review.source === 'google' ? (
          <span
            translate="no"
            className="google-maps-attribution shrink-0 whitespace-nowrap rounded-sm bg-[#1f1f1f] px-2 py-1 text-[12px] font-normal not-italic tracking-normal text-white"
          >
            Google Maps
          </span>
        ) : null}
      </div>

      <blockquote
        className={`mt-5 flex-1 text-[15px] font-light italic leading-[1.8] text-cream/90 ${
          canExpand && !expanded ? 'line-clamp-4' : ''
        }`}
      >
        {review.text}
      </blockquote>

      {canExpand ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
          className="mt-2 self-start rounded-sm border-b border-brass/60 pb-0.5 text-[11px] uppercase tracking-[0.14em] text-brass2 transition-colors hover:text-brass focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brass"
        >
          {expanded ? 'Read less' : 'Read more'}
        </button>
      ) : null}

      <figcaption className="mt-6 border-t border-line pt-5">
        <div className="flex items-center justify-between gap-4">
          <AuthorAttribution review={review} />
          {review.googleReviewUrl ? (
            <a
              href={review.googleReviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`View ${review.name}'s review listing on Google Maps`}
              className="shrink-0 rounded-sm text-right text-[10px] uppercase tracking-[0.14em] text-muted underline decoration-line underline-offset-4 transition-colors hover:text-brass2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brass"
            >
              View on Maps
            </a>
          ) : null}
        </div>
      </figcaption>
    </figure>
  )
}

const GoogleRatingSummary = ({
  data,
  status,
}: {
  data: GoogleReviewsResponse | null
  status: ReviewStatus
}) => (
  <div className="mb-10 flex min-h-[62px] items-center justify-center text-center" aria-live="polite">
    {status === 'ready' && data ? (
      <div>
        <div className="flex items-center justify-center gap-2.5">
          <RatingStars rating={data.rating} />
          <strong className="font-serif text-2xl font-medium text-cream">
            {data.rating.toFixed(1)}
          </strong>
        </div>
        <p className="mt-1 text-[12px] font-light tracking-[0.04em] text-muted">
          Based on {data.reviewCount.toLocaleString('en-US')} Google reviews
        </p>
        <span className="sr-only">Reviews for {data.businessName}</span>
      </div>
    ) : status === 'loading' ? (
      <div role="status" aria-label="Loading Google review rating" className="flex flex-col items-center gap-2">
        <span className="h-4 w-36 animate-pulse rounded bg-line" />
        <span className="h-3 w-44 animate-pulse rounded bg-line" />
      </div>
    ) : (
      <p className="text-[12px] uppercase tracking-[0.18em] text-muted">
        Stories shared by our guests
      </p>
    )}
  </div>
)

const GoogleReviewsCarousel = ({ reviews }: { reviews: DisplayReview[] }) => {
  const trackRef = useRef<HTMLDivElement>(null)
  const trackId = useId()
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)

  const updateControls = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth)
    setCanGoBack(track.scrollLeft > 2)
    setCanGoForward(track.scrollLeft < maxScroll - 2)
  }, [])

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const observer = new ResizeObserver(updateControls)
    observer.observe(track)
    track.addEventListener('scroll', updateControls, { passive: true })
    const frame = requestAnimationFrame(updateControls)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      track.removeEventListener('scroll', updateControls)
    }
  }, [reviews.length, updateControls])

  const advance = (direction: 1 | -1) => {
    const track = trackRef.current
    const firstCard = track?.firstElementChild as HTMLElement | null
    if (!track || !firstCard) return
    const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 18
    track.scrollBy({ left: direction * (firstCard.offsetWidth + gap), behavior: 'smooth' })
  }

  return (
    <div>
      <div
        id={trackId}
        ref={trackRef}
        aria-label="Guest reviews"
        className="flex snap-x snap-mandatory items-stretch gap-[18px] overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {reviews.map((review) => (
          <div
            key={review.id}
            className="w-full shrink-0 snap-start sm:w-[calc((100%_-_18px)/2)] lg:w-[calc((100%_-_36px)/3)]"
          >
            <GoogleReviewCard review={review} />
          </div>
        ))}
      </div>

      <div className="mt-7 flex items-center justify-between gap-5">
        <p className="max-w-[520px] text-[11px] font-light leading-relaxed text-muted">
          {reviews[0]?.source === 'google'
            ? 'Reviews are shown newest first.'
            : 'Showing guest stories while live reviews are unavailable.'}
        </p>
        <div className="flex shrink-0 gap-2.5">
          <button
            type="button"
            aria-label="Previous review"
            aria-controls={trackId}
            disabled={!canGoBack}
            onClick={() => advance(-1)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-cream transition-colors duration-300 hover:border-brass hover:text-brass2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brass disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ArrowLeft size={18} aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Next review"
            aria-controls={trackId}
            disabled={!canGoForward}
            onClick={() => advance(1)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-cream transition-colors duration-300 hover:border-brass hover:text-brass2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brass disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ArrowRight size={18} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Mounts the beaver.codes widget and reports once it has actually painted.
 *
 * The widget renders an empty `div[data-instance-id]`, appends a remote
 * `<script>` to it in an effect, and that script injects the reviews later — so
 * the div is empty in the prerendered HTML and stays empty if the script is
 * blocked, 404s or the plan lapses. Anything in there that is not the injected
 * script means the reviews arrived, which is the only safe cue for swapping the
 * CMS testimonials out: hiding them on mount would leave a blank section
 * whenever the widget fails.
 */
const GoogleReviewsWidgetPanel = ({ onReady }: { onReady: () => void }) => {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const hasRendered = () =>
      Boolean(host.querySelector('div[data-instance-id] > *:not(script)'))

    if (hasRendered()) {
      onReady()
      return
    }

    const observer = new MutationObserver(() => {
      if (!hasRendered()) return
      observer.disconnect()
      onReady()
    })
    observer.observe(host, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [onReady])

  return (
    <div ref={hostRef}>
      <GoogleReviewsWidget instanceId={WIDGET_INSTANCE_ID} />
    </div>
  )
}

/** Social-proof band: live Google reviews with the CMS testimonials as a resilient fallback. */
export const Testimonials = () => {
  const fallbackTestimonials = useTestimonials()
  /*
   * Live reviews load when the section approaches, not with the page. This band
   * sits ~5,000 px down the homepage, and the beaver.codes widget alone is a
   * script, three Firestore round trips and twenty avatar images that kept the
   * network busy until ~4.8 s into a mobile load — for something nobody had
   * scrolled to. The CMS carousel is what's prerendered and indexed either way.
   */
  const { ref: sectionRef, near } = useNearViewport<HTMLElement>('800px')
  const { data, status } = useGoogleReviews(near)
  // Starts false on the server and on the client's first render, so the
  // prerendered markup and the hydrated tree agree.
  const [widgetReady, setWidgetReady] = useState(false)
  const handleWidgetReady = useCallback(() => setWidgetReady(true), [])

  const reviews: DisplayReview[] = data?.reviews.length
    ? data.reviews.map((review: GoogleReview) => ({ ...review, source: 'google' as const }))
    : fallbackTestimonials.map((testimonial, index) => ({
        id: `fallback-${testimonial.name}-${index}`,
        name: testimonial.name,
        authorUrl: '',
        avatar: '',
        text: testimonial.quote,
        date: testimonial.event,
        googleReviewUrl: '',
        source: 'fallback' as const,
      }))

  return (
    <section
      ref={sectionRef}
      id="testimonials"
      className="relative flex min-h-screen flex-col justify-center bg-[linear-gradient(180deg,var(--ink),var(--panel)_50%,var(--ink))] px-[clamp(20px,6vw,80px)] py-[clamp(70px,10vw,130px)]"
    >
      <div className="mx-auto w-full min-w-0 max-w-content">
        <Reveal className="mb-8 text-center">
          <SectionHeading
            eyebrow="Kind words"
            title="Loved by couples & families"
            align="center"
          />
        </Reveal>

        {widgetReady ? null : <GoogleRatingSummary data={data} status={status} />}

        <Reveal delay={0.08}>
          {/*
            Both are mounted once the section is near: the widget needs to be in
            the DOM for its script to load, and the CMS carousel is what the prerenderer writes into
            dist/*.html — effects don't run during SSR, so the widget contributes
            an empty div there. Keeping the carousel as the server-rendered
            content means crawlers get real reviews and the client's first render
            matches the prerendered markup, so hydration holds; the swap happens
            afterwards, in an effect, once the widget confirms it painted.
          */}
          {near ? <GoogleReviewsWidgetPanel onReady={handleWidgetReady} /> : null}
          {widgetReady ? null : <GoogleReviewsCarousel reviews={reviews} />}
        </Reveal>

        {status === 'ready' && data?.googleMapsUrl ? (
          <Reveal delay={0.14} className="mt-10 text-center">
            <Button asChild variant="outline">
              <a href={data.googleMapsUrl} target="_blank" rel="noopener noreferrer">
                View All Google Reviews
              </a>
            </Button>
          </Reveal>
        ) : null}
      </div>
    </section>
  )
}
