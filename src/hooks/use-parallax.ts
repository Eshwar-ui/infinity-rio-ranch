import { useEffect, useRef } from 'react'

/**
 * Translates an element vertically as the page scrolls, at `speed` of scrollY.
 * Ports the prototype's [data-parallax]. Respects prefers-reduced-motion.
 *
 * Attachment waits for browser idle. The priming `onScroll()` call does a
 * `getBoundingClientRect()` — a forced synchronous layout — and then writes a
 * transform onto the element. On the homepage that element is the LCP image's
 * container, so doing it during hydration made the browser lay out and
 * composite the hero before it had painted it. Purely decorative motion: there
 * is nothing to see at scroll position 0 anyway, since the transform resolves
 * to ~0 until the visitor actually scrolls.
 */
export const useParallax = <T extends HTMLElement = HTMLDivElement>(
  speed = 0.16,
) => {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        // Based on the element's own distance from the viewport, not total
        // page scroll — keeps the shift bounded regardless of how far down
        // the page this element sits.
        const top = el.getBoundingClientRect().top
        el.style.transform = `translate3d(0, ${-top * speed}px, 0)`
        ticking = false
      })
    }

    const attach = () => {
      window.addEventListener('scroll', onScroll, { passive: true })
      onScroll()
    }

    const supportsIdle = typeof window.requestIdleCallback === 'function'
    const id = supportsIdle
      ? window.requestIdleCallback(attach, { timeout: 2000 })
      : window.setTimeout(attach, 600)

    return () => {
      if (supportsIdle) window.cancelIdleCallback(id as number)
      else window.clearTimeout(id)
      window.removeEventListener('scroll', onScroll)
    }
  }, [speed])

  return ref
}
