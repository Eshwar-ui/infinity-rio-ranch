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
    {/* One unbroken rail keeps the editor from jumping between a wrapped first
        and second tab row. The controls are deliberately button-like: CMS
        sections are destinations, not low-emphasis text links. */}
    <nav
      aria-label="Website editors"
      className="shrink-0 overflow-x-auto border-b border-line bg-panel/35 px-5 py-3 [scrollbar-width:thin]"
    >
      <div className="flex w-max items-center gap-2 pb-1">
        <span className="mr-1 hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-muted/70 xl:inline">
          Website editors
        </span>
        {CMS_TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `inline-flex min-h-10 shrink-0 items-center justify-center rounded-md border px-3.5 py-2 text-[13px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/45 ${
                isActive
                  ? 'border-brass bg-brass text-onbrass shadow-[0_2px_0_rgba(0,0,0,0.25),0_5px_10px_rgba(0,0,0,0.12)]'
                  : 'border-line bg-panel/55 text-cream/80 shadow-[0_1px_0_rgba(0,0,0,0.16)] hover:-translate-y-px hover:border-brass/60 hover:bg-panel2 hover:text-cream active:translate-y-0 active:shadow-none'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>
    </nav>

    <div className="flex min-h-0 flex-1 flex-col">
      <Outlet />
    </div>
  </div>
)
