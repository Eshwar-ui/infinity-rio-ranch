import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import { computeTotals, money, type InvoiceItem } from '@/lib/invoice'

/** The slice of an invoice this panel lists and totals up. */
export type ClientInvoice = {
  id: string
  number: string | null
  status: string
  issue_date: string | null
  due_date: string | null
  tax_rate: number | null
  advance_paid: number | null
  public_token: string | null
  invoice_items: { qty: number; unit_price: number }[] | null
}

/** Just the client fields an invoice is built from. */
export type InvoiceBooking = {
  id: string
  name: string
  email: string | null
  package: string | null
  event_type: string | null
  event_date: string | null
  amount: number | null
  advance_amount: number | null
}

const field =
  'w-full rounded-[1px] border border-line bg-transparent px-[12px] py-2 text-sm text-cream outline-none transition-colors focus:border-brass'
const label = 'mb-1 block text-[10px] uppercase tracking-[0.18em] text-muted'

const statusClass: Record<string, string> = {
  draft: 'border-line text-muted',
  sent: 'border-brass/40 text-brass2',
  paid: 'border-[#6a9a7a]/40 text-[#8fc0a0]',
}

const today = () => new Date().toISOString().slice(0, 10)

/** Bare dates shift a day if parsed without a time zone. */
const fmtDate = (d?: string | null) =>
  d
    ? new Date(d + 'T00:00:00').toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '—'

const totalsOf = (inv: ClientInvoice) =>
  computeTotals(
    (inv.invoice_items ?? []).map((i) => ({ description: '', qty: i.qty, unit_price: i.unit_price })),
    Number(inv.tax_rate) || 0,
    Number(inv.advance_paid) || 0,
  )

type Draft = {
  issue_date: string
  due_date: string
  tax_rate: string
  advance_paid: string
  notes: string
  items: InvoiceItem[]
}

/**
 * Invoices for one client, raised without leaving their profile.
 *
 * The composer only ever creates: editing an existing invoice stays in the full
 * editor, which owns the number, the public token and the send state. Two places
 * that can rewrite an invoice already emailed to a client is one too many.
 */
export const ClientInvoicePanel = ({
  booking,
  invoices,
  onCreated,
  onStatusChange,
}: {
  booking: InvoiceBooking
  invoices: ClientInvoice[]
  onCreated: (invoice: ClientInvoice) => void
  onStatusChange: (id: string, status: string) => void
}) => {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [creating, setCreating] = useState(false)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)

  // What the advance has already been credited against. Prefilling a second
  // invoice with the full deposit would credit the same money twice.
  const credited = invoices.reduce((s, i) => s + (Number(i.advance_paid) || 0), 0)
  const uncredited = Math.max(0, (Number(booking.advance_amount) || 0) - credited)

  const startDraft = () => {
    const description =
      [booking.package, booking.event_type].find((v) => (v ?? '').trim()) ?? ''
    setDraft({
      issue_date: today(),
      due_date: '',
      tax_rate: '0',
      advance_paid: String(uncredited),
      notes: booking.event_date ? `Event date: ${fmtDate(booking.event_date)}` : '',
      // The first invoice bills the booking; later ones start empty rather than
      // silently re-billing the whole amount.
      items: [
        {
          description,
          qty: 1,
          unit_price: invoices.length === 0 ? Number(booking.amount) || 0 : 0,
        },
      ],
    })
    setOpen(true)
  }

  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d))
  const setItem = (i: number, patch: Partial<InvoiceItem>) =>
    setDraft((d) =>
      d ? { ...d, items: d.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) } : d,
    )
  const addItem = () =>
    setDraft((d) => (d ? { ...d, items: [...d.items, { description: '', qty: 1, unit_price: 0 }] } : d))
  const removeItem = (i: number) =>
    setDraft((d) => (d ? { ...d, items: d.items.filter((_, idx) => idx !== i) } : d))

  const preview = draft
    ? computeTotals(draft.items, Number(draft.tax_rate) || 0, Number(draft.advance_paid) || 0)
    : null

  const create = async () => {
    if (!draft) return
    const rows = draft.items.filter((it) => it.description.trim() || Number(it.unit_price))
    if (rows.length === 0) return toast.error('Add at least one line item.')

    setCreating(true)
    const { data, error } = await supabase
      .from('invoices')
      .insert({
        client_id: booking.id,
        // Denormalised on purpose: the invoice must still read correctly years
        // later, even if the client record is edited or deleted.
        client_name: booking.name,
        client_email: booking.email,
        issue_date: draft.issue_date || today(),
        due_date: draft.due_date || null,
        status: 'draft',
        tax_rate: Number(draft.tax_rate) || 0,
        advance_paid: Math.max(0, Number(draft.advance_paid) || 0),
        notes: draft.notes || null,
      })
      .select('id, number, status, issue_date, due_date, tax_rate, advance_paid, public_token')
      .single()

    if (error || !data) {
      setCreating(false)
      toast.error('Could not create the invoice.')
      return
    }

    const items = rows.map((it, i) => ({
      invoice_id: data.id,
      description: it.description,
      qty: Number(it.qty) || 0,
      unit_price: Number(it.unit_price) || 0,
      sort: i,
    }))
    const { error: itemsError } = await supabase.from('invoice_items').insert(items)
    setCreating(false)

    if (itemsError) {
      // The invoice exists but is empty — say so, and leave it recoverable in
      // the full editor rather than pretending the whole thing worked.
      toast.error(`${data.number} was created but its line items did not save — open it to finish.`)
    } else {
      toast.success(`${data.number} created.`)
    }

    onCreated({
      ...(data as Omit<ClientInvoice, 'invoice_items'>),
      invoice_items: items.map((i) => ({ qty: i.qty, unit_price: i.unit_price })),
    })
    setOpen(false)
    setDraft(null)
  }

  /** Surfaces the function's own message instead of a generic failure. */
  const functionError = async (error: unknown, fallback: string) => {
    const res = (error as { context?: Response })?.context
    try {
      const body = await res?.clone().json()
      if (body?.error) return String(body.error)
    } catch {
      /* non-JSON body — fall through */
    }
    return fallback
  }

  const email = async (invoice: ClientInvoice) => {
    if (!booking.email) return toast.error('This client has no email address.')
    setSendingId(invoice.id)
    const { data, error } = await supabase.functions.invoke('send-invoice', {
      body: { id: invoice.id },
    })
    setSendingId(null)
    if (error) {
      toast.error(await functionError(error, 'Email not sent — the email service may not be configured yet.'))
      return
    }
    await supabase.from('invoices').update({ status: 'sent' }).eq('id', invoice.id)
    onStatusChange(invoice.id, 'sent')
    // Say when the agreement didn't ride along — a missing template would
    // otherwise look exactly like a successful send.
    toast.success(
      data?.agreement
        ? 'Invoice and rental agreement emailed to the client.'
        : 'Invoice emailed — no agreement attached (no template uploaded).',
    )
  }

  /** The exact PDF the email would attach, so it can be checked first. */
  const previewAgreement = async (invoice: ClientInvoice) => {
    setPreviewId(invoice.id)
    const { data, error } = await supabase.functions.invoke('send-invoice', {
      body: { id: invoice.id, preview: 1 },
    })
    setPreviewId(null)
    if (error || !(data instanceof Blob)) {
      toast.error(await functionError(error, 'Could not build the agreement.'))
      return
    }
    // A download rather than window.open: this runs after an await, and popup
    // blockers treat that as unsolicited.
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url
    a.download = `Rental Agreement - ${booking.name}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="mt-10 border-t border-line pt-7">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h3 className="font-serif text-lg text-cream">Invoices</h3>
          <p className="mt-0.5 text-[12px] text-muted">
            {invoices.length === 0
              ? 'Nothing raised yet for this booking.'
              : `${invoices.length} raised${uncredited > 0 ? ` · ${money(uncredited)} of the advance still uncredited` : ''}`}
          </p>
          <p className="mt-0.5 text-[11px] text-muted/70">
            Emailing an invoice attaches this client's rental agreement, filled in and
            ready to print and sign.
          </p>
        </div>
        {!open && (
          <button
            onClick={startDraft}
            className="shrink-0 border border-brass px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-brass2 transition-colors hover:bg-brass hover:text-onbrass"
          >
            + New invoice
          </button>
        )}
      </div>

      {invoices.length > 0 && (
        <ul className="mt-5 space-y-2">
          {invoices.map((inv) => {
            const { total, advance, balance } = totalsOf(inv)
            return (
              <li
                key={inv.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 border border-line px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-cream">{inv.number ?? 'Draft'}</span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] ${
                        statusClass[inv.status] ?? statusClass.draft
                      }`}
                    >
                      {inv.status}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted">
                    Issued {fmtDate(inv.issue_date)}
                    {inv.due_date && ` · due ${fmtDate(inv.due_date)}`}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[13px] text-cream">{money(total)}</div>
                  {advance > 0 && (
                    <div className="text-[11px] text-muted">{money(balance)} due</div>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-3 text-[10px] uppercase tracking-[0.14em]">
                  <Link to={`/admin/invoices/${inv.id}`} className="text-muted hover:text-brass2">
                    Open
                  </Link>
                  {inv.public_token && (
                    <a
                      href={`/invoice/${inv.public_token}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted hover:text-brass2"
                    >
                      Link
                    </a>
                  )}
                  <button
                    onClick={() => previewAgreement(inv)}
                    disabled={previewId === inv.id}
                    title="Download the rental agreement exactly as this email would attach it"
                    className="uppercase tracking-[0.14em] text-muted hover:text-brass2 disabled:opacity-50"
                  >
                    {previewId === inv.id ? 'Building…' : 'Agreement'}
                  </button>
                  <button
                    onClick={() => email(inv)}
                    disabled={sendingId === inv.id}
                    className="uppercase tracking-[0.14em] text-muted hover:text-brass2 disabled:opacity-50"
                  >
                    {sendingId === inv.id ? 'Sending…' : 'Email'}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {open && draft && preview && (
        <div className="mt-5 border border-brass/30 bg-panel/40 p-5">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className={label}>Issue date</label>
              <input
                type="date"
                value={draft.issue_date}
                onChange={(e) => set({ issue_date: e.target.value })}
                className={field}
              />
            </div>
            <div className="flex-1">
              <label className={label}>Due date</label>
              <input
                type="date"
                value={draft.due_date}
                onChange={(e) => set({ due_date: e.target.value })}
                className={field}
              />
            </div>
            <div className="w-24">
              <label className={label}>Tax %</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={draft.tax_rate}
                onChange={(e) => set({ tax_rate: e.target.value })}
                className={field}
              />
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <span className={label}>Line items</span>
              <button
                onClick={addItem}
                className="text-[11px] uppercase tracking-[0.16em] text-brass2 hover:text-brass"
              >
                + Add row
              </button>
            </div>
            <div className="space-y-2">
              {/* The inputs are sized by their wrappers, not by width classes on
                  the inputs themselves: `field` already carries w-full, which
                  Tailwind emits after w-16/w-28 and would win regardless of the
                  order they're written in. */}
              {draft.items.map((it, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <input
                      placeholder="Description"
                      value={it.description}
                      onChange={(e) => setItem(i, { description: e.target.value })}
                      className={field}
                    />
                  </div>
                  <div className="w-20 shrink-0">
                    <input
                      type="number"
                      aria-label="Quantity"
                      value={it.qty}
                      onChange={(e) => setItem(i, { qty: Number(e.target.value) })}
                      className={field}
                    />
                  </div>
                  <div className="w-28 shrink-0">
                    <input
                      type="number"
                      aria-label="Unit price"
                      step="0.01"
                      value={it.unit_price}
                      onChange={(e) => setItem(i, { unit_price: Number(e.target.value) })}
                      className={field}
                    />
                  </div>
                  <button
                    onClick={() => removeItem(i)}
                    aria-label="Remove row"
                    className="shrink-0 px-2 text-muted hover:text-[#d98a6a]"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-6">
            <div className="w-44">
              <label className={label}>Advance credited</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={draft.advance_paid}
                onChange={(e) => set({ advance_paid: e.target.value })}
                className={field}
              />
            </div>
            <dl className="ml-auto w-56 text-[12px]">
              <div className="flex justify-between py-0.5 text-muted">
                <dt>Subtotal</dt>
                <dd>{money(preview.subtotal)}</dd>
              </div>
              <div className="flex justify-between py-0.5 text-muted">
                <dt>Tax</dt>
                <dd>{money(preview.tax)}</dd>
              </div>
              <div className="flex justify-between border-t border-line py-1 text-cream">
                <dt>Total</dt>
                <dd>{money(preview.total)}</dd>
              </div>
              {preview.advance > 0 && (
                <>
                  <div className="flex justify-between py-0.5 text-muted">
                    <dt>Advance</dt>
                    <dd>− {money(preview.advance)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-line py-1 text-brass2">
                    <dt>Balance due</dt>
                    <dd>{money(preview.balance)}</dd>
                  </div>
                </>
              )}
            </dl>
          </div>

          <div className="mt-5">
            <label className={label}>Notes</label>
            <textarea
              rows={2}
              value={draft.notes}
              onChange={(e) => set({ notes: e.target.value })}
              className={field}
            />
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={() => {
                setOpen(false)
                setDraft(null)
              }}
              className="text-[11px] uppercase tracking-[0.16em] text-muted hover:text-cream"
            >
              Cancel
            </button>
            <button
              onClick={create}
              disabled={creating}
              className="ml-auto bg-brass px-5 py-2 text-[11px] uppercase tracking-[0.18em] text-onbrass hover:bg-brass2 disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Create invoice'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
