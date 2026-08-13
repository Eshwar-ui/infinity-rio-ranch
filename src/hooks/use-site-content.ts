import { useCallback, useEffect, useMemo, useState } from 'react'

import { DEFAULT_COPY } from '@/data/copy'
import {
  SEEDED_COPY,
  contactFrom,
  postBySlug,
  seededAmenities,
  seededEvents,
  seededFaqs,
  seededGallery,
  seededList,
  seededPosts,
  seededTestimonials,
  type ContactDetails,
  type GalleryTileData,
  type Post,
} from '@/lib/content-snapshot'
import type { Amenity, EventItem, Faq, Testimonial } from '@/data/site'

export type { GalleryTileData, Post, Stat } from '@/lib/content-snapshot'

/**
 * The Supabase client, loaded once the browser has nothing better to do.
 *
 * Every public page already renders from the build-time snapshot, so this
 * refetch exists only to pick up CMS edits published since the last deploy —
 * worth doing, worth doing *last*. Fetching it on mount put 199 kB of parse and
 * a network round trip inside the window Lighthouse measures, on a phone that
 * is still laying out the page.
 *
 * One promise for the whole page: a dozen hooks calling this share a single
 * import and a single idle callback. The 2.5 s timeout is the ceiling, not the
 * expectation — `requestIdleCallback` normally fires within a few hundred ms of
 * load — and it guarantees the refresh still happens on browsers that never go
 * idle. Falls straight through on the server, where there is no window and the
 * effects never run anyway.
 */
let supabaseModule: Promise<typeof import('@/lib/supabase')> | null = null
const supabaseWhenIdle = () =>
  (supabaseModule ??= new Promise((resolve) => {
    const load = () => resolve(import('@/lib/supabase'))
    if (typeof window === 'undefined') return load()
    // Safari has no requestIdleCallback; a timeout is the honest substitute.
    const idle = (window as { requestIdleCallback?: (cb: () => void, o?: object) => void })
      .requestIdleCallback
    if (idle) idle(load, { timeout: 2500 })
    else setTimeout(load, 1200)
  }))

/**
 * Reads a published, ordered content list from Supabase, starting from the
 * build-time snapshot so the first paint is never empty and never disagrees
 * with the prerendered HTML.
 *
 * The Supabase client is imported dynamically: it's ~110 kB and nothing on first
 * paint needs it, since the seeded data renders immediately. Keeping it out of
 * the entry chunk is worth more than the one-tick delay before edits published
 * since the last deploy arrive.
 */
function useContent<T>(
  table: string,
  initial: T[],
  map: (row: Record<string, any>) => T,
): T[] {
  const [items, setItems] = useState<T[]>(initial)

  useEffect(() => {
    let active = true
    supabaseWhenIdle()
      .then(({ supabase }) =>
        supabase
          .from(table)
          .select('*')
          .eq('published', true)
          .order('sort', { ascending: true }),
      )
      .then(({ data, error }) => {
        if (active && !error && data && data.length > 0) setItems(data.map(map))
      })
    return () => {
      active = false
    }
    // `map`/`initial` are stable per call site; refetch only when the table changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table])

  return items
}

// ============================================================================
//  Keyed page copy
// ============================================================================

/**
 * One in-flight request shared by every `useCopy` caller on the page. Without
 * it each section needing a string would issue its own `site_copy` select.
 */
let copyRequest: Promise<Record<string, string> | null> | null = null

const fetchCopy = () => {
  copyRequest ??= supabaseWhenIdle()
    .then(({ supabase }) => supabase.from('site_copy').select('key,value'))
    .then(({ data, error }) => {
      if (error || !data || data.length === 0) return null
      const next: Record<string, string> = {}
      for (const row of data) {
        // An empty string in the CMS means "fall back", not "render nothing".
        if (row.value) next[row.key] = row.value
      }
      return next
    })
    .catch(() => null)
  return copyRequest
}

/**
 * Returns a lookup for editable strings: `t('home.hero.eyebrow')`.
 *
 * Resolution is snapshot → `copy.defaults.json`, so an unknown key still renders
 * its shipped text rather than a blank element, and a key that exists nowhere
 * returns '' instead of throwing mid-render.
 */
export const useCopy = () => {
  const [copy, setCopy] = useState<Record<string, string>>(SEEDED_COPY)

  useEffect(() => {
    let active = true
    void fetchCopy().then((live) => {
      if (active && live) setCopy((prev) => ({ ...prev, ...live }))
    })
    return () => {
      active = false
    }
  }, [])

  return useCallback((key: string) => copy[key] ?? DEFAULT_COPY[key] ?? '', [copy])
}

/** Contact details from the editable copy keys, with links derived. */
export const useContact = (): ContactDetails => {
  const t = useCopy()
  return useMemo(() => contactFrom(t), [t])
}

// ============================================================================
//  Content lists
// ============================================================================

export const useTestimonials = (): Testimonial[] =>
  useContent<Testimonial>('testimonials', seededTestimonials, (r) => ({
    quote: r.quote,
    name: r.name,
    event: r.event ?? '',
  }))

/** `n` (01, 02…) is derived from order, so the DB doesn't store display numbers. */
export const useEvents = (): EventItem[] =>
  useContent<EventItem>('events', seededEvents, (r) => ({
    n: '',
    title: r.title,
    blurb: r.blurb ?? '',
    image: r.image ?? '',
  })).map((e, i) => ({ ...e, n: String(i + 1).padStart(2, '0') }))

export const useFaqs = (): Faq[] =>
  useContent<Faq>('faqs', seededFaqs, (r) => ({ q: r.question, a: r.answer }))

export const useGallery = (): GalleryTileData[] =>
  useContent<GalleryTileData>('gallery', seededGallery, (r) => ({
    label: r.label,
    cat: r.cat,
    src: r.src,
    span: r.span ?? null,
    featured: !!r.featured,
  }))

export const useAmenities = (): Amenity[] =>
  useContent<Amenity>('amenities', seededAmenities, (r) => ({
    icon: r.icon ?? '',
    title: r.title,
    sub: r.sub ?? '',
  }))

// ============================================================================
//  Blog posts
// ============================================================================

/**
 * Postgres row → the shape the snapshot and the pages use.
 *
 * Kept identical to the mapping in `scripts/pull-content.mjs`: the prerendered
 * markup comes from that one and the browser's re-render from this one, so any
 * difference between them is a hydration mismatch.
 */
export const mapPostRow = (r: Record<string, any>): Post => ({
  slug: r.slug,
  title: r.title,
  excerpt: r.excerpt ?? '',
  body: r.body ?? '',
  coverImage: r.cover_image ?? '',
  coverAlt: r.cover_alt ?? '',
  seoTitle: r.seo_title ?? '',
  seoDescription: r.seo_description ?? '',
  category: r.category ?? '',
  tags: Array.isArray(r.tags) ? r.tags.map((tag: unknown) => String(tag)).filter(Boolean) : [],
  primaryQuery: r.primary_query ?? '',
  author: r.author ?? '',
  faqs: Array.isArray(r.faqs)
    ? r.faqs.filter((f: any) => f?.q && f?.a).map((f: any) => ({ q: String(f.q), a: String(f.a) }))
    : [],
  ctaHeading: r.cta_heading ?? '',
  ctaBody: r.cta_body ?? '',
  publishedAt: r.published_at ?? null,
  updatedAt: r.updated_at ?? null,
})

const POST_COLUMNS =
  'slug,title,excerpt,body,cover_image,cover_alt,seo_title,seo_description,category,tags,primary_query,author,faqs,cta_heading,cta_body,published_at,updated_at'

/**
 * What 0008 shipped, without the `category`/`tags`/`primary_query` 0010 added.
 *
 * PostgREST rejects the *whole* select with a 400 (42703) when one column is
 * absent, so on a project that hasn't had 0010 applied every post query failed
 * and the blog stayed on the build-time snapshot — which is how a published
 * cover image stopped appearing while the row in the DB had one all along.
 * A missing optional field should cost that field, not the article.
 */
const CORE_POST_COLUMNS =
  'slug,title,excerpt,body,cover_image,cover_alt,seo_title,seo_description,author,faqs,cta_heading,cta_body,published_at,updated_at'

type PostQuery<T> = PromiseLike<{ data: T | null; error: { code?: string } | null }>

/** Runs a post query, retrying once without the 0010 columns if they're absent. */
const withPostColumns = async <T>(run: (columns: string) => PostQuery<T>) => {
  const first = await run(POST_COLUMNS)
  // 42703 = undefined_column. Anything else is a real failure and stays one.
  return first.error?.code === '42703' ? run(CORE_POST_COLUMNS) : first
}

/** Published posts, newest first — seeded from the snapshot, then refreshed. */
export const usePosts = (): Post[] => {
  const [posts, setPosts] = useState<Post[]>(seededPosts)

  useEffect(() => {
    let active = true
    void supabaseWhenIdle()
      .then(({ supabase }) =>
        withPostColumns((columns) =>
          supabase
            .from('posts')
            .select(columns)
            .eq('published', true)
            .order('published_at', { ascending: false }),
        ),
      )
      .then(({ data, error }) => {
        // Unlike the other lists, an empty result is meaningful here: the owner
        // may have unpublished the only post. Only a genuine error is ignored.
        if (active && !error && data) setPosts(data.map(mapPostRow))
      })
    return () => {
      active = false
    }
  }, [])

  return posts
}

/**
 * A single post by slug.
 *
 * `loading` exists so the page can tell "no such post" from "haven't looked
 * yet". On a prerendered post the snapshot already holds it, so the first
 * client render matches the server's and hydration holds; only a client-side
 * navigation to a slug published since the last build ever waits.
 */
export const usePost = (slug: string | undefined): { post?: Post; loading: boolean } => {
  const seeded = slug ? postBySlug(slug) : undefined
  const [post, setPost] = useState<Post | undefined>(seeded)
  const [loading, setLoading] = useState(!seeded)

  useEffect(() => {
    if (!slug) return
    let active = true
    setPost(postBySlug(slug))
    setLoading(!postBySlug(slug))

    void supabaseWhenIdle()
      .then(({ supabase }) =>
        withPostColumns((columns) =>
          supabase
            .from('posts')
            .select(columns)
            .eq('slug', slug)
            .eq('published', true)
            .maybeSingle(),
        ),
      )
      .then(({ data, error }) => {
        if (!active) return
        if (!error && data) setPost(mapPostRow(data))
        else if (!error && !data) setPost(undefined)
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [slug])

  return { post, loading }
}

/**
 * One of the flat string lists in `list_items` — `included` or `event_types`.
 * They share a table because neither has any structure beyond order.
 */
export const useList = (list: string): string[] => {
  const [items, setItems] = useState<string[]>(() => seededList(list))

  useEffect(() => {
    let active = true
    supabaseWhenIdle()
      .then(({ supabase }) =>
        supabase
          .from('list_items')
          .select('value')
          .eq('list', list)
          .eq('published', true)
          .order('sort', { ascending: true }),
      )
      .then(({ data, error }) => {
        if (active && !error && data && data.length > 0) {
          setItems(data.map((r) => r.value as string))
        }
      })
    return () => {
      active = false
    }
  }, [list])

  return items
}
