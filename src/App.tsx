import { lazy } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'

import { AppShell } from '@/components/layout/app-shell'
import { RootLayout } from '@/components/layout/root-layout'
import { HomePage } from '@/pages/home'
import { AboutPage } from '@/pages/about'
import { GalleryPage } from '@/pages/gallery'
import { ContactPage } from '@/pages/contact'
import { PrivacyPolicyPage } from '@/pages/privacy-policy'
import { TermsConditionsPage } from '@/pages/terms-conditions'
/*
 * The blog pages are imported eagerly, unlike admin/invoice below. They are
 * prerendered, so a lazy chunk would render the Suspense fallback into
 * dist/blog/<slug>/index.html and mismatch on hydration — throwing away the
 * prerender's head start on precisely the pages that exist for search traffic.
 */
import { BlogPage } from '@/pages/blog'
import { BlogPostPage } from '@/pages/blog-post'
import { NotFoundPage } from '@/pages/not-found'

// Admin + invoice code is lazy-loaded so public visitors never download it.
const named = (factory: () => Promise<Record<string, any>>, name: string) =>
  lazy(() => factory().then((m) => ({ default: m[name] })))

const AdminLogin = named(() => import('@/pages/admin/login'), 'AdminLogin')
const RequireAdmin = named(() => import('@/pages/admin/admin-layout'), 'RequireAdmin')
const CmsLayout = named(() => import('@/pages/admin/cms-layout'), 'CmsLayout')
const LeadsPage = named(() => import('@/pages/admin/leads'), 'LeadsPage')
const AdminClients = named(() => import('@/pages/admin/clients'), 'AdminClients')
const AdminClientDetail = named(
  () => import('@/pages/admin/client-detail'),
  'AdminClientDetail',
)
const AdminTestimonials = named(() => import('@/pages/admin/testimonials'), 'AdminTestimonials')
const AdminEvents = named(() => import('@/pages/admin/events'), 'AdminEvents')
const AdminFaqs = named(() => import('@/pages/admin/faqs'), 'AdminFaqs')
const AdminGallery = named(() => import('@/pages/admin/gallery'), 'AdminGallery')
const AdminPageCopy = named(() => import('@/pages/admin/page-copy'), 'AdminPageCopy')
const AdminBlog = named(() => import('@/pages/admin/blog'), 'AdminBlog')
const AdminStats = named(() => import('@/pages/admin/lists'), 'AdminStats')
const AdminAmenities = named(() => import('@/pages/admin/lists'), 'AdminAmenities')
const AdminIncluded = named(() => import('@/pages/admin/lists'), 'AdminIncluded')
const AdminEventTypes = named(() => import('@/pages/admin/lists'), 'AdminEventTypes')
const AdminVendors = named(() => import('@/pages/admin/vendors'), 'AdminVendors')
const AdminVendorDetail = named(
  () => import('@/pages/admin/vendor-detail'),
  'AdminVendorDetail',
)
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
      { path: '/blog', element: <BlogPage /> },
      { path: '/blog/:slug', element: <BlogPostPage /> },
      { path: '/contact', element: <ContactPage /> },
      { path: '/privacy-policy', element: <PrivacyPolicyPage /> },
      { path: '/terms-conditions', element: <TermsConditionsPage /> },
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
      { path: 'clients', element: <AdminClients /> },
      { path: 'clients/new', element: <AdminClientDetail /> },
      { path: 'clients/:id', element: <AdminClientDetail /> },
      // Pathless layout route: the nine website editors keep their own URLs and
      // gain the shared CMS tab bar.
      {
        element: <CmsLayout />,
        children: [
          { path: 'content', element: <AdminPageCopy /> },
          { path: 'blog', element: <AdminBlog /> },
          { path: 'stats', element: <AdminStats /> },
          { path: 'amenities', element: <AdminAmenities /> },
          { path: 'included', element: <AdminIncluded /> },
          { path: 'event-types', element: <AdminEventTypes /> },
          { path: 'testimonials', element: <AdminTestimonials /> },
          { path: 'events', element: <AdminEvents /> },
          { path: 'faqs', element: <AdminFaqs /> },
          { path: 'gallery', element: <AdminGallery /> },
        ],
      },
      { path: 'vendors', element: <AdminVendors /> },
      { path: 'vendors/new', element: <AdminVendorDetail /> },
      { path: 'vendors/:id', element: <AdminVendorDetail /> },
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
