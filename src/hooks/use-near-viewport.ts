import { useEffect, useRef, useState } from 'react'

/**
 * False until the element is within `margin` of the viewport, then true forever.
 *
 * This is the deferral to reach for when what's being held back is *content* —
 * a photo the visitor is meant to see — rather than a decorative animation.
 * `useAfterPaint` is the wrong tool for that on two counts: it stays false
 * permanently under `prefers-reduced-motion` (correct for a layer that would
 * otherwise animate forever, wrong for a still image — reducing motion is not
 * asking for a blank section), and its fixed settle window is a guess about
 * when the visitor arrives rather than a fact about it.
 *
 * Tying it to proximity instead gets the same thing off the critical path — a
 * below-the-fold element isn't near the viewport at load — while guaranteeing
 * it has started loading by the time anyone scrolls to it. It is the behaviour
 * `loading="lazy"` gives a real `<img>`, for the cases that have to be a CSS
 * background.
 *
 * Starts false on the server and on the client's first render, so the
 * prerendered HTML matches and hydration stays intact.
 */
export const useNearViewport = <T extends HTMLElement = HTMLDivElement>(
  margin = '300px',
) => {
  const ref = useRef<T>(null)
  const [near, setNear] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // No IntersectionObserver — show it rather than withhold it.
    if (typeof IntersectionObserver !== 'function') {
      setNear(true)
      return
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setNear(true)
            io.unobserve(entry.target)
          }
        }
      },
      { rootMargin: `${margin} 0px` },
    )

    io.observe(el)
    return () => io.disconnect()
  }, [margin])

  return { ref, near }
}
