import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

import { buildHead } from '@/lib/seo'

/**
 * Upserts a tag rather than appending one, so client-side navigation *replaces*
 * the tags the prerenderer baked into the HTML instead of duplicating them.
 */
const upsert = <T extends HTMLElement>(
  selector: string,
  create: () => T,
): T => {
  const existing = document.head.querySelector<T>(selector)
  if (existing) return existing
  const el = create()
  document.head.appendChild(el)
  return el
}

const setMeta = (attr: 'name' | 'property', key: string, content: string) => {
  const el = upsert<HTMLMetaElement>(`meta[${attr}="${key}"]`, () => {
    const meta = document.createElement('meta')
    meta.setAttribute(attr, key)
    return meta
  })
  el.setAttribute('content', content)
}

/**
 * Keeps <title>, meta, canonical and JSON-LD in sync with the current route.
 * Mounted once in RootLayout; the same data is baked statically at build time
 * by the prerenderer (see src/lib/seo.ts).
 */
export const useDocumentHead = () => {
  const { pathname } = useLocation()

  useEffect(() => {
    const head = buildHead(pathname)

    document.title = head.title

    for (const [name, content] of Object.entries(head.metaName)) {
      setMeta('name', name, content)
    }
    for (const [property, content] of Object.entries(head.metaProperty)) {
      setMeta('property', property, content)
    }

    // An empty canonical means "this URL has no canonical form" (the 404 page).
    // Drop the tag rather than pointing it at the mistyped URL.
    if (head.canonical) {
      const canonical = upsert<HTMLLinkElement>('link[rel="canonical"]', () => {
        const link = document.createElement('link')
        link.rel = 'canonical'
        return link
      })
      canonical.href = head.canonical
    } else {
      document.head.querySelector('link[rel="canonical"]')?.remove()
    }

    // Structured data is route-specific: clear the previous route's blocks.
    // Keyed blocks (data-seo-id) belong to a page component — leave those alone.
    for (const node of document.head.querySelectorAll('script[data-seo="jsonld"]')) {
      node.remove()
    }
    for (const { id, doc } of head.jsonLd) {
      if (id) continue
      const script = document.createElement('script')
      script.type = 'application/ld+json'
      script.dataset.seo = 'jsonld'
      script.textContent = JSON.stringify(doc)
      document.head.appendChild(script)
    }
  }, [pathname])
}

/**
 * Publishes one extra JSON-LD document, keyed by `id` so it can be replaced as
 * the data changes. Used by the contact page to emit FAQ schema built from the
 * live CMS answers, keeping the markup identical to what visitors actually see.
 */
export const useJsonLd = (id: string, doc: unknown | null) => {
  useEffect(() => {
    if (!doc) return
    const selector = `script[data-seo-id="${id}"]`
    const script = upsert<HTMLScriptElement>(selector, () => {
      const el = document.createElement('script')
      el.type = 'application/ld+json'
      el.dataset.seoId = id
      return el
    })
    script.textContent = JSON.stringify(doc)
    return () => {
      document.head.querySelector(selector)?.remove()
    }
  }, [id, doc])
}
