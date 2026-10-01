import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import { useDocumentHead } from '@/hooks/use-document-head'
import { ThemeProvider } from '@/components/layout/theme-provider'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { Grain } from '@/components/effects/grain'
import { Lightbox } from '@/components/gallery/lightbox'
import { WhatsAppFab } from '@/components/layout/whatsapp-fab'

/**
 * Scroll to top on every route change (mirrors the prototype's nav()), and from
 * the first in-app navigation on, let pages fade in (`.page-enter` in
 * index.css). The landing page itself never fades: it's prerendered and its
 * hero is the LCP element. The flag lives on <html>, outside the hydrated tree,
 * so it can't cause a hydration mismatch.
 */
const ScrollToTop = () => {
  const { pathname } = useLocation()
  const landing = useRef(pathname)
  useEffect(() => {
    window.scrollTo(0, 0)
    if (pathname !== landing.current) document.documentElement.dataset.navigated = ''
  }, [pathname])
  return null
}

export const RootLayout = () => {
  useDocumentHead()
  return (
    <div className="relative">
      <ThemeProvider />
      <ScrollToTop />
      <Grain />
      <Navbar />
      <main>
        <Outlet />
      </main>
      <Footer />
      <Lightbox />
      <WhatsAppFab />
    </div>
  )
}
