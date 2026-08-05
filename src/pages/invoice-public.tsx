import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import type { InvoiceData } from '@/lib/invoice'
import { InvoiceDocument } from '@/components/invoice/invoice-document'

const Centered = ({ children }: { children: React.ReactNode }) => (
  <div className="grid min-h-screen place-items-center bg-[#f3efe8] text-sm text-[#6b6155]">{children}</div>
)

/** Client-facing invoice, reachable by unguessable token — no login required. */
export const InvoicePublicPage = () => {
  const { token } = useParams()
  const [data, setData] = useState<InvoiceData | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'notfound'>('loading')

  useEffect(() => {
    if (!token) {
      setState('notfound')
      return
    }
    supabase.rpc('get_invoice_by_token', { p_token: token }).then(({ data, error }) => {
      if (error || !data) {
        setState('notfound')
        return
      }
      setData(data as InvoiceData)
      setState('ok')
    })
  }, [token])

  if (state === 'loading') return <Centered>Loading…</Centered>
  if (state === 'notfound' || !data) return <Centered>This invoice link is invalid or has expired.</Centered>

  return (
    <div className="min-h-screen bg-[#f3efe8] py-10">
      <div className="mx-auto max-w-[820px] px-4">
        {data.has_agreement && (
          <section className="mb-6 rounded-lg border border-[#ded4c4] bg-white p-5 shadow-[0_2px_0_rgba(43,35,27,0.08),0_8px_24px_rgba(43,35,27,0.08)] print:hidden sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-[54ch]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a08045]">
                Your documents
              </p>
              <h1 className="mt-2 font-serif text-2xl text-[#2a2320]">Your agreement is ready</h1>
              <p className="mt-2 text-[14px] leading-relaxed text-[#6b6155]">
                Your rental agreement has been created from your booking details. Review the
                agreement and invoice separately before printing or saving either document.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="#invoice"
                className="inline-flex min-h-11 items-center justify-center rounded border border-[#cbbfa8] bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4d4338] shadow-[0_2px_0_rgba(43,35,27,0.1)] transition-all hover:-translate-y-px hover:border-[#b08d3f] hover:text-[#8d6c2d] active:translate-y-0 active:shadow-none"
              >
                View invoice
              </a>
              <a
                href={`/agreement/${token}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center justify-center rounded border border-[#a57f35] bg-[#b08d3f] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white shadow-[0_2px_0_rgba(77,57,20,0.28),0_5px_12px_rgba(77,57,20,0.18)] transition-all hover:-translate-y-px hover:bg-[#9b7731] active:translate-y-0 active:shadow-none"
              >
                View agreement
              </a>
            </div>
          </div>
          </section>
        )}
        <div className="mb-4 flex justify-end print:hidden">
          <button
            onClick={() => window.print()}
            className="min-h-11 rounded border border-[#cbbfa8] bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6b6155] shadow-[0_2px_0_rgba(43,35,27,0.1)] transition-all hover:-translate-y-px hover:border-[#b08d3f] hover:text-[#b08d3f] active:translate-y-0 active:shadow-none"
          >
            Print / Save PDF
          </button>
        </div>
        <div id="invoice">
          <InvoiceDocument data={data} />
        </div>
      </div>
    </div>
  )
}
