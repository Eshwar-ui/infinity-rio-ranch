import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, PencilSimple, Trash } from '@phosphor-icons/react'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import { money } from '@/lib/invoice'
import { useList } from '@/hooks/use-site-content'
import {
  btnGhost,
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
import { SuggestInput } from '@/components/ui/select'
import {
  PAYMENT_STATUSES,
  STATUSES,
  bookingTotals,
  daysUntilEvent,
  fmtDate,
  fmtEventDate,
  paymentClass,
  relativeEventDate,
  statusClass,
  type Client,
} from './client-shared'

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

/** One read-only label/value pair. */
const Fact = ({ label: name, value }: { label: string; value: React.ReactNode }) => (
  <div className="min-w-0">
    <dt className="text-[12px] font-medium text-muted">{name}</dt>
    {/* Wraps rather than truncates: an address clipped to "priya.raghunath…"
        is a value you have to open the edit form to read. */}
    <dd className="mt-1 break-words text-[14px] text-cream">
      {value || <span className="text-muted/60">Not set</span>}
    </dd>
  </div>
)

/** Marks the block a reader is scanning for. Sentence case, not a shout. */
const BlockLabel = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted/70">{children}</h2>
)

/**
 * A status, changed by clicking the one you want.
 *
 * Both status rows are the same control with a different palette, so they're
 * one component: the booking row and the payment row drifting apart in look is
 * how you end up unsure whether they behave the same way. `aria-pressed` rather
 * than a radio group because each button writes immediately on click.
 */
function StatusPicker<T extends string>({
  legend,
  value,
  options,
  tone,
  onPick,
}: {
  legend: string
  value: T
  options: readonly T[]
  tone: Record<T, string>
  onPick: (value: T) => void
}) {
  return (
    <div>
      <BlockLabel>{legend}</BlockLabel>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onPick(o)}
            aria-pressed={value === o}
            className={`${pill} transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/40 ${
              value === o ? tone[o] : 'border-line text-muted hover:border-line hover:text-cream'
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * One amount in the billing band. Three of these read left to right as the
 * sentence they are: agreed, paid so far, still owed — the last one carries the
 * weight because it's the number that decides whether you raise an invoice.
 */
const Amount = ({
  label: name,
  value,
  lead = false,
  settled = false,
}: {
  label: string
  value: string
  lead?: boolean
  settled?: boolean
}) => (
  <div>
    <dt className="text-[12px] font-medium text-muted">{name}</dt>
    <dd
      className={
        lead
          ? `mt-0.5 text-[24px] font-semibold tracking-[-0.015em] ${settled ? 'text-[#8fc0a0]' : 'text-brass2'}`
          : 'mt-0.5 text-[18px] font-medium text-cream'
      }
    >
      {value}
    </dd>
  </div>
)

/**
 * One client: their booking, their money, their invoices.
 *
 * A page of its own (`/admin/clients/:id`, `/admin/clients/new`) rather than the
 * right half of the list — same split as invoices. Read-only by default behind
 * an Edit toggle: this is what an owner looks at daily, and the fields are for
 * the rare correction.
 */
export const AdminClientDetail = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const isNew = !id

  const [client, setClient] = useState<Client | null>(null)
  // Non-null only while editing — the form never writes over what's on file
  // until Save comes back.
  const [draft, setDraft] = useState<Client | null>(isNew ? blank() : null)
  const [loading, setLoading] = useState(!isNew)
  const [notFound, setNotFound] = useState(false)
  const [saving, setSaving] = useState(false)
  const [invoices, setInvoices] = useState<ClientInvoice[]>([])
  const eventTypes = useList('event_types')

  useEffect(() => {
    if (!id) return
    let live = true
    setLoading(true)
    supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!live) return
        setLoading(false)
        if (error) {
          toast.error('Could not load this client.')
          return
        }
        if (!data) {
          setNotFound(true)
          return
        }
        setClient(data as Client)
      })
    return () => {
      live = false
    }
  }, [id])

  // What's been billed is part of the profile, not a separate errand.
  useEffect(() => {
    if (!id) {
      setInvoices([])
      return
    }
    let live = true
    supabase
      .from('invoices')
      .select(
        'id, number, status, issue_date, due_date, tax_rate, advance_paid, public_token, invoice_items(qty, unit_price)',
      )
      .eq('client_id', id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (live) setInvoices((data ?? []) as ClientInvoice[])
      })
    return () => {
      live = false
    }
  }, [id])

  const set = (patch: Partial<Client>) => setDraft((d) => (d ? { ...d, ...patch } : d))

  const cancelEdit = () => {
    // Never saved — there's no profile to fall back to.
    if (isNew) navigate('/admin/clients')
    else setDraft(null)
  }

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

    const write = draft.id
      ? supabase.from('clients').update(payload).eq('id', draft.id).select().single()
      : supabase.from('clients').insert(payload).select().single()

    const { data, error } = await write
    setSaving(false)
    if (error || !data) {
      toast.error('Could not save this client.')
      return
    }

    const saved = data as Client
    setClient(saved)
    setDraft(null)
    toast.success('Client saved.')
    // A new client now has a URL of its own — land on it, replacing /new so
    // Back doesn't reopen an empty form.
    if (!draft.id) navigate(`/admin/clients/${saved.id}`, { replace: true })
  }

  /**
   * The two status rows on the profile are one click each, so they write
   * straight through — optimistic, and rolled back on failure rather than
   * leaving the screen claiming something the DB never accepted.
   */
  const writeThrough = async (patch: Partial<Client>) => {
    if (!client) return
    const keys = Object.keys(patch) as (keyof Client)[]
    if (keys.every((k) => client[k] === patch[k])) return
    const previous = Object.fromEntries(keys.map((k) => [k, client[k]])) as Partial<Client>

    setClient((c) => (c ? { ...c, ...patch } : c))
    const { error } = await supabase.from('clients').update(patch).eq('id', client.id)
    if (error) {
      setClient((c) => (c ? { ...c, ...previous } : c))
      toast.error('Could not save that change.')
    }
  }

  const remove = async () => {
    if (!client) return
    if (!confirm('Delete this client permanently?')) return
    const { error } = await supabase.from('clients').delete().eq('id', client.id)
    if (error) {
      toast.error('Could not delete this client.')
      return
    }
    navigate('/admin/clients', { replace: true })
  }

  const back = (
    <Link
      to="/admin/clients"
      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/40"
    >
      <ArrowLeft size={14} aria-hidden />
      All clients
    </Link>
  )

  if (loading) {
    return (
      <div className="flex h-screen flex-col">
        <header className="border-b border-line px-8 py-6">{back}</header>
        <p className="px-8 py-8 text-[13px] text-muted">Loading…</p>
      </div>
    )
  }

  if (notFound || (!isNew && !client)) {
    return (
      <div className="flex h-screen flex-col">
        <header className="border-b border-line px-8 py-6">{back}</header>
        <div className="px-8 py-10">
          <p className="text-[14px] text-cream">That client no longer exists.</p>
          <Link to="/admin/clients" className={`mt-4 inline-block ${btnGhost}`}>
            Back to clients
          </Link>
        </div>
      </div>
    )
  }

  /* ---------------------------------------------------------------------
     Edit form — deliberately behind a toggle.
     --------------------------------------------------------------------- */
  if (draft) {
    const { agreed, advance } = bookingTotals(draft)
    return (
      <div className="flex h-screen flex-col">
        <header className="border-b border-line px-8 py-6">
          {back}
          <h1 className={`mt-2 ${pageTitle}`}>
            {draft.id ? `Editing ${draft.name || 'client'}` : 'New client'}
          </h1>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="max-w-4xl px-8 py-7 2xl:px-10">
            <div className="space-y-5">
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
                  {/* Suggestions, not a fixed list: the event types are
                      CMS-editable and old clients keep ones that were since
                      renamed or removed, so anything typed is accepted. */}
                  <SuggestInput
                    value={draft.event_type ?? ''}
                    onChange={(event_type) => set({ event_type })}
                    suggestions={eventTypes}
                    ariaLabel="Event type"
                    className={field}
                  />
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
                  The advance is larger than the agreed amount — that&apos;s an overpayment to
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
                    <span className="w-20 text-[13px] font-medium text-muted">Booking</span>
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
                    <span className="w-20 text-[13px] font-medium text-muted">Payment</span>
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
              <button onClick={cancelEdit} className={btnQuiet}>
                Cancel
              </button>
              <button onClick={save} disabled={saving} className={`ml-auto ${btnPrimary}`}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ---------------------------------------------------------------------
     Profile
     --------------------------------------------------------------------- */
  if (!client) return null

  const { agreed, advance, balanceDue } = bookingTotals(client)
  const paidPct = agreed > 0 ? Math.min(100, (advance / agreed) * 100) : 0
  const hasMoney = agreed > 0 || advance > 0

  const days = daysUntilEvent(client.event_date)
  const relative = relativeEventDate(days)
  // Close enough to be this week's problem, and still a live booking. A
  // cancelled date next Tuesday is not something to highlight.
  const imminent = client.status === 'booked' && days !== null && days >= 0 && days <= 30

  // The payment flag is set by hand, so it can drift from the amounts recorded
  // beside it. Nothing corrects either one — this just names the disagreement.
  const paymentMismatch = (() => {
    if (client.payment_status === 'unpaid' && advance > 0)
      return `Marked unpaid, though ${money(advance)} is recorded as received.`
    if (agreed <= 0) return null
    if (client.payment_status === 'paid' && balanceDue > 0)
      return `Marked paid, though the amounts still leave ${money(balanceDue)} outstanding.`
    if (client.payment_status === 'partial' && balanceDue === 0)
      return 'Marked part paid, though the amounts show nothing outstanding.'
    return null
  })()

  const edit = () => setDraft({ ...client })

  return (
    <div className="flex h-screen flex-col">
      {/* Identity and the two things you'd change about it. Everything the
          header used to carry as a subtitle now has a place in the body. */}
      <header className="border-b border-line px-8 py-5">
        {back}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-3">
          <h1 className="min-w-0 text-[28px] font-semibold leading-none tracking-[-0.02em] text-cream">
            {client.name}
          </h1>
          <div className="flex shrink-0 items-center gap-2">
            <span className={`${pill} ${statusClass[client.status]}`}>{client.status}</span>
            <span className={`${pill} ${paymentClass[client.payment_status]}`}>
              {client.payment_status}
            </span>
          </div>
          {/* Icon-only, so both need a label: the glyph is the entire control.
              Delete keeps its confirm() — an icon is easier to hit by accident
              than a word. */}
          <div className="ml-auto flex shrink-0 items-center gap-0.5">
            <button onClick={edit} aria-label="Edit client" title="Edit client" className={iconBtn}>
              <PencilSimple size={16} aria-hidden />
            </button>
            <button
              onClick={remove}
              aria-label="Delete client"
              title="Delete client"
              className={iconBtnDanger}
            >
              <Trash size={16} aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/*
         * Billing owns the main column; the booking is the rail beside it.
         * Opening a client is nearly always on the way to raising, sending or
         * checking an invoice, so that work gets the width and sits at the top
         * of the page. The event, the contact details and the two statuses are
         * what you read *while* doing it, not the reason you came.
         */}
        <div className="grid gap-x-10 gap-y-9 px-8 pb-14 pt-7 2xl:gap-x-14 2xl:px-10 xl:grid-cols-[minmax(0,1fr)_minmax(280px,320px)]">
          <div className="min-w-0 space-y-6">
            {/* The money the invoices are raised against, immediately above
                them rather than floating in the page header. */}
            <section className="rounded-lg border border-line bg-panel/20 p-5">
              {hasMoney ? (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-5">
                    <dl className="flex flex-wrap items-baseline gap-x-10 gap-y-4">
                      <Amount label="Agreed" value={money(agreed)} />
                      <Amount label="Advance paid" value={money(advance)} />
                      <Amount
                        label="Balance due"
                        value={money(balanceDue)}
                        lead
                        settled={agreed > 0 && balanceDue === 0}
                      />
                    </dl>
                    <StatusPicker
                      legend="Payment"
                      value={client.payment_status}
                      options={PAYMENT_STATUSES}
                      tone={paymentClass}
                      onPick={(s) => writeThrough({ payment_status: s })}
                    />
                  </div>

                  {agreed > 0 && (
                    <div className="mt-5">
                      <div className="h-1 overflow-hidden rounded-full bg-line">
                        <div
                          className="h-full rounded-full bg-brass transition-[width] duration-500"
                          style={{ width: `${paidPct}%` }}
                        />
                      </div>
                      <p className="mt-2 text-[12px] text-muted">
                        {Math.round(paidPct)}% of {money(agreed)} collected
                      </p>
                    </div>
                  )}
                  {agreed > 0 && advance > agreed && (
                    <p className="mt-3 max-w-[68ch] text-[13px] leading-relaxed text-[#e0916f]">
                      The advance is larger than the agreed amount, so that is an overpayment to
                      refund, not a balance.
                    </p>
                  )}
                  {/* Hand-set, and nothing reconciles it with the amounts beside
                      it, so say plainly when the two disagree. */}
                  {paymentMismatch && (
                    <p className="mt-3 max-w-[68ch] text-[13px] leading-relaxed text-muted">
                      {paymentMismatch}
                    </p>
                  )}
                </>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-x-10 gap-y-4">
                  <p className="max-w-[68ch] text-[13px] leading-relaxed text-muted">
                    No amounts recorded.{' '}
                    <button
                      onClick={edit}
                      className="font-medium text-brass2 transition-colors hover:text-brass"
                    >
                      Set the agreed amount
                    </button>{' '}
                    and the balance is tracked here.
                  </p>
                  <StatusPicker
                    legend="Payment"
                    value={client.payment_status}
                    options={PAYMENT_STATUSES}
                    tone={paymentClass}
                    onPick={(s) => writeThrough({ payment_status: s })}
                  />
                </div>
              )}
            </section>

            <ClientInvoicePanel
              booking={client}
              invoices={invoices}
              onCreated={(inv) => setInvoices((prev) => [inv, ...prev])}
              onStatusChange={(invId, status) =>
                setInvoices((prev) => prev.map((i) => (i.id === invId ? { ...i, status } : i)))
              }
            />
          </div>

          {/* The booking itself: read while working, so it stays on screen as
              a long invoice list scrolls. */}
          <aside className="min-w-0">
            <div className="xl:sticky xl:top-7">
              <section>
                <BlockLabel>Event</BlockLabel>
                <p className="mt-2.5 text-[19px] font-semibold leading-snug tracking-[-0.01em] text-cream">
                  {fmtEventDate(client.event_date, { weekday: 'short', month: 'long' }) ??
                    'No date set'}
                </p>
                {relative && (
                  <p className="mt-1.5">
                    {imminent ? (
                      <span className="rounded-full border border-brass/40 bg-brass/15 px-2.5 py-0.5 text-[12px] font-medium text-brass2">
                        {relative}
                      </span>
                    ) : (
                      <span className="text-[13px] text-muted">{relative}</span>
                    )}
                  </p>
                )}
                <dl className="mt-5 space-y-4">
                  <Fact label="Type" value={client.event_type} />
                  <Fact
                    label="Guests"
                    value={client.guest_count != null ? client.guest_count.toLocaleString() : null}
                  />
                  <Fact label="Package" value={client.package} />
                </dl>
              </section>

              <section className="mt-7 border-t border-line pt-6">
                <BlockLabel>Contact</BlockLabel>
                <dl className="mt-4 space-y-4">
                  <Fact
                    label="Email"
                    value={
                      client.email && (
                        <a
                          href={`mailto:${client.email}`}
                          className="transition-colors hover:text-brass2"
                        >
                          {client.email}
                        </a>
                      )
                    }
                  />
                  <Fact
                    label="Phone"
                    value={
                      client.phone && (
                        <a
                          href={`tel:${client.phone}`}
                          className="transition-colors hover:text-brass2"
                        >
                          {client.phone}
                        </a>
                      )
                    }
                  />
                </dl>
              </section>

              <section className="mt-7 border-t border-line pt-6">
                <StatusPicker
                  legend="Booking"
                  value={client.status}
                  options={STATUSES}
                  tone={statusClass}
                  onPick={(s) => writeThrough({ status: s })}
                />
              </section>

              {/* Notes keep their place whether or not there are any: a section
                  that vanishes when empty is one nobody remembers exists. */}
              <section className="mt-7 border-t border-line pt-6">
                <div className="flex items-center justify-between gap-4">
                  <BlockLabel>Notes</BlockLabel>
                  {client.notes && (
                    <button onClick={edit} className={btnQuiet}>
                      Edit
                    </button>
                  )}
                </div>
                {client.notes ? (
                  <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-cream/90">
                    {client.notes}
                  </p>
                ) : (
                  <p className="mt-3 text-[13px] text-muted">
                    Nothing noted yet.{' '}
                    <button
                      onClick={edit}
                      className="font-medium text-brass2 transition-colors hover:text-brass"
                    >
                      Add a note
                    </button>
                  </p>
                )}
              </section>

              <p className="mt-7 text-[12px] text-muted/70">
                Added {fmtDate(client.created_at)}
                {client.lead_id && ' · converted from a lead'}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
