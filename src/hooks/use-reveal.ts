import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/** useLayoutEffect warns during the build-time prerender; there it's a no-op anyway. */
const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect

/**
 * Scroll-reveal via IntersectionObserver — ports the prototype's [data-reveal].
 * Returns a ref to attach and a boolean once the element has entered the viewport.
 */
export const useReveal = <T extends HTMLElement = HTMLDivElement>() => {
  const ref = useRef<T>(null)
  /**
   * Starts revealed on both the server and the client's first render — that's
   * what makes the markup hydratable. There is no scrolling during the
   * prerender, so an unrevealed tree would also bake every section in at
   * opacity 0 and hand crawlers a page of invisible text.
   *
   * The layout effect below then un-reveals anything below the fold, before the
   * browser paints. Those elements fade out off-screen where nobody sees it, and
   * fade back in on scroll as designed.
   */
  const [shown, setShown] = useState(true)
  const settled = useRef(false)

  useIsomorphicLayoutEffect(() => {
    const el = ref.current
    if (!el || settled.current) return

    // On screen already — leave it revealed and skip the observer entirely.
    if (el.getBoundingClientRect().top < window.innerHeight) {
      settled.current = true
      return
    }

    settled.current = true
    setShown(false)

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true)
            io.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )

    io.observe(el)
    return () => io.disconnect()
  }, [])

  return { ref, shown }
}
