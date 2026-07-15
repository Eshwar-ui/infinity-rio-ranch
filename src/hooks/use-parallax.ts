import { useEffect, useRef } from 'react'

/**
 * Translates an element vertically as the page scrolls, at `speed` of scrollY.
 * Ports the prototype's [data-parallax]. Respects prefers-reduced-motion.
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

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [speed])

  return ref
}
