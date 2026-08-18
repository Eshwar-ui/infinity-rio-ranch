import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import { SERVICE_LABELS, SERVICE_TYPES, type ServiceType } from '@/lib/vendor-services'
import { btnPrimary, pageTitle, pill, th } from '@/lib/admin-ui'
import { FilterBar, FilterGroup, SearchBox } from '@/components/admin/list-filters'
import {
  fmtDate,
  searchable,
  serviceClass,
  serviceSummary,
  type VendorAgreement,
} from './vendor-shared'

/**
 * Every vendor agreement the venue has raised, newest event first.
 *
 * Laid out like the clients list — full width, one filter row above the table,
 * a row opens at `/admin/vendors/:id`. A vendor agreement is a short document
 * with few facts, so the table carries all of them and there is nothing to
 * expand in place.
 */
export const AdminVendors = () => {
  const navigate = useNavigate()
  const [rows, setRows] = useState<VendorAgreement[]>([])
  const [loading, setLoading] = useState(true)
  const [service, setService] = useState<'all' | ServiceType>('all')
  const [query, setQuery] = useState('')

  useEffect(() => {
    supabase
      .from('vendor_agreements')
      .select('*')
      // Nulls last so an agreement without a date yet doesn't head the list.
      .order('event_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error('Could not load vendor agreements.')
        else setRows((data ?? []) as VendorAgreement[])
        setLoading(false)
      })
  }, [])

  const matchesQuery = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (v: VendorAgreement) =>
      q === '' || searchable(v).some((value) => (value ?? '').toLowerCase().includes(q))
  }, [query])

  const visible = useMemo(
    () =>
      rows.filter(
        (v) =>
          (service === 'all' || (v.service_types ?? []).includes(service)) && matchesQuery(v),
      ),
    [rows, service, matchesQuery],
  )

  /* Counted against the search, not the whole table — the same rule the other
     lists follow, so "DJ 3" can't sit above a list of one. */
  const countBy = useMemo(() => {
    const searched = rows.filter(matchesQuery)
    return (v: 'all' | ServiceType) =>
      v === 'all' ? searched.length : searched.filter((r) => (r.service_types ?? []).includes(v)).length
  }, [rows, matchesQuery])

  const filtersActive = service !== 'all' || query.trim() !== ''
  const resetFilters = () => {
    setService('all')
    setQuery('')
  }

  const upcoming = rows.filter(
    (v) => v.event_date && new Date(v.event_date + 'T00:00:00') >= new Date(new Date().toDateString()),
  ).length

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-line px-8 py-6">
        <div>
          <h1 className={pageTitle}>Vendors</h1>
          <p className="mt-1 text-[13px] text-muted">
            {rows.length} agreement{rows.length === 1 ? '' : 's'}
            {upcoming > 0 && ` · ${upcoming} for an event still to come`}
          </p>
        </div>
        <button onClick={() => navigate('/admin/vendors/new')} className={btnPrimary}>
          + New agreement
        </button>
      </header>

      <FilterBar
        row
        showing={visible.length}
        total={rows.length}
        active={filtersActive}
        onReset={resetFilters}
      >
        <div className="w-[clamp(200px,20vw,280px)]">
          <SearchBox value={query} onChange={setQuery} placeholder="Search vendors" />
        </div>
        <FilterGroup
          label="Service"
          value={service}
          onChange={setService}
          options={(['all', ...SERVICE_TYPES] as const).map((v) => ({
            value: v,
            label: v === 'all' ? 'all' : SERVICE_LABELS[v],
            count: countBy(v),
          }))}
        />
      </FilterBar>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-4">
        {loading ? (
          <p className="py-6 text-[13px] text-muted">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="py-6 text-[13px] leading-relaxed text-muted">
            {filtersActive
              ? 'Nothing matches those filters.'
              : 'No vendor agreements yet. Raise one for the next caterer, decorator or DJ working an event.'}
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className={th}>Vendor</th>
                <th className={th}>Contact</th>
                <th className={th}>Client / event</th>
                <th className={th}>Event date</th>
                <th className={th}>Service</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((v) => (
                <tr
                  key={v.id}
                  onClick={() => navigate(`/admin/vendors/${v.id}`)}
                  className="cursor-pointer border-b border-line/60 transition-colors hover:bg-panel"
                >
                  {/* A real link as well as a clickable row, so the list stays
                      reachable by keyboard like every other table here. */}
                  <td className="max-w-[260px] py-3.5 pr-4">
                    <Link
                      to={`/admin/vendors/${v.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="block truncate font-medium text-cream transition-colors hover:text-brass2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/40"
                    >
                      {v.business_name}
                    </Link>
                    {v.contact_person && (
                      <span className="mt-0.5 block truncate text-[12px] text-muted">
                        {v.contact_person}
                      </span>
                    )}
                  </td>
                  <td className="max-w-[220px] py-3.5 pr-4 text-cream/90">
                    <span className="block truncate">{v.phone || '—'}</span>
                    {v.email && (
                      <span className="mt-0.5 block truncate text-[12px] text-muted">{v.email}</span>
                    )}
                  </td>
                  <td className="max-w-[220px] py-3.5 pr-4 text-cream/90">
                    <span className="block truncate">{v.client_event_name || '—'}</span>
                  </td>
                  <td className="py-3.5 pr-4 text-muted">{fmtDate(v.event_date) ?? '—'}</td>
                  <td className="py-3.5">
                    <div className="flex flex-wrap gap-1.5">
                      {(v.service_types ?? []).length === 0 ? (
                        <span className="text-muted">—</span>
                      ) : (
                        (v.service_types ?? []).map((s) => (
                          <span key={s} className={`${pill} ${serviceClass[s]}`}>
                            {SERVICE_LABELS[s]}
                          </span>
                        ))
                      )}
                    </div>
                    <span className="sr-only">{serviceSummary(v)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
