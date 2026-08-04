import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { useAdmin } from '@/hooks/use-admin'
import { CMS_TABS } from '@/pages/admin/cms-tabs'
import { btnGhost, eyebrow } from '@/lib/admin-ui'

/**
 * Sidebar items. Only built routes are links; the rest show the roadmap.
 *
 * `match` widens the active highlight past the item's own `to` — the CMS entry
 * lands on Page content but has to stay lit across all nine of its tabs, which
 * `NavLink`'s own `isActive` (a prefix test against one path) can't express.
 */
const NAV = [
  { group: 'Pipeline' },
  { to: '/admin/leads', label: 'Leads', ready: true },
  { to: '/admin/clients', label: 'Clients', ready: true },
  { group: 'Website' },
  {
    to: '/admin/content',
    label: 'CMS',
    ready: true,
    match: CMS_TABS.map((t) => t.to),
  },
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
      <div className="admin-ui grid min-h-screen place-items-center bg-ink text-muted">
        <span className="text-sm">Loading…</span>
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
    <div className="admin-ui grid min-h-screen place-items-center bg-ink px-6 text-center">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-cream">Not authorized</h1>
        <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-muted">
          This account isn&apos;t an admin for Infinity Rio Ranch.
        </p>
        <button onClick={signOut} className={`mt-6 ${btnGhost}`}>
          Sign out
        </button>
      </div>
    </div>
  )
}

const AdminShell = () => {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const signOut = async () => {
    await supabase.auth.signOut()
    navigate('/admin/login', { replace: true })
  }

  const under = (path: string) => pathname === path || pathname.startsWith(`${path}/`)
  const isActive = (item: { to: string; match?: readonly string[] }) =>
    item.match ? item.match.some(under) : under(item.to)

  return (
    <div className="admin-ui flex min-h-screen bg-ink text-cream">
      <aside className="flex w-60 flex-col border-r border-line bg-panel">
        <div className="border-b border-line px-5 py-5">
          <div className="text-[15px] font-semibold leading-tight tracking-[-0.01em] text-cream">
            Infinity Rio Ranch
          </div>
          <div className="mt-0.5 text-[12px] text-muted">Admin panel</div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {NAV.map((item) =>
            'group' in item ? (
              <div key={item.group} className={`px-3 pb-1 pt-4 ${eyebrow}`}>
                {item.group}
              </div>
            ) : item.ready ? (
              <NavLink
                key={item.to}
                to={item.to}
                /* The active item gets a brass edge as well as a tint — colour
                   alone is a weak signal at this size, and fails outright for
                   anyone who can't separate the brass from the cream. */
                className={`mt-0.5 flex items-center rounded-md border-l-2 px-3 py-2 text-[14px] transition-colors ${
                  isActive(item)
                    ? 'border-brass bg-brass/10 font-semibold text-brass2'
                    : 'border-transparent font-medium text-cream/75 hover:bg-panel2/60 hover:text-cream'
                }`}
              >
                {item.label}
              </NavLink>
            ) : (
              <span
                key={item.to}
                title="Coming soon"
                className="mt-0.5 flex cursor-default items-center rounded-md px-3 py-2 text-[14px] text-muted/50"
              >
                {item.label}
              </span>
            ),
          )}
        </nav>

        <button
          onClick={signOut}
          className="border-t border-line px-5 py-3.5 text-left text-[13px] font-medium text-muted transition-colors hover:text-cream"
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
