import { useContact } from '@/hooks/use-site-content'
import { computeTotals, money, type InvoiceData } from '@/lib/invoice'
import { SmartImage } from '@/components/ui/smart-image'

const fmt = (d?: string | null) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

/** White, print-ready invoice. Reused by the admin preview and the public page. */
export const InvoiceDocument = ({ data }: { data: InvoiceData }) => {
  const contact = useContact()
  const { subtotal, tax, total, advance, balance } = computeTotals(
    data.items,
    data.tax_rate,
    Number(data.advance_paid) || 0,
  )

  return (
    <div className="invoice-print relative isolate mx-auto max-w-[820px] overflow-hidden bg-white p-[clamp(24px,5vw,56px)] font-sans text-[#2a2320] shadow-sm print:shadow-none">
      {/* Decorative only. `isolate` + `-z-10` paints it above the white page but
          under every line of the invoice, so nothing here can cover the numbers.
          Eager, because a lazy image may not have decoded when window.print() fires. */}
      <div
        aria-hidden="true"
        className="invoice-watermark pointer-events-none absolute inset-0 -z-10 flex select-none items-center justify-center"
      >
        <SmartImage
          src="/assets/logo-cutout-dark.png"
          alt=""
          sizes="420px"
          priority
          className="w-[62%] max-w-[420px] opacity-[0.055]"
        />
      </div>

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
          <div
            className={`mt-1 flex justify-between border-t-2 border-[#e6ddcf] py-2.5 font-semibold text-[#1a1512] ${
              advance > 0 ? 'text-[14px]' : 'text-[16px]'
            }`}
          >
            <span>Total</span>
            <span>{money(total)}</span>
          </div>
          {/* Only shown once a deposit exists — a "Balance due" line equal to the
              total reads like a second charge on a fully-unpaid invoice. */}
          {advance > 0 && (
            <>
              <div className="flex justify-between py-1.5 text-[#6b6155]">
                <span>Advance paid</span>
                <span>− {money(advance)}</span>
              </div>
              <div className="mt-1 flex justify-between border-t border-[#e6ddcf] py-2.5 text-[16px] font-semibold text-[#1a1512]">
                <span>Balance due</span>
                <span>{money(balance)}</span>
              </div>
            </>
          )}
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
