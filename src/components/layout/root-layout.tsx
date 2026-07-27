import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import { useDocumentHead } from '@/hooks/use-document-head'
import { ThemeProvider } from '@/components/layout/theme-provider'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { Grain } from '@/components/effects/grain'
import { Lightbox } from '@/components/gallery/lightbox'

/** Scroll to top on every route change (mirrors the prototype's nav()). */
const ScrollToTop = () => {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
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
    </div>
  )
}
