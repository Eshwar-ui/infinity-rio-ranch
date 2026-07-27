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
/**
 * `requestIdleCallback` alone was not enough. On a fast machine the main thread
 * goes idle within ~200 ms, so every "deferred" layer was mounting during the
 * critical window anyway — measured: hero slide 2 (70 kB) requesting at 393 ms,
 * and the grain/bokeh/lights style work landing before the largest paint.
 *
 * Idle is a statement about the CPU, not about whether the page has finished
 * presenting itself. So: wait out a real settle window *first*, then ask for
 * idle. `MIN_DELAY` is below the 5.5 s hero transition and above a typical
 * largest paint, which is the window this is trying to protect.
 */
const MIN_DELAY = 1800

export const useAfterPaint = (timeout = 2000) => {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const supportsIdle = typeof window.requestIdleCallback === 'function'
    let idleId: number | undefined

    const settle = window.setTimeout(() => {
      if (supportsIdle) {
        idleId = window.requestIdleCallback(() => setReady(true), { timeout })
      } else {
        setReady(true)
      }
    }, MIN_DELAY)

    return () => {
      window.clearTimeout(settle)
      if (idleId !== undefined) window.cancelIdleCallback(idleId)
    }
  }, [timeout])

  return ready
}
