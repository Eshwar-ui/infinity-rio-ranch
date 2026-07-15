import { contact } from '@/data/site'
import { computeTotals, money, type InvoiceData } from '@/lib/invoice'

const statusStyle: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700',
}

const fmt = (d?: string | null) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

/** White, print-ready invoice. Reused by the admin preview and the public page. */
export const InvoiceDocument = ({ data }: { data: InvoiceData }) => {
  const { subtotal, tax, total } = computeTotals(data.items, data.tax_rate)

  return (
    <div className="invoice-print mx-auto max-w-[820px] bg-white p-[clamp(24px,5vw,56px)] font-sans text-[#2a2320] shadow-sm print:shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-6 border-b border-[#e6ddcf] pb-8">
        <div>
          <div className="font-serif text-2xl text-[#1a1512]">Infinity at Rio Ranch</div>
          <div className="mt-1 text-[12px] leading-relaxed text-[#6b6155]">
            {contact.address}
            <br />
            {contact.email} · {contact.phones[0]}
          </div>
        </div>
        <div className="text-right">
          <div className="font-serif text-3xl tracking-wide text-[#b08d3f]">INVOICE</div>
          <div className="mt-1 text-[13px] font-medium text-[#2a2320]">{data.number ?? 'Draft'}</div>
          <span
            className={`mt-2 inline-block rounded-full px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
              statusStyle[data.status] ?? statusStyle.draft
            }`}
          >
            {data.status}
          </span>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap justify-between gap-8">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a99a86]">Bill to</div>
          <div className="mt-1.5 text-[15px] font-medium text-[#1a1512]">{data.client_name}</div>
          {data.client_email && <div className="text-[13px] text-[#6b6155]">{data.client_email}</div>}
          {data.client_address && (
            <div className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-[#6b6155]">
              {data.client_address}
            </div>
          )}
        </div>
        <div className="text-right text-[13px] text-[#6b6155]">
          <div>
            <span className="text-[#a99a86]">Issued:</span> {fmt(data.issue_date)}
          </div>
          <div className="mt-1">
            <span className="text-[#a99a86]">Due:</span> {fmt(data.due_date)}
          </div>
        </div>
      </div>

      <table className="mt-8 w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b-2 border-[#e6ddcf] text-left text-[10px] uppercase tracking-[0.14em] text-[#a99a86]">
            <th className="py-2.5 font-semibold">Description</th>
            <th className="py-2.5 text-right font-semibold">Qty</th>
            <th className="py-2.5 text-right font-semibold">Unit price</th>
            <th className="py-2.5 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {data.items.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-6 text-center text-[#a99a86]">
                No line items.
              </td>
            </tr>
          ) : (
            data.items.map((it, i) => (
              <tr key={i} className="border-b border-[#f0eae0]">
                <td className="py-3 pr-4 text-[#2a2320]">{it.description || '—'}</td>
                <td className="py-3 text-right text-[#6b6155]">{Number(it.qty) || 0}</td>
                <td className="py-3 text-right text-[#6b6155]">{money(Number(it.unit_price) || 0)}</td>
                <td className="py-3 text-right font-medium text-[#2a2320]">
                  {money((Number(it.qty) || 0) * (Number(it.unit_price) || 0))}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="mt-6 flex justify-end">
        <div className="w-full max-w-[280px] text-[13px]">
          <div className="flex justify-between py-1.5 text-[#6b6155]">
            <span>Subtotal</span>
            <span>{money(subtotal)}</span>
          </div>
          <div className="flex justify-between py-1.5 text-[#6b6155]">
            <span>Tax ({Number(data.tax_rate) || 0}%)</span>
            <span>{money(tax)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t-2 border-[#e6ddcf] py-2.5 text-[16px] font-semibold text-[#1a1512]">
            <span>Total</span>
            <span>{money(total)}</span>
          </div>
        </div>
      </div>

      {data.notes && (
        <div className="mt-8 border-t border-[#e6ddcf] pt-5 text-[12px] leading-relaxed text-[#6b6155]">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a99a86]">Notes</div>
          <p className="whitespace-pre-wrap">{data.notes}</p>
        </div>
      )}

      <div className="mt-10 text-center text-[11px] text-[#a99a86]">
        Thank you for celebrating with Infinity at Rio Ranch.
      </div>
    </div>
  )
}
