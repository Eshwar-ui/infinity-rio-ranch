export type InvoiceItem = { description: string; qty: number; unit_price: number }

export type InvoiceData = {
  number?: string | null
  client_name: string
  client_email?: string | null
  client_address?: string | null
  issue_date: string
  due_date?: string | null
  status: string
  tax_rate: number
  /** Deposit already taken, credited against the total. */
  advance_paid?: number | null
  notes?: string | null
  items: InvoiceItem[]
}

export const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    Number.isFinite(n) ? n : 0,
  )

/**
 * Subtotal from line items, tax as a percentage of subtotal, the total, and
 * what's left after the advance. `balance` is clamped at 0 — an advance larger
 * than the total is an overpayment to refund, never a negative amount due.
 */
export const computeTotals = (
  items: InvoiceItem[],
  taxRate: number,
  advancePaid: number = 0,
) => {
  const subtotal = items.reduce(
    (sum, i) => sum + (Number(i.qty) || 0) * (Number(i.unit_price) || 0),
    0,
  )
  const tax = subtotal * ((Number(taxRate) || 0) / 100)
  const total = subtotal + tax
  const advance = Math.max(0, Number(advancePaid) || 0)
  return { subtotal, tax, total, advance, balance: Math.max(0, total - advance) }
}

/** What `send-invoice` answers after a successful send. */
export type SendResult = {
  agreement?: boolean
  reason?: 'no-client' | 'follow-up' | 'no-template' | null
}

/**
 * What the owner is told once an invoice email has gone out.
 *
 * Lives here, with the money helpers, because both send paths use it — the
 * client panel and the full editor — and neither should own the wording.
 *
 * The agreement being absent is either the design (it went with the booking's
 * first invoice, or there is no booking behind this invoice) or a job left
 * undone (no template uploaded). One sentence covering both taught the owner to
 * ignore the sentence.
 */
export const sentMessage = (result?: SendResult) => {
  if (result?.agreement) return 'Emailed. The client can download the invoice and the agreement.'
  switch (result?.reason) {
    case 'follow-up':
      return 'Invoice emailed. No agreement: it went with the first invoice for this booking.'
    case 'no-template':
      return 'Invoice emailed — no agreement link, because no template is uploaded yet.'
    default:
      return 'Invoice emailed to the client.'
  }
}
