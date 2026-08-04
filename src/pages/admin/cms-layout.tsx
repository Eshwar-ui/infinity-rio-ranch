import { NavLink, Outlet } from 'react-router-dom'

import { CMS_TABS } from '@/pages/admin/cms-tabs'

/**
 * The whole public-site CMS behind one sidebar entry.
 *
 * Nine editors used to sit as nine sidebar links, which read as nine unrelated
 * areas rather than one job ("change what the website says"). They're a pathless
 * layout route in `App.tsx`, so every existing URL — `/admin/content`,
 * `/admin/gallery`, … — still resolves; only the chrome around them changed.
 */
export const CmsLayout = () => (
  <div className="flex h-screen flex-col">
    {/* Nine tabs don't fit every window; scroll them rather than wrapping to a
        second row that would shift the editor below it up and down. */}
    <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-line px-6 py-3">
      {CMS_TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            `shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
              isActive ? 'bg-brass/15 text-brass2' : 'text-muted hover:text-cream'
            }`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>

    <div className="flex min-h-0 flex-1 flex-col">
      <Outlet />
    </div>
  </div>
)
