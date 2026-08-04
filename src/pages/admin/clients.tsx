import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PencilSimple, Trash } from '@phosphor-icons/react'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import { money } from '@/lib/invoice'
import { useList } from '@/hooks/use-site-content'
import {
  btnPrimary,
  btnQuiet,
  field,
  iconBtn,
  iconBtnDanger,
  label,
  pageTitle,
  pill,
} from '@/lib/admin-ui'
import { ClientInvoicePanel, type ClientInvoice } from '@/components/admin/client-invoice-panel'
import { FilterBar, FilterGroup, SearchBox } from '@/components/admin/list-filters'

type ClientStatus = 'booked' | 'completed' | 'cancelled'
type PaymentStatus = 'unpaid' | 'partial' | 'paid'

type Client = {
  id: string
  lead_id: string | null
  name: string
  email: string | null
  phone: string | null
  event_date: string | null
  event_type: string | null
  guest_count: number | null
  package: string | null
  amount: number | null
  advance_amount: number | null
  status: ClientStatus
  payment_status: PaymentStatus
  notes: string | null
  created_at: string
}

const STATUSES: ClientStatus[] = ['booked', 'completed', 'cancelled']
const PAYMENT_STATUSES: PaymentStatus[] = ['unpaid', 'partial', 'paid']

const statusClass: Record<ClientStatus, string> = {
  booked: 'bg-brass/15 text-brass2 border-brass/40',
  completed: 'bg-[#6a9a7a]/15 text-[#8fc0a0] border-[#6a9a7a]/40',
  cancelled: 'bg-transparent text-muted/60 border-line',
}

const paymentClass: Record<PaymentStatus, string> = {
  unpaid: 'bg-[#d98a6a]/10 text-[#d98a6a] border-[#d98a6a]/40',
  partial: 'bg-brass/15 text-brass2 border-brass/40',
  paid: 'bg-[#6a9a7a]/15 text-[#8fc0a0] border-[#6a9a7a]/40',
}


const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

/** `event_date` is a bare date — parsing it without a time zone shifts it a day. */
const fmtEventDate = (d: string | null, opts?: Intl.DateTimeFormatOptions) =>
  d
    ? new Date(d + 'T00:00:00').toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        ...opts,
      })
    : null

const blank = (): Client => ({
  id: '',
  lead_id: null,
  name: '',
  email: '',
  phone: '',
  event_date: '',
  event_type: '',
  guest_count: null,
  package: '',
  amount: null,
  advance_amount: null,
  status: 'booked',
  payment_status: 'unpaid',
  notes: '',
  created_at: new Date().toISOString(),
})

/** Empty strings become NULL; the columns are nullable, not ''-defaulted. */
const nullable = (v: string | null | undefined) => {
  const s = (v ?? '').trim()
  return s === '' ? null : s
}

/** One read-only label/value pair on the profile. */
const Fact = ({ label: name, value }: { label: string; value: React.ReactNode }) => (
  <div>
    <dt className="text-[13px] font-medium text-muted">{name}</dt>
    <dd className="mt-1 text-[14px] text-cream">{value || <span className="text-muted">—</span>}</dd>
  </div>
)

export const AdminClients = () => {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Client | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'all' | ClientStatus>('all')
  const [payFilter, setPayFilter] = useState<'all' | PaymentStatus>('all')
  const [query, setQuery] = useState('')
  const [invoices, setInvoices] = useState<ClientInvoice[]>([])
  const eventTypes = useList('event_types')
  // Set by the Leads page right after a conversion, so the new client opens
  // already selected instead of the admin having to hunt for it in the list.
  const [params, setParams] = useSearchParams()
  const focusId = params.get('id')

  useEffect(() => {
    supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          toast.error('Could not load clients.')
          setLoading(false)
          return
        }
        const rows = (data ?? []) as Client[]
        setClients(rows)
        setLoading(false)
        if (focusId) {
          const match = rows.find((c) => c.id === focusId)
          if (match) {
            setSelectedId(match.id)
            setDraft({ ...match })
          }
          setParams({}, { replace: true })
        }
      })
    // Runs once: the param is consumed and cleared on the first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Invoices for whoever is on screen — what's been billed is part of the
  // profile, not a separate errand.
  useEffect(() => {
    if (!selectedId) {
      setInvoices([])
      return
    }
    let live = true
    supabase
      .from('invoices')
      .select(
        'id, number, status, issue_date, due_date, tax_rate, advance_paid, public_token, invoice_items(qty, unit_price)',
      )
      .eq('client_id', selectedId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (live) setInvoices((data ?? []) as ClientInvoice[])
      })
    return () => {
      live = false
    }
  }, [selectedId])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return clients.filter(
      (c) =>
        (filter === 'all' || c.status === filter) &&
        (payFilter === 'all' || c.payment_status === payFilter) &&
        (q === '' ||
          [c.name, c.email, c.phone, c.event_type, c.package]
            .some((v) => (v ?? '').toLowerCase().includes(q))),
    )
  }, [clients, filter, payFilter, query])

  /* Counts per option, so an empty category is visible without clicking it.
     Each dimension counts against the other active filters, not the whole
     table — otherwise "Paid 6" next to a list of two is just wrong. */
  const countBy = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matchesQuery = (c: Client) =>
      q === '' ||
      [c.name, c.email, c.phone, c.event_type, c.package].some((v) =>
        (v ?? '').toLowerCase().includes(q),
      )
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
  }, [clients, filter, payFilter, query])

  const filtersActive = filter !== 'all' || payFilter !== 'all' || query.trim() !== ''
  const resetFilters = () => {
    setFilter('all')
    setPayFilter('all')
    setQuery('')
  }

  const select = (client: Client) => {
    setSelectedId(client.id)
    setDraft({ ...client })
    setEditing(false)
  }

  const startNew = () => {
    setSelectedId(null)
    setDraft(blank())
    setEditing(true)
  }

  const cancelEdit = () => {
    const stored = clients.find((c) => c.id === draft?.id)
    if (stored) {
      setDraft({ ...stored })
      setEditing(false)
    } else {
      // Never saved — there's no profile to fall back to.
      setDraft(null)
      setEditing(false)
    }
  }

  const set = (patch: Partial<Client>) => setDraft((d) => (d ? { ...d, ...patch } : d))

  const save = async () => {
    if (!draft) return
    if (!draft.name.trim()) {
      toast.error('Name is required.')
      return
    }

    setSaving(true)
    const payload = {
      name: draft.name.trim(),
      email: nullable(draft.email),
      phone: nullable(draft.phone),
      event_date: nullable(draft.event_date),
      event_type: nullable(draft.event_type),
      guest_count: draft.guest_count ?? null,
      package: nullable(draft.package),
      amount: draft.amount ?? null,
      advance_amount: draft.advance_amount ?? null,
      status: draft.status,
      payment_status: draft.payment_status,
      notes: nullable(draft.notes),
    }

    const query = draft.id
      ? supabase.from('clients').update(payload).eq('id', draft.id).select().single()
      : supabase.from('clients').insert(payload).select().single()

    const { data, error } = await query
    setSaving(false)
    if (error || !data) {
      toast.error('Could not save this client.')
      return
    }

    const saved = data as Client
    setClients((prev) =>
      draft.id ? prev.map((c) => (c.id === saved.id ? saved : c)) : [saved, ...prev],
    )
    setSelectedId(saved.id)
    setDraft({ ...saved })
    setEditing(false)
    toast.success('Client saved.')
  }

  /**
   * The two status rows on the profile are one click each, so they write
   * straight through — optimistic, and rolled back on failure rather than
   * leaving the screen claiming something the DB never accepted.
   */
  const writeThrough = async (patch: Partial<Client>) => {
    if (!draft?.id) return
    const id = draft.id
    const keys = Object.keys(patch) as (keyof Client)[]
    if (keys.every((k) => draft[k] === patch[k])) return
    const previous = Object.fromEntries(keys.map((k) => [k, draft[k]])) as Partial<Client>

    const apply = (p: Partial<Client>) => {
      setDraft((d) => (d && d.id === id ? { ...d, ...p } : d))
      setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...p } : c)))
    }
    apply(patch)
    const { error } = await supabase.from('clients').update(patch).eq('id', id)
    if (error) {
      apply(previous)
      toast.error('Could not save that change.')
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this client permanently?')) return
    setClients((prev) => prev.filter((c) => c.id !== id))
    setSelectedId(null)
    setDraft(null)
    setEditing(false)
    const { error } = await supabase.from('clients').delete().eq('id', id)
    if (error) toast.error('Could not delete this client.')
  }

  const bookedCount = clients.filter((c) => c.status === 'booked').length
  const unpaidCount = clients.filter((c) => c.payment_status !== 'paid').length

  // Booking money, straight off the draft so it tracks what's on screen.
  const agreed = Number(draft?.amount) || 0
  const advance = Math.max(0, Number(draft?.advance_amount) || 0)
  const balanceDue = Math.max(0, agreed - advance)
  const paidPct = agreed > 0 ? Math.min(100, (advance / agreed) * 100) : 0

  // The payment flag is set by hand, so it can drift from the amounts recorded
  // above it. Nothing corrects either one — this just names the disagreement.
  const paymentMismatch = (() => {
    if (!draft) return null
    if (draft.payment_status === 'unpaid' && advance > 0)
      return `Marked unpaid, though ${money(advance)} is recorded as received above.`
    if (agreed <= 0) return null
    if (draft.payment_status === 'paid' && balanceDue > 0)
      return `Marked paid, though the amounts above still leave ${money(balanceDue)} outstanding.`
    if (draft.payment_status === 'partial' && balanceDue === 0)
      return 'Marked part paid, though the amounts above show nothing outstanding.'
    return null
  })()

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
        <button onClick={startNew} className={btnPrimary}>
          + New client
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* List */}
        <div className="flex w-[clamp(280px,24vw,360px)] shrink-0 flex-col border-r border-line">
          <FilterBar
            showing={visible.length}
            total={clients.length}
            active={filtersActive}
            onReset={resetFilters}
          >
            <SearchBox value={query} onChange={setQuery} placeholder="Search clients" />
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

          <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <p className="px-5 py-8 text-[13px] text-muted">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="px-5 py-8 text-[13px] leading-relaxed text-muted">
              {filtersActive
                ? 'Nothing matches those filters.'
                : 'No clients here yet. Convert a lead, or add one by hand.'}
            </p>
          ) : (
            visible.map((client) => (
              <button
                key={client.id}
                onClick={() => select(client)}
                className={`block w-full border-b border-line px-4 py-3 text-left transition-colors hover:bg-panel ${
                  selectedId === client.id ? 'bg-panel' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[14px] font-medium text-cream">{client.name}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    <span className={`${pill} ${paymentClass[client.payment_status]}`}>
                      {client.payment_status}
                    </span>
                    <span className={`${pill} ${statusClass[client.status]}`}>{client.status}</span>
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[12px] text-muted">
                  <span className="truncate">{client.event_type || 'Event'}</span>
                  <span className="shrink-0">{fmtEventDate(client.event_date) ?? '—'}</span>
                </div>
              </button>
            ))
          )}
          </div>
        </div>

        {/* Profile */}
        <div className="min-w-0 flex-1 overflow-y-auto">
          {!draft ? (
            <div className="grid h-full place-items-center text-sm text-muted">
              Select a client, or add a new one.
            </div>
          ) : editing ? (
            /* ---------------------------------------------------------------
               Edit form — deliberately behind a toggle. The profile is what an
               owner looks at daily; the fields are for the rare correction.
               --------------------------------------------------------------- */
            <div className="max-w-4xl px-8 py-7 2xl:px-10">
              <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-cream">
                {draft.id ? `Editing ${draft.name || 'client'}` : 'New client'}
              </h2>

              <div className="mt-8 space-y-5">
                {/* Full width on its own row — a couple's name is the longest
                    thing on this form ("Priya Raghunathan & Daniel Okonkwo"). */}
                <div>
                  <label className={label}>Name *</label>
                  <input
                    value={draft.name}
                    onChange={(e) => set({ name: e.target.value })}
                    className={`${field} text-base`}
                  />
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className={label}>Email</label>
                    <input
                      type="email"
                      value={draft.email ?? ''}
                      onChange={(e) => set({ email: e.target.value })}
                      className={field}
                    />
                  </div>
                  <div className="flex-1">
                    <label className={label}>Phone</label>
                    <input
                      type="tel"
                      value={draft.phone ?? ''}
                      onChange={(e) => set({ phone: e.target.value })}
                      className={field}
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className={label}>Event date</label>
                    <input
                      type="date"
                      value={draft.event_date ?? ''}
                      onChange={(e) => set({ event_date: e.target.value })}
                      className={field}
                    />
                  </div>
                  <div className="flex-1">
                    <label className={label}>Event type</label>
                    {/* A datalist, not a select: the list is CMS-editable and old
                        clients keep types that were since renamed or removed. */}
                    <input
                      list="client-event-types"
                      value={draft.event_type ?? ''}
                      onChange={(e) => set({ event_type: e.target.value })}
                      className={field}
                    />
                    <datalist id="client-event-types">
                      {eventTypes.map((t) => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                  </div>
                  <div className="w-28">
                    <label className={label}>Guests</label>
                    <input
                      type="number"
                      min={0}
                      value={draft.guest_count ?? ''}
                      onChange={(e) =>
                        set({ guest_count: e.target.value === '' ? null : Number(e.target.value) })
                      }
                      className={field}
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className={label}>Package</label>
                    <input
                      value={draft.package ?? ''}
                      onChange={(e) => set({ package: e.target.value })}
                      className={field}
                    />
                  </div>
                  <div className="w-40">
                    <label className={label}>Agreed amount</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={draft.amount ?? ''}
                      onChange={(e) =>
                        set({ amount: e.target.value === '' ? null : Number(e.target.value) })
                      }
                      className={field}
                    />
                  </div>
                  <div className="w-40">
                    <label className={label}>Advance paid</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={draft.advance_amount ?? ''}
                      onChange={(e) =>
                        set({
                          advance_amount: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                      className={field}
                    />
                  </div>
                </div>
                {agreed > 0 && advance > agreed && (
                  <p className="text-[13px] text-[#e0916f]">
                    The advance is larger than the agreed amount — that's an overpayment to
                    refund, not a balance.
                  </p>
                )}

                <div>
                  <label className={label}>Notes</label>
                  <textarea
                    rows={5}
                    value={draft.notes ?? ''}
                    onChange={(e) => set({ notes: e.target.value })}
                    className={field}
                  />
                </div>

                {/* Only on an unsaved row — on a saved client both statuses are
                    one click on the profile, and duplicating them here would
                    give the same field two save paths. */}
                {!draft.id && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="w-20 text-[13px] font-medium text-muted">
                        Booking
                      </span>
                      {STATUSES.map((s) => (
                        <button
                          key={s}
                          onClick={() => set({ status: s })}
                          className={`${pill} transition-colors ${
                            draft.status === s
                              ? statusClass[s]
                              : 'border-line text-muted hover:text-cream'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="w-20 text-[13px] font-medium text-muted">
                        Payment
                      </span>
                      {PAYMENT_STATUSES.map((s) => (
                        <button
                          key={s}
                          onClick={() => set({ payment_status: s })}
                          className={`${pill} transition-colors ${
                            draft.payment_status === s
                              ? paymentClass[s]
                              : 'border-line text-muted hover:text-cream'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 flex items-center gap-3 border-t border-line pt-6">
                <button
                  onClick={cancelEdit}
                  className={btnQuiet}
                >
                  Cancel
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  className={`ml-auto ${btnPrimary}`}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            /* ---------------------------------------------------------------
               Profile
               --------------------------------------------------------------- */
            /*
             * Full width, two columns from 1280px up: the booking on the left,
             * invoices alongside it rather than a screen below. On one narrow
             * column the invoice panel was permanently under the fold, which is
             * why raising one meant scrolling past the whole record first.
             */
            <div className="px-8 py-7 2xl:px-10">
              <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
                <div className="min-w-0 flex-1 basis-[360px]">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <h2 className="text-[26px] font-semibold tracking-[-0.015em] text-cream">
                      {draft.name}
                    </h2>
                    <span className={`${pill} ${statusClass[draft.status]}`}>{draft.status}</span>
                    <span className={`${pill} ${paymentClass[draft.payment_status]}`}>
                      {draft.payment_status}
                    </span>
                    {/* Icon-only, so both need a label: the glyph is the entire
                        control. Delete keeps its confirm() — an icon is easier to
                        hit by accident than a word. */}
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => setEditing(true)}
                        aria-label="Edit client"
                        title="Edit client"
                        className={iconBtn}
                      >
                        <PencilSimple size={16} aria-hidden />
                      </button>
                      <button
                        onClick={() => remove(draft.id)}
                        aria-label="Delete client"
                        title="Delete client"
                        className={iconBtnDanger}
                      >
                        <Trash size={16} aria-hidden />
                      </button>
                    </div>
                  </div>
                  <p className="mt-1.5 text-[13px] text-muted">
                    {fmtEventDate(draft.event_date, { weekday: 'short', month: 'long' }) ??
                      'No event date set'}
                    {draft.guest_count != null && ` · ${draft.guest_count} guests`}
                    {draft.event_type && ` · ${draft.event_type}`}
                  </p>
                  <p className="mt-1 text-[12px] text-muted/70">
                    Added {fmtDate(draft.created_at)}
                    {draft.lead_id && ' · converted from a lead'}
                  </p>
                </div>

                {/* The money, alone on the right. */}
                <div className="shrink-0">
                  <div className="overflow-hidden rounded-lg border border-line bg-panel/30">
                    <div className="flex divide-x divide-line">
                      {[
                        { k: 'Agreed', v: agreed },
                        { k: 'Advance paid', v: advance },
                        { k: 'Balance due', v: balanceDue },
                      ].map(({ k, v }, i) => (
                        <div key={k} className="min-w-[132px] px-4 py-3">
                          <div className="text-[12px] font-medium text-muted">{k}</div>
                          <div
                            className={`mt-0.5 text-[21px] font-semibold tracking-[-0.01em] ${i === 2 ? 'text-brass2' : 'text-cream'}`}
                          >
                            {agreed > 0 || v > 0 ? money(v) : '—'}
                          </div>
                        </div>
                      ))}
                    </div>
                    {agreed > 0 && (
                      <div className="h-[3px] w-full bg-line">
                        <div
                          className="h-full bg-brass transition-[width]"
                          style={{ width: `${paidPct}%` }}
                        />
                      </div>
                    )}
                  </div>
                  {agreed > 0 && advance > agreed && (
                    <p className="mt-2 max-w-[420px] text-[13px] text-[#e0916f]">
                      The advance is larger than the agreed amount — that&apos;s an overpayment to
                      refund, not a balance.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-7 grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_minmax(380px,460px)] 2xl:gap-9">
                <div className="min-w-0">
                  {/* Facts */}
                  <dl className="mt-7 grid grid-cols-2 gap-x-8 gap-y-6 border-t border-line pt-6 sm:grid-cols-3">
                    <Fact
                      label="Email"
                      value={
                        draft.email && (
                          <a href={`mailto:${draft.email}`} className="hover:text-brass2">
                            {draft.email}
                          </a>
                        )
                      }
                    />
                    <Fact
                      label="Phone"
                      value={
                        draft.phone && (
                          <a href={`tel:${draft.phone}`} className="hover:text-brass2">
                            {draft.phone}
                          </a>
                        )
                      }
                    />
                    <Fact label="Package" value={draft.package} />
                  </dl>

                  {draft.notes && (
                    <div className="mt-8 border-t border-line pt-7">
                      <h3 className="text-[13px] font-medium text-muted">Notes</h3>
                      <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-cream/90">
                        {draft.notes}
                      </p>
                    </div>
                  )}

                  {/* Statuses — one click each, saved immediately. */}
                  <div className="mt-8 space-y-3 border-t border-line pt-7">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="w-20 text-[13px] font-medium text-muted">
                        Booking
                      </span>
                      {STATUSES.map((s) => (
                        <button
                          key={s}
                          onClick={() => writeThrough({ status: s })}
                          className={`${pill} transition-colors ${
                            draft.status === s
                              ? statusClass[s]
                              : 'border-line text-muted hover:text-cream'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="w-20 text-[13px] font-medium text-muted">
                        Payment
                      </span>
                      {PAYMENT_STATUSES.map((s) => (
                        <button
                          key={s}
                          onClick={() => writeThrough({ payment_status: s })}
                          className={`${pill} transition-colors ${
                            draft.payment_status === s
                              ? paymentClass[s]
                              : 'border-line text-muted hover:text-cream'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    {/* The flag is set by hand and nothing reconciles it with the
                        money above, so say plainly when the two disagree. */}
                    {paymentMismatch && (
                      <p className="text-[13px] text-muted">{paymentMismatch}</p>
                    )}
                  </div>
                </div>

                {/* Sticks alongside the record on a tall screen, so the booking
                    stays readable while a long invoice list scrolls. */}
                <div className="min-w-0 xl:sticky xl:top-7">
                  <ClientInvoicePanel
                    booking={draft}
                    invoices={invoices}
                    onCreated={(inv) => setInvoices((prev) => [inv, ...prev])}
                    onStatusChange={(id, status) =>
                      setInvoices((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)))
                    }
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
