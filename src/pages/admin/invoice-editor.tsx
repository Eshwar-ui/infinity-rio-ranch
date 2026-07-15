import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import { computeTotals, money, type InvoiceData, type InvoiceItem } from '@/lib/invoice'
import { InvoiceDocument } from '@/components/invoice/invoice-document'

const today = () => new Date().toISOString().slice(0, 10)
const emptyItem = (): InvoiceItem => ({ description: '', qty: 1, unit_price: 0 })

const field =
  'w-full rounded-[1px] border border-line bg-transparent px-[12px] py-2 text-sm text-cream outline-none transition-colors focus:border-brass'
const label = 'mb-1 block text-[10px] uppercase tracking-[0.18em] text-muted'

type Form = {
  client_name: string
  client_email: string
  client_address: string
  issue_date: string
  due_date: string
  status: string
  tax_rate: string
  notes: string
}

export const InvoiceEditor = () => {
  const { id } = useParams()
  const navigate = useNavigate()

  const [form, setForm] = useState<Form>({
    client_name: '',
    client_email: '',
    client_address: '',
    issue_date: today(),
    due_date: '',
    status: 'draft',
    tax_rate: '0',
    notes: '',
  })
  const [items, setItems] = useState<InvoiceItem[]>([emptyItem()])
  const [number, setNumber] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)

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
        status: inv.status ?? 'draft',
        tax_rate: String(inv.tax_rate ?? 0),
        notes: inv.notes ?? '',
      })
      setNumber(inv.number)
      setToken(inv.public_token)
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

  const data: InvoiceData = { number, ...form, tax_rate: Number(form.tax_rate) || 0, items }
  const { total } = computeTotals(items, Number(form.tax_rate) || 0)

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
      status: form.status,
      tax_rate: Number(form.tax_rate) || 0,
      notes: form.notes || null,
    }

    let invoiceId = id ?? null
    if (id) {
      const { error } = await supabase.from('invoices').update(payload).eq('id', id)
      if (error) {
        toast.error('Could not save.')
        setSaving(false)
        return null
      }
      await supabase.from('invoice_items').delete().eq('invoice_id', id)
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
    if (rows.length) await supabase.from('invoice_items').insert(rows)

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
    const { error } = await supabase.functions.invoke('send-invoice', { body: { id: invoiceId } })
    setSending(false)
    if (error) {
      toast.error('Email not sent — the email service may not be configured yet.')
      return
    }
    await supabase.from('invoices').update({ status: 'sent' }).eq('id', invoiceId)
    set({ status: 'sent' })
    toast.success('Invoice emailed to the client.')
  }

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-8 py-5 print:hidden">
        <div>
          <button
            onClick={() => navigate('/admin/invoices')}
            className="text-[11px] uppercase tracking-[0.18em] text-muted hover:text-cream"
          >
            ← Invoices
          </button>
          <h1 className="mt-1 font-serif text-xl text-cream">
            {number ?? 'New invoice'}{' '}
            <span className="ml-2 text-[13px] text-brass2">{money(total)}</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {token && (
            <button
              onClick={() => window.print()}
              className="border border-line px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-cream hover:border-brass hover:text-brass2"
            >
              Print / PDF
            </button>
          )}
          {token && (
            <a
              href={`/invoice/${token}`}
              target="_blank"
              rel="noreferrer"
              className="border border-line px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-cream hover:border-brass hover:text-brass2"
            >
              Public link
            </a>
          )}
          <button
            onClick={sendToClient}
            disabled={sending || saving}
            className="border border-line px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-cream hover:border-brass hover:text-brass2 disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Email client'}
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="bg-brass px-5 py-2 text-[11px] uppercase tracking-[0.18em] text-onbrass hover:bg-brass2 disabled:opacity-50"
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
          <div className="flex gap-4">
            <div className="flex-1">
              <label className={label}>Status</label>
              <select value={form.status} onChange={(e) => set({ status: e.target.value })} className={field}>
                <option value="draft" className="bg-ink">draft</option>
                <option value="sent" className="bg-ink">sent</option>
                <option value="paid" className="bg-ink">paid</option>
              </select>
            </div>
            <div className="w-28">
              <label className={label}>Tax %</label>
              <input type="number" value={form.tax_rate} onChange={(e) => set({ tax_rate: e.target.value })} className={field} />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className={label}>Line items</label>
              <button onClick={addItem} className="text-[11px] uppercase tracking-[0.16em] text-brass2 hover:text-brass">
                + Add row
              </button>
            </div>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    placeholder="Description"
                    value={it.description}
                    onChange={(e) => updateItem(i, { description: e.target.value })}
                    className={`${field} flex-1`}
                  />
                  <input
                    type="number"
                    placeholder="Qty"
                    value={it.qty}
                    onChange={(e) => updateItem(i, { qty: Number(e.target.value) })}
                    className={`${field} w-16`}
                  />
                  <input
                    type="number"
                    placeholder="Price"
                    value={it.unit_price}
                    onChange={(e) => updateItem(i, { unit_price: Number(e.target.value) })}
                    className={`${field} w-24`}
                  />
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
