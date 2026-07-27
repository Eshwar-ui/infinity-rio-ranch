import { useEffect, useState } from 'react'

/**
 * False until the browser has gone idle after the first paint — and forever, if
 * the visitor asked for reduced motion.
 *
 * Used to hold back purely decorative, continuously-animating layers (film
 * grain, hero bokeh, twinkling lights). Those layers cost real paint work every
 * frame: 31 elements animating `transform` under a `box-shadow` glow or a blur
 * filter, plus a full-viewport `mix-blend-mode` overlay that forces the whole
 * page to re-blend on every repaint. Running all of that while the browser is
 * still trying to produce its first paint was worth ~2.1 s of style/layout time
 * on a throttled mobile profile.
 *
 * Starts false on the server too, so the prerendered HTML matches the client's
 * first render and hydration stays intact. These layers are `aria-hidden`
 * decoration — nothing indexable is deferred.
 */
export const useAfterPaint = (timeout = 2000) => {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const supportsIdle = typeof window.requestIdleCallback === 'function'
    const id = supportsIdle
      ? window.requestIdleCallback(() => setReady(true), { timeout })
      : window.setTimeout(() => setReady(true), 600)

    return () => {
      if (supportsIdle) window.cancelIdleCallback(id as number)
      else window.clearTimeout(id)
    }
  }, [timeout])

  return ready
}
