/**
 * Shared by the clients list (`clients.tsx`) and a single client's page
 * (`client-detail.tsx`).
 *
 * The two views are separate routes but they read the same row and print the
 * same status tags, so the type and the colour maps live here — a "partial"
 * badge that means one thing in the list and another on the profile is worse
 * than either version on its own.
 */

export type ClientStatus = 'booked' | 'completed' | 'cancelled'
export type PaymentStatus = 'unpaid' | 'partial' | 'paid'

export type Client = {
  id: string
  lead_id: string | null
  name: string
  email: string | null
  phone: string | null
  event_date: string | null
  event_type: string | null
  guest_count: number | null
  package: string | null
  amount: number | null
  advance_amount: number | null
  status: ClientStatus
  payment_status: PaymentStatus
  notes: string | null
  created_at: string
}

export const STATUSES: ClientStatus[] = ['booked', 'completed', 'cancelled']
export const PAYMENT_STATUSES: PaymentStatus[] = ['unpaid', 'partial', 'paid']

export const statusClass: Record<ClientStatus, string> = {
  booked: 'bg-brass/15 text-brass2 border-brass/40',
  completed: 'bg-[#6a9a7a]/15 text-[#8fc0a0] border-[#6a9a7a]/40',
  cancelled: 'bg-transparent text-muted/60 border-line',
}

export const paymentClass: Record<PaymentStatus, string> = {
  unpaid: 'bg-[#d98a6a]/10 text-[#d98a6a] border-[#d98a6a]/40',
  partial: 'bg-brass/15 text-brass2 border-brass/40',
  paid: 'bg-[#6a9a7a]/15 text-[#8fc0a0] border-[#6a9a7a]/40',
}

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

/** `event_date` is a bare date — parsing it without a time zone shifts it a day. */
export const fmtEventDate = (d: string | null, opts?: Intl.DateTimeFormatOptions) =>
  d
    ? new Date(d + 'T00:00:00').toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        ...opts,
      })
    : null

/**
 * Whole days from today to a bare `YYYY-MM-DD`, midnight to midnight.
 *
 * Both sides are flattened to local midnight first: an event "today" has to
 * read as today at 9am and at 11pm, not flip to "tomorrow" over lunch.
 */
export const daysUntilEvent = (d: string | null) => {
  if (!d) return null
  const event = new Date(d + 'T00:00:00')
  if (Number.isNaN(event.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((event.getTime() - today.getTime()) / 86_400_000)
}

/**
 * "tomorrow", "in 3 weeks", "5 months ago". Never a bare day count — nobody
 * reads "in 213 days" as a date they can plan around.
 */
export const relativeEventDate = (days: number | null) => {
  if (days === null) return null
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  const abs = Math.abs(days)
  if (abs < 14) return rtf.format(days, 'day')
  if (abs < 60) return rtf.format(Math.round(days / 7), 'week')
  if (abs < 365) return rtf.format(Math.round(days / 30), 'month')
  return rtf.format(Math.round(days / 365), 'year')
}

/** Booking money. Advance over the agreed amount is a refund, never a negative due. */
export const bookingTotals = (c: Pick<Client, 'amount' | 'advance_amount'>) => {
  const agreed = Number(c.amount) || 0
  const advance = Math.max(0, Number(c.advance_amount) || 0)
  return { agreed, advance, balanceDue: Math.max(0, agreed - advance) }
}

/** Fields a search box looks at, in both views. */
export const searchable = (c: Client) => [c.name, c.email, c.phone, c.event_type, c.package]
