import { useEffect, useState } from 'react'

/** True once the page has scrolled past `offset` — drives the condensed nav. */
export const useScrolled = (offset = 40) => {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled((window.scrollY || 0) > offset)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [offset])

  return scrolled
}
