import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import { money } from '@/lib/invoice'
import { useList } from '@/hooks/use-site-content'
import { ClientInvoicePanel, type ClientInvoice } from '@/components/admin/client-invoice-panel'

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

const field =
  'w-full rounded-[1px] border border-line bg-transparent px-[12px] py-2 text-sm text-cream outline-none transition-colors focus:border-brass'
const label = 'mb-1 block text-[10px] uppercase tracking-[0.18em] text-muted'

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

/** Up to two initials for the monogram; falls back to a dash for a blank name. */
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase() || '—'

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
    <dt className="text-[10px] uppercase tracking-[0.18em] text-muted">{name}</dt>
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

  const visible = useMemo(
    () =>
      clients.filter(
        (c) =>
          (filter === 'all' || c.status === filter) &&
          (payFilter === 'all' || c.payment_status === payFilter),
      ),
    [clients, filter, payFilter],
  )

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
          <h1 className="font-serif text-2xl text-cream">Clients</h1>
          <p className="mt-1 text-[12px] text-muted">
            {clients.length} total{bookedCount > 0 && ` · ${bookedCount} booked`}
            {unpaidCount > 0 && ` · ${unpaidCount} not fully paid`}
          </p>
        </div>
        <div className="flex items-center gap-5">
          <div className="space-y-1.5 text-right">
            <div className="flex justify-end gap-1">
              {(['all', ...STATUSES] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`rounded-[2px] px-3 py-1 text-[11px] uppercase tracking-[0.12em] transition-colors ${
                    filter === s ? 'bg-brass/15 text-brass2' : 'text-muted hover:text-cream'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-end gap-1">
              <span className="mr-1 text-[9px] uppercase tracking-[0.16em] text-muted/60">
                Payment
              </span>
              {(['all', ...PAYMENT_STATUSES] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setPayFilter(s)}
                  className={`rounded-[2px] px-3 py-1 text-[11px] uppercase tracking-[0.12em] transition-colors ${
                    payFilter === s ? 'bg-brass/15 text-brass2' : 'text-muted hover:text-cream'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={startNew}
            className="bg-brass px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-onbrass transition-colors hover:bg-brass2"
          >
            + New client
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* List */}
        <div className="w-[380px] shrink-0 overflow-y-auto border-r border-line">
          {loading ? (
            <p className="px-8 py-10 text-sm text-muted">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="px-8 py-10 text-sm text-muted">
              No clients here yet. Convert a lead, or add one by hand.
            </p>
          ) : (
            visible.map((client) => (
              <button
                key={client.id}
                onClick={() => select(client)}
                className={`block w-full border-b border-line px-6 py-4 text-left transition-colors hover:bg-panel ${
                  selectedId === client.id ? 'bg-panel' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[14px] text-cream">{client.name}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] ${paymentClass[client.payment_status]}`}
                    >
                      {client.payment_status}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] ${statusClass[client.status]}`}
                    >
                      {client.status}
                    </span>
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-muted">
                  <span className="truncate">{client.event_type || 'Event'}</span>
                  <span className="shrink-0">{fmtEventDate(client.event_date) ?? '—'}</span>
                </div>
              </button>
            ))
          )}
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
            <div className="max-w-3xl px-10 py-8">
              <h2 className="font-serif text-2xl text-cream">
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
                  <p className="text-[11px] text-[#d98a6a]">
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
                      <span className="w-20 text-[11px] uppercase tracking-[0.18em] text-muted">
                        Booking
                      </span>
                      {STATUSES.map((s) => (
                        <button
                          key={s}
                          onClick={() => set({ status: s })}
                          className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.1em] transition-colors ${
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
                      <span className="w-20 text-[11px] uppercase tracking-[0.18em] text-muted">
                        Payment
                      </span>
                      {PAYMENT_STATUSES.map((s) => (
                        <button
                          key={s}
                          onClick={() => set({ payment_status: s })}
                          className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.1em] transition-colors ${
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
                  className="text-[11px] uppercase tracking-[0.16em] text-muted hover:text-cream"
                >
                  Cancel
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  className="ml-auto bg-brass px-5 py-2 text-[11px] uppercase tracking-[0.18em] text-onbrass hover:bg-brass2 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            /* ---------------------------------------------------------------
               Profile
               --------------------------------------------------------------- */
            <div className="max-w-3xl px-10 py-8">
              <div className="flex items-start gap-5">
                <div
                  aria-hidden
                  className="grid h-16 w-16 shrink-0 place-items-center rounded-full border border-brass/40 bg-brass/10 font-serif text-xl text-brass2"
                >
                  {initials(draft.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="font-serif text-3xl text-cream">{draft.name}</h2>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-[0.1em] ${statusClass[draft.status]}`}
                    >
                      {draft.status}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-[0.1em] ${paymentClass[draft.payment_status]}`}
                    >
                      {draft.payment_status}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[12px] text-muted">
                    {fmtEventDate(draft.event_date, { weekday: 'short', month: 'long' }) ??
                      'No event date set'}
                    {draft.guest_count != null && ` · ${draft.guest_count} guests`}
                    {draft.event_type && ` · ${draft.event_type}`}
                  </p>
                  <p className="mt-1 text-[11px] text-muted/70">
                    Added {fmtDate(draft.created_at)}
                    {draft.lead_id && ' · converted from a lead'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <button
                    onClick={() => setEditing(true)}
                    className="border border-line px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-cream transition-colors hover:border-brass hover:text-brass2"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => remove(draft.id)}
                    className="text-[11px] uppercase tracking-[0.16em] text-muted hover:text-[#d98a6a]"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Money */}
              <div className="mt-8 border border-line">
                <div className="grid grid-cols-3 divide-x divide-line">
                  {[
                    { k: 'Agreed', v: agreed },
                    { k: 'Advance paid', v: advance },
                    { k: 'Balance due', v: balanceDue },
                  ].map(({ k, v }, i) => (
                    <div key={k} className="px-5 py-4">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-muted">{k}</div>
                      <div
                        className={`mt-1 font-serif text-2xl ${i === 2 ? 'text-brass2' : 'text-cream'}`}
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
                <p className="mt-2 text-[11px] text-[#d98a6a]">
                  The advance is larger than the agreed amount — that's an overpayment to refund,
                  not a balance.
                </p>
              )}

              {/* Facts */}
              <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-6 border-t border-line pt-7 sm:grid-cols-3">
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
                  <h3 className="text-[10px] uppercase tracking-[0.18em] text-muted">Notes</h3>
                  <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-cream/90">
                    {draft.notes}
                  </p>
                </div>
              )}

              {/* Statuses — one click each, saved immediately. */}
              <div className="mt-8 space-y-3 border-t border-line pt-7">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="w-20 text-[11px] uppercase tracking-[0.18em] text-muted">
                    Booking
                  </span>
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      onClick={() => writeThrough({ status: s })}
                      className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.1em] transition-colors ${
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
                  <span className="w-20 text-[11px] uppercase tracking-[0.18em] text-muted">
                    Payment
                  </span>
                  {PAYMENT_STATUSES.map((s) => (
                    <button
                      key={s}
                      onClick={() => writeThrough({ payment_status: s })}
                      className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.1em] transition-colors ${
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
                  <p className="text-[11px] text-muted">{paymentMismatch}</p>
                )}
              </div>

              <ClientInvoicePanel
                booking={draft}
                invoices={invoices}
                onCreated={(inv) => setInvoices((prev) => [inv, ...prev])}
                onStatusChange={(id, status) =>
                  setInvoices((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)))
                }
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
