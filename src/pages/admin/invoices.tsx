import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import { money } from '@/lib/invoice'

type Row = Record<string, any>

const statusClass: Record<string, string> = {
  draft: 'border-line text-muted',
  sent: 'border-brass/40 text-brass2',
  paid: 'border-[#6a9a7a]/40 text-[#8fc0a0]',
}

const fmt = (d?: string | null) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

const rowTotal = (r: Row) => {
  const sub = (r.invoice_items ?? []).reduce(
    (s: number, i: Row) => s + (Number(i.qty) || 0) * (Number(i.unit_price) || 0),
    0,
  )
  return sub * (1 + (Number(r.tax_rate) || 0) / 100)
}

const rowAdvance = (r: Row) => Math.max(0, Number(r.advance_paid) || 0)

export const AdminInvoices = () => {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('invoices')
      .select('*, invoice_items(qty, unit_price)')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error('Could not load invoices.')
        else setRows(data ?? [])
        setLoading(false)
      })
  }, [])

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-line px-8 py-6">
        <div>
          <h1 className="font-serif text-2xl text-cream">Invoices</h1>
          <p className="mt-1 text-[12px] text-muted">{rows.length} total</p>
        </div>
        <button
          onClick={() => navigate('/admin/invoices/new')}
          className="bg-brass px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-onbrass transition-colors hover:bg-brass2"
        >
          + New invoice
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted">No invoices yet. Create the first one.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[10px] uppercase tracking-[0.14em] text-muted">
                <th className="py-3 font-medium">Number</th>
                <th className="py-3 font-medium">Client</th>
                <th className="py-3 font-medium">Issued</th>
                <th className="py-3 font-medium">Status</th>
                <th className="py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => navigate(`/admin/invoices/${r.id}`)}
                  className="cursor-pointer border-b border-line/60 transition-colors hover:bg-panel"
                >
                  <td className="py-3.5 font-medium text-cream">{r.number}</td>
                  <td className="py-3.5 text-cream/90">{r.client_name}</td>
                  <td className="py-3.5 text-muted">{fmt(r.issue_date)}</td>
                  <td className="py-3.5">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-[0.1em] ${
                        statusClass[r.status] ?? statusClass.draft
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="py-3.5 text-right font-medium text-cream">
                    {money(rowTotal(r))}
                    {rowAdvance(r) > 0 && (
                      <span className="block text-[11px] font-normal text-muted">
                        {money(Math.max(0, rowTotal(r) - rowAdvance(r)))} due
                      </span>
                    )}
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
