import { lazy } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'

import { AppShell } from '@/components/layout/app-shell'
import { RootLayout } from '@/components/layout/root-layout'
import { HomePage } from '@/pages/home'
import { AboutPage } from '@/pages/about'
import { GalleryPage } from '@/pages/gallery'
import { ContactPage } from '@/pages/contact'
import { NotFoundPage } from '@/pages/not-found'

// Admin + invoice code is lazy-loaded so public visitors never download it.
const named = (factory: () => Promise<Record<string, any>>, name: string) =>
  lazy(() => factory().then((m) => ({ default: m[name] })))

const AdminLogin = named(() => import('@/pages/admin/login'), 'AdminLogin')
const RequireAdmin = named(() => import('@/pages/admin/admin-layout'), 'RequireAdmin')
const LeadsPage = named(() => import('@/pages/admin/leads'), 'LeadsPage')
const AdminTestimonials = named(() => import('@/pages/admin/testimonials'), 'AdminTestimonials')
const AdminEvents = named(() => import('@/pages/admin/events'), 'AdminEvents')
const AdminFaqs = named(() => import('@/pages/admin/faqs'), 'AdminFaqs')
const AdminGallery = named(() => import('@/pages/admin/gallery'), 'AdminGallery')
const AdminInvoices = named(() => import('@/pages/admin/invoices'), 'AdminInvoices')
const InvoiceEditor = named(() => import('@/pages/admin/invoice-editor'), 'InvoiceEditor')
const InvoicePublicPage = named(() => import('@/pages/invoice-public'), 'InvoicePublicPage')

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/about', element: <AboutPage /> },
      { path: '/gallery', element: <GalleryPage /> },
      { path: '/contact', element: <ContactPage /> },
      // Matches dist/404.html, which the server returns for unknown paths.
      // Mirror any change here in src/entry-server.tsx.
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  // Admin — outside RootLayout (no public navbar/footer/effects).
  { path: '/admin/login', element: <AdminLogin /> },
  {
    path: '/admin',
    element: <RequireAdmin />,
    children: [
      { index: true, element: <Navigate to="/admin/leads" replace /> },
      { path: 'leads', element: <LeadsPage /> },
      { path: 'testimonials', element: <AdminTestimonials /> },
      { path: 'events', element: <AdminEvents /> },
      { path: 'faqs', element: <AdminFaqs /> },
      { path: 'gallery', element: <AdminGallery /> },
      { path: 'invoices', element: <AdminInvoices /> },
      { path: 'invoices/new', element: <InvoiceEditor /> },
      { path: 'invoices/:id', element: <InvoiceEditor /> },
    ],
  },
  // Client-facing invoice (token in URL, no auth).
  { path: '/invoice/:token', element: <InvoicePublicPage /> },
])

const App = () => (
  <AppShell>
    <RouterProvider router={router} />
  </AppShell>
)

export default App
