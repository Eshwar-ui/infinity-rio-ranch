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
        <div className="mb-4 flex justify-end print:hidden">
          <button
            onClick={() => window.print()}
            className="rounded border border-[#cbbfa8] bg-white px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-[#6b6155] transition-colors hover:border-[#b08d3f] hover:text-[#b08d3f]"
          >
            Print / Save PDF
          </button>
        </div>
        <InvoiceDocument data={data} />
      </div>
    </div>
  )
}
