import { useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'
import {
  events as eventsFallback,
  faqs as faqsFallback,
  gallery as galleryList,
  galleryTall,
  galleryWide,
  testimonials as testimonialsFallback,
  type EventItem,
  type Faq,
  type GalleryCategory,
  type Testimonial,
} from '@/data/site'

export type GalleryTileData = {
  label: string
  cat: GalleryCategory
  src: string
  span: 'tall' | 'wide' | null
  featured: boolean
}

/** Fallback built from the static gallery + its index-keyed spans / featured shot. */
const galleryFallback: GalleryTileData[] = galleryList.map((g, i) => ({
  label: g.label,
  cat: g.cat,
  src: g.src,
  span: galleryTall.has(i) ? 'tall' : galleryWide.has(i) ? 'wide' : null,
  featured: i === 12,
}))

/**
 * Reads a published, ordered content list from Supabase, falling back to the
 * hardcoded site.ts array on any error or empty result — so the public site can
 * never render an empty section even if the DB is unreachable.
 */
function useContent<T>(
  table: string,
  fallback: T[],
  map: (row: Record<string, any>) => T,
): T[] {
  const [items, setItems] = useState<T[]>(fallback)

  useEffect(() => {
    let active = true
    supabase
      .from(table)
      .select('*')
      .eq('published', true)
      .order('sort', { ascending: true })
      .then(({ data, error }) => {
        if (active && !error && data && data.length > 0) setItems(data.map(map))
      })
    return () => {
      active = false
    }
    // `map`/`fallback` are stable per call site; refetch only when the table changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table])

  return items
}

export const useTestimonials = (): Testimonial[] =>
  useContent<Testimonial>('testimonials', testimonialsFallback, (r) => ({
    quote: r.quote,
    name: r.name,
    event: r.event ?? '',
  }))

/** `n` (01, 02…) is derived from order, so the DB doesn't store display numbers. */
export const useEvents = (): EventItem[] =>
  useContent<EventItem>('events', eventsFallback, (r) => ({
    n: '',
    title: r.title,
    blurb: r.blurb ?? '',
    image: r.image ?? '',
  })).map((e, i) => ({ ...e, n: String(i + 1).padStart(2, '0') }))

export const useFaqs = (): Faq[] =>
  useContent<Faq>('faqs', faqsFallback, (r) => ({
    q: r.question,
    a: r.answer,
  }))

export const useGallery = (): GalleryTileData[] =>
  useContent<GalleryTileData>('gallery', galleryFallback, (r) => ({
    label: r.label,
    cat: r.cat,
    src: r.src,
    span: r.span ?? null,
    featured: !!r.featured,
  }))
