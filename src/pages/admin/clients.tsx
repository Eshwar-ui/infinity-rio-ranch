import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import { money } from '@/lib/invoice'
import { btnPrimary, pageTitle, pill, th } from '@/lib/admin-ui'
import { FilterBar, FilterGroup, SearchBox } from '@/components/admin/list-filters'
import {
  PAYMENT_STATUSES,
  STATUSES,
  bookingTotals,
  fmtEventDate,
  paymentClass,
  searchable,
  statusClass,
  type Client,
  type ClientStatus,
  type PaymentStatus,
} from './client-shared'

/**
 * The clients list, and only the list.
 *
 * It used to be a rail beside a profile, which cost the list two thirds of the
 * width — the filter options wrapped onto four lines, names truncated, and the
 * money never fitted at all. A client is opened at `/admin/clients/:id`
 * instead, so this view can be a real table and the profile gets a real page.
 */
export const AdminClients = () => {
  const navigate = useNavigate()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | ClientStatus>('all')
  const [payFilter, setPayFilter] = useState<'all' | PaymentStatus>('all')
  const [query, setQuery] = useState('')

  useEffect(() => {
    supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error('Could not load clients.')
        else setClients((data ?? []) as Client[])
        setLoading(false)
      })
  }, [])

  const matchesQuery = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (c: Client) => q === '' || searchable(c).some((v) => (v ?? '').toLowerCase().includes(q))
  }, [query])

  const visible = useMemo(
    () =>
      clients.filter(
        (c) =>
          (filter === 'all' || c.status === filter) &&
          (payFilter === 'all' || c.payment_status === payFilter) &&
          matchesQuery(c),
      ),
    [clients, filter, payFilter, matchesQuery],
  )

  /* Counts per option, so an empty category is visible without clicking it.
     Each dimension counts against the other active filters, not the whole
     table — otherwise "Paid 6" next to a list of two is just wrong. */
  const countBy = useMemo(() => {
    const forStatus = clients.filter(
      (c) => matchesQuery(c) && (payFilter === 'all' || c.payment_status === payFilter),
    )
    const forPayment = clients.filter(
      (c) => matchesQuery(c) && (filter === 'all' || c.status === filter),
    )
    return {
      status: (v: 'all' | ClientStatus) =>
        v === 'all' ? forStatus.length : forStatus.filter((c) => c.status === v).length,
      payment: (v: 'all' | PaymentStatus) =>
        v === 'all' ? forPayment.length : forPayment.filter((c) => c.payment_status === v).length,
    }
  }, [clients, filter, payFilter, matchesQuery])

  const filtersActive = filter !== 'all' || payFilter !== 'all' || query.trim() !== ''
  const resetFilters = () => {
    setFilter('all')
    setPayFilter('all')
    setQuery('')
  }

  const bookedCount = clients.filter((c) => c.status === 'booked').length
  const unpaidCount = clients.filter((c) => c.payment_status !== 'paid').length

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-line px-8 py-6">
        <div>
          <h1 className={pageTitle}>Clients</h1>
          <p className="mt-1 text-[13px] text-muted">
            {bookedCount} booked
            {unpaidCount > 0 && ` · ${unpaidCount} not fully paid`}
          </p>
        </div>
        <button onClick={() => navigate('/admin/clients/new')} className={btnPrimary}>
          + New client
        </button>
      </header>

      <FilterBar
        row
        showing={visible.length}
        total={clients.length}
        active={filtersActive}
        onReset={resetFilters}
      >
        <div className="w-[clamp(200px,20vw,280px)]">
          <SearchBox value={query} onChange={setQuery} placeholder="Search clients" />
        </div>
        <FilterGroup
          label="Booking"
          value={filter}
          onChange={setFilter}
          options={(['all', ...STATUSES] as const).map((v) => ({
            value: v,
            label: v,
            count: countBy.status(v),
          }))}
        />
        <FilterGroup
          label="Payment"
          value={payFilter}
          onChange={setPayFilter}
          options={(['all', ...PAYMENT_STATUSES] as const).map((v) => ({
            value: v,
            label: v,
            count: countBy.payment(v),
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
              : 'No clients here yet. Convert a lead, or add one by hand.'}
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className={th}>Client</th>
                <th className={th}>Event</th>
                <th className={th}>Date</th>
                <th className={`${th} text-right`}>Agreed</th>
                <th className={`${th} text-right`}>Balance</th>
                <th className={`${th} pl-6`}>Booking</th>
                <th className={th}>Payment</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => {
                const { agreed, advance, balanceDue } = bookingTotals(c)
                return (
                  <tr
                    key={c.id}
                    onClick={() => navigate(`/admin/clients/${c.id}`)}
                    className="cursor-pointer border-b border-line/60 transition-colors hover:bg-panel"
                  >
                    {/* The name is a real link as well as a clickable row, so the
                        list is reachable by keyboard like the rest of the panel. */}
                    <td className="max-w-[280px] py-3.5 pr-4">
                      <Link
                        to={`/admin/clients/${c.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="block truncate font-medium text-cream transition-colors hover:text-brass2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/40"
                      >
                        {c.name}
                      </Link>
                      {c.email && (
                        <span className="mt-0.5 block truncate text-[12px] text-muted">
                          {c.email}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 pr-4 text-cream/90">
                      {c.event_type || '—'}
                      {c.guest_count != null && (
                        <span className="mt-0.5 block text-[12px] text-muted">
                          {c.guest_count} guests
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 pr-4 text-muted">{fmtEventDate(c.event_date) ?? '—'}</td>
                    <td className="py-3.5 pr-4 text-right text-cream">
                      {agreed > 0 ? money(agreed) : '—'}
                    </td>
                    <td className="py-3.5 pr-4 text-right">
                      {agreed > 0 || advance > 0 ? (
                        <>
                          <span className="font-medium text-cream">{money(balanceDue)}</span>
                          {advance > 0 && (
                            <span className="mt-0.5 block text-[11px] text-muted">
                              {money(advance)} paid
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="py-3.5 pl-6 pr-3">
                      <span className={`${pill} ${statusClass[c.status]}`}>{c.status}</span>
                    </td>
                    <td className="py-3.5">
                      <span className={`${pill} ${paymentClass[c.payment_status]}`}>
                        {c.payment_status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
