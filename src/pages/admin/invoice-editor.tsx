import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import { btnGhost, btnPrimary, btnQuiet, btnSmall, field, hint, label } from '@/lib/admin-ui'
import {
  computeTotals,
  money,
  sentMessage,
  type InvoiceData,
  type InvoiceItem,
  type SendResult,
} from '@/lib/invoice'
import { InvoiceDocument } from '@/components/invoice/invoice-document'

const today = () => new Date().toISOString().slice(0, 10)
const emptyItem = (): InvoiceItem => ({ description: '', qty: 1, unit_price: 0 })


type Form = {
  client_name: string
  client_email: string
  client_address: string
  issue_date: string
  due_date: string
  tax_rate: string
  advance_paid: string
  notes: string
}

/** `event_date` is a bare date — parsing it without a time zone shifts it a day. */
const fmtEventDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

export const InvoiceEditor = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  // `?client=<uuid>` — set by the Clients page's "Generate invoice" button.
  const [params] = useSearchParams()
  const fromClient = params.get('client')

  const [form, setForm] = useState<Form>({
    client_name: '',
    client_email: '',
    client_address: '',
    issue_date: today(),
    due_date: '',
    tax_rate: '0',
    advance_paid: '0',
    notes: '',
  })
  const [items, setItems] = useState<InvoiceItem[]>([emptyItem()])
  const [number, setNumber] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [clientId, setClientId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)

  // Prefill a brand-new invoice from the client it's being raised for. Runs only
  // when there's no invoice id — on an existing invoice the saved row wins, so a
  // stale link can never overwrite what was already sent to the client.
  useEffect(() => {
    if (id || !fromClient) return
    ;(async () => {
      const { data: client } = await supabase
        .from('clients')
        .select('*')
        .eq('id', fromClient)
        .maybeSingle()
      if (!client) {
        toast.error('That client no longer exists.')
        return
      }
      setClientId(client.id)
      setForm((f) => ({
        ...f,
        client_name: client.name ?? '',
        client_email: client.email ?? '',
        advance_paid: String(Number(client.advance_amount) || 0),
        notes: client.event_date
          ? `Event date: ${fmtEventDate(client.event_date)}`
          : f.notes,
      }))
      // One starting line for the booking. Never assume the package or amount is
      // set — either can be blank, and an empty row is edited, not deleted.
      const description =
        [client.package, client.event_type].find((v) => (v ?? '').trim()) ?? ''
      setItems([{ description, qty: 1, unit_price: Number(client.amount) || 0 }])
    })()
  }, [id, fromClient])

  useEffect(() => {
    if (!id) return
    ;(async () => {
      const { data: inv } = await supabase.from('invoices').select('*').eq('id', id).single()
      if (!inv) {
        toast.error('Invoice not found.')
        return
      }
      setForm({
        client_name: inv.client_name ?? '',
        client_email: inv.client_email ?? '',
        client_address: inv.client_address ?? '',
        issue_date: inv.issue_date ?? today(),
        due_date: inv.due_date ?? '',
        tax_rate: String(inv.tax_rate ?? 0),
        advance_paid: String(inv.advance_paid ?? 0),
        notes: inv.notes ?? '',
      })
      setNumber(inv.number)
      setToken(inv.public_token)
      setClientId(inv.client_id ?? null)
      const { data: its } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', id)
        .order('sort', { ascending: true })
      setItems(its && its.length ? its.map((i) => ({ description: i.description, qty: Number(i.qty), unit_price: Number(i.unit_price) })) : [emptyItem()])
    })()
  }, [id])

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }))
  const updateItem = (i: number, patch: Partial<InvoiceItem>) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  const addItem = () => setItems((prev) => [...prev, emptyItem()])
  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i))

  const advancePaid = Number(form.advance_paid) || 0
  const data: InvoiceData = {
    number,
    ...form,
    tax_rate: Number(form.tax_rate) || 0,
    advance_paid: advancePaid,
    items,
  }
  const { total, balance } = computeTotals(items, Number(form.tax_rate) || 0, advancePaid)

  const save = async (): Promise<string | null> => {
    if (!form.client_name.trim()) {
      toast.error('Client name is required.')
      return null
    }
    setSaving(true)
    const payload = {
      client_name: form.client_name,
      client_email: form.client_email || null,
      client_address: form.client_address || null,
      issue_date: form.issue_date,
      due_date: form.due_date || null,
      tax_rate: Number(form.tax_rate) || 0,
      advance_paid: Math.max(0, Number(form.advance_paid) || 0),
      client_id: clientId,
      notes: form.notes || null,
    }

    let invoiceId = id ?? null
    /*
     * The rows that are on file right now, captured before anything is written.
     *
     * Line items are replaced wholesale, and the order that happens in decides
     * what a failure costs. This used to delete first and insert after without
     * checking either call, so a failed insert left the invoice with no line
     * items at all, a total of $0 and a toast saying it had saved — on a
     * document that may already have been emailed to a client.
     *
     * Insert first, then delete these by id: a failed insert changes nothing,
     * and a failed delete leaves the old lines *beside* the new ones. Duplicated
     * lines are visible and fixable; deleted ones are neither.
     */
    let replacing: string[] = []
    if (id) {
      const { error } = await supabase.from('invoices').update(payload).eq('id', id)
      if (error) {
        toast.error('Could not save.')
        setSaving(false)
        return null
      }
      const { data: existing, error: readError } = await supabase
        .from('invoice_items')
        .select('id')
        .eq('invoice_id', id)
      if (readError) {
        toast.error('Saved the invoice details, but its line items could not be read — nothing was changed. Try again.')
        setSaving(false)
        return null
      }
      replacing = (existing ?? []).map((row) => row.id as string)
    } else {
      const { data: inv, error } = await supabase.from('invoices').insert(payload).select().single()
      if (error) {
        toast.error('Could not save.')
        setSaving(false)
        return null
      }
      invoiceId = inv.id
      setNumber(inv.number)
      setToken(inv.public_token)
    }

    const rows = items
      .filter((it) => it.description.trim() || Number(it.unit_price))
      .map((it, i) => ({
        invoice_id: invoiceId,
        description: it.description,
        qty: Number(it.qty) || 0,
        unit_price: Number(it.unit_price) || 0,
        sort: i,
      }))

    if (rows.length) {
      const { error } = await supabase.from('invoice_items').insert(rows)
      if (error) {
        toast.error('The invoice details saved, but the line items did not — the previous lines are untouched. Try saving again.')
        setSaving(false)
        return null
      }
    }

    if (replacing.length) {
      const { error } = await supabase.from('invoice_items').delete().in('id', replacing)
      if (error) {
        // Both sets are on the invoice now. Say exactly that, because the
        // document is readable and wrong rather than unreadable.
        toast.error('Saved, but the previous line items could not be removed — this invoice now shows them twice. Reload and delete the duplicates.')
        setSaving(false)
        // Null, not the id: `sendToClient` saves before it emails, and a
        // document showing every line twice must not be what reaches a client.
        return null
      }
    }

    setSaving(false)
    toast.success('Invoice saved.')
    if (!id && invoiceId) navigate(`/admin/invoices/${invoiceId}`, { replace: true })
    return invoiceId
  }

  const sendToClient = async () => {
    if (!form.client_email.trim()) return toast.error('Add a client email first.')
    const invoiceId = await save()
    if (!invoiceId) return
    setSending(true)
    const { data, error } = await supabase.functions.invoke('send-invoice', {
      body: { id: invoiceId },
    })
    setSending(false)
    if (error) {
      toast.error('Email not sent — the email service may not be configured yet.')
      return
    }
    // Which of the two happened, in the same words the client panel uses: the
    // agreement goes with a booking's first invoice, and its absence is either
    // the design or a template nobody has uploaded yet.
    toast.success(sentMessage(data as SendResult))
  }

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-8 py-5 print:hidden">
        <div>
          <button
            onClick={() => navigate('/admin/invoices')}
            className={btnQuiet}
          >
            ← Invoices
          </button>
          <h1 className="mt-1 text-[18px] font-semibold tracking-[-0.01em] text-cream">
            {number ?? 'New invoice'}{' '}
            <span className="ml-2 text-[13px] text-brass2">{money(total)}</span>
            {advancePaid > 0 && (
              <span className="ml-2 text-[12px] text-muted">
                · {money(balance)} due after advance
              </span>
            )}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {token && (
            <button
              onClick={() => window.print()}
              className={btnGhost}
            >
              Print / PDF
            </button>
          )}
          {token && (
            <a
              href={`/invoice/${token}`}
              target="_blank"
              rel="noreferrer"
              className={btnGhost}
            >
              Public link
            </a>
          )}
          <button
            onClick={sendToClient}
            disabled={sending || saving}
            className={btnGhost}
          >
            {sending ? 'Sending…' : 'Email client'}
          </button>
          <button
            onClick={save}
            disabled={saving}
            className={btnPrimary}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-8 p-8 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] print:block print:p-0">
        {/* Form */}
        <div className="space-y-5 print:hidden">
          <div>
            <label className={label}>Client name *</label>
            <input value={form.client_name} onChange={(e) => set({ client_name: e.target.value })} className={field} />
          </div>
          <div>
            <label className={label}>Client email</label>
            <input value={form.client_email} onChange={(e) => set({ client_email: e.target.value })} className={field} />
          </div>
          <div>
            <label className={label}>Client address</label>
            <textarea rows={2} value={form.client_address} onChange={(e) => set({ client_address: e.target.value })} className={field} />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className={label}>Issue date</label>
              <input type="date" value={form.issue_date} onChange={(e) => set({ issue_date: e.target.value })} className={field} />
            </div>
            <div className="flex-1">
              <label className={label}>Due date</label>
              <input type="date" value={form.due_date} onChange={(e) => set({ due_date: e.target.value })} className={field} />
            </div>
          </div>
          <div className="w-28">
            <label className={label}>Tax %</label>
            <input type="number" value={form.tax_rate} onChange={(e) => set({ tax_rate: e.target.value })} className={field} />
          </div>

          <div>
            <label className={label}>Advance paid</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.advance_paid}
              onChange={(e) => set({ advance_paid: e.target.value })}
              className={field}
            />
            <p className={hint}>
              Deducted from the total as a credit. Prefilled from the client's advance —
              clear it on a follow-up invoice so the same deposit isn't credited twice.
            </p>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className={label}>Line items</label>
              <button onClick={addItem} className={btnSmall}>
                + Add row
              </button>
            </div>
            <div className="space-y-2">
              {/* Sized by the wrappers — `field` carries w-full, which Tailwind
                  emits after w-16/w-24 and wins over them on the input itself. */}
              {items.map((it, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <input
                      placeholder="Description"
                      value={it.description}
                      onChange={(e) => updateItem(i, { description: e.target.value })}
                      className={field}
                    />
                  </div>
                  <div className="w-20 shrink-0">
                    <input
                      type="number"
                      placeholder="Qty"
                      value={it.qty}
                      onChange={(e) => updateItem(i, { qty: Number(e.target.value) })}
                      className={field}
                    />
                  </div>
                  <div className="w-28 shrink-0">
                    <input
                      type="number"
                      placeholder="Price"
                      value={it.unit_price}
                      onChange={(e) => updateItem(i, { unit_price: Number(e.target.value) })}
                      className={field}
                    />
                  </div>
                  <button
                    onClick={() => removeItem(i)}
                    aria-label="Remove row"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[#e0916f]/45 bg-[#e0916f]/10 text-[#eeb099] shadow-[0_1px_0_rgba(0,0,0,0.2),0_2px_6px_rgba(0,0,0,0.1)] transition-all hover:-translate-y-px hover:border-[#e0916f] hover:bg-[#e0916f]/20 active:translate-y-0 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e0916f]/40"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className={label}>Notes</label>
            <textarea rows={3} value={form.notes} onChange={(e) => set({ notes: e.target.value })} className={field} />
          </div>
        </div>

        {/* Live preview */}
        <div className="overflow-x-auto">
          <InvoiceDocument data={data} />
        </div>
      </div>
    </div>
  )
}
