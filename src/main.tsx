import './index.css'

/**
 * The entry is deliberately tiny: it keeps the stylesheet render-blocking (so
 * the prerendered HTML paints styled) and asks for the app only once the first
 * frame is actually on screen.
 *
 * Fetching the app bundle eagerly put ~800 kB of JS — download, parse and
 * hydration — ahead of the hero paint on a mid-range phone: Lighthouse mobile
 * showed 90% of a 4.9 s LCP as *render delay*, with the photo long downloaded.
 * The prerendered markup is already the finished page and its links are plain
 * anchors, so nothing a visitor can see depends on hydration having happened.
 *
 * "On screen" means the first largest-contentful-paint entry, which the browser
 * reports after presentation. requestAnimationFrame + setTimeout was tried and
 * isn't late enough: this page's style/layout pass is heavy, so the frame was
 * presented ~90 ms after the callback and the bundle request still beat it.
 * Where LCP isn't reported (Safari), that rAF idiom is the fallback. A first
 * tap or keypress boots immediately, and a backstop covers background tabs,
 * which neither paint nor run rAF.
 */
let booted = false
const boot = () => {
  if (booted) return
  booted = true
  void import('./boot')
}

const opts = { once: true, passive: true, capture: true } as const
for (const type of ['pointerdown', 'keydown', 'touchstart']) {
  addEventListener(type, boot, opts)
}
setTimeout(boot, 2500)

if (PerformanceObserver.supportedEntryTypes?.includes('largest-contentful-paint')) {
  new PerformanceObserver((_, observer) => {
    observer.disconnect()
    setTimeout(boot, 0)
  }).observe({ type: 'largest-contentful-paint', buffered: true })
} else {
  requestAnimationFrame(() => setTimeout(boot, 0))
}
