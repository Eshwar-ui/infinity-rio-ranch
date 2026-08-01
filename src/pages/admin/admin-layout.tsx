import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { useAdmin } from '@/hooks/use-admin'
import { PublishBar } from '@/components/admin/publish-bar'

/** Sidebar items. Only built routes are links; the rest show the roadmap. */
const NAV = [
  { group: 'Pipeline' },
  { to: '/admin/leads', label: 'Leads', ready: true },
  { to: '/admin/clients', label: 'Clients', ready: true },
  { group: 'Website' },
  { to: '/admin/content', label: 'Page content', ready: true },
  { to: '/admin/gallery', label: 'Gallery', ready: true },
  { to: '/admin/events', label: 'Events & Packages', ready: true },
  { to: '/admin/testimonials', label: 'Testimonials', ready: true },
  { to: '/admin/faqs', label: 'FAQs', ready: true },
  { to: '/admin/stats', label: 'Venue numbers', ready: true },
  { to: '/admin/amenities', label: 'Amenities', ready: true },
  { to: '/admin/included', label: "What's included", ready: true },
  { to: '/admin/event-types', label: 'Event types', ready: true },
  { group: 'Billing' },
  { to: '/admin/invoices', label: 'Invoices', ready: true },
] as const

/**
 * Route guard + chrome for the whole /admin area. Redirects to login when there
 * is no session, and to login (after sign-out) when the user isn't an admin.
 */
export const RequireAdmin = () => {
  const { loading, session, isAdmin } = useAdmin()

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink text-muted">
        <span className="text-sm uppercase tracking-[0.24em]">Loading…</span>
      </div>
    )
  }
  if (!session) return <Navigate to="/admin/login" replace />
  if (!isAdmin) return <NotAuthorized />

  return <AdminShell />
}

const NotAuthorized = () => {
  const navigate = useNavigate()
  const signOut = async () => {
    await supabase.auth.signOut()
    navigate('/admin/login', { replace: true })
  }
  return (
    <div className="grid min-h-screen place-items-center bg-ink px-6 text-center">
      <div>
        <h1 className="font-serif text-2xl text-cream">Not authorized</h1>
        <p className="mt-3 max-w-sm text-sm text-muted">
          This account isn&apos;t an admin for Infinity Rio Ranch.
        </p>
        <button
          onClick={signOut}
          className="mt-6 text-xs uppercase tracking-[0.22em] text-brass2 hover:text-brass"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}

const AdminShell = () => {
  const navigate = useNavigate()
  const signOut = async () => {
    await supabase.auth.signOut()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen bg-ink text-cream">
      <aside className="flex w-60 flex-col border-r border-line bg-panel">
        <div className="border-b border-line px-6 py-6">
          <div className="font-serif text-lg leading-tight text-cream">
            Infinity Rio Ranch
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.24em] text-muted">
            Admin
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV.map((item) =>
            'group' in item ? (
              <div
                key={item.group}
                className="px-3 pb-1.5 pt-5 text-[9px] uppercase tracking-[0.24em] text-muted/70"
              >
                {item.group}
              </div>
            ) : item.ready ? (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `block rounded-[2px] px-3 py-2.5 text-[13px] tracking-wide transition-colors ${
                    isActive
                      ? 'bg-[rgba(201,168,106,0.1)] text-brass2'
                      : 'text-cream/80 hover:text-brass2'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ) : (
              <span
                key={item.to}
                title="Coming soon"
                className="block cursor-default px-3 py-2.5 text-[13px] tracking-wide text-muted/50"
              >
                {item.label}
              </span>
            ),
          )}
        </nav>

        <PublishBar />

        <button
          onClick={signOut}
          className="border-t border-line px-6 py-4 text-left text-[11px] uppercase tracking-[0.22em] text-muted hover:text-brass2"
        >
          Sign out
        </button>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
