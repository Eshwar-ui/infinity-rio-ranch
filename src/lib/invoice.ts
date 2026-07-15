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
  notes?: string | null
  items: InvoiceItem[]
}

export const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    Number.isFinite(n) ? n : 0,
  )

/** Subtotal from line items, tax as a percentage of subtotal, and the total. */
export const computeTotals = (items: InvoiceItem[], taxRate: number) => {
  const subtotal = items.reduce(
    (sum, i) => sum + (Number(i.qty) || 0) * (Number(i.unit_price) || 0),
    0,
  )
  const tax = subtotal * ((Number(taxRate) || 0) / 100)
  return { subtotal, tax, total: subtotal + tax }
}
