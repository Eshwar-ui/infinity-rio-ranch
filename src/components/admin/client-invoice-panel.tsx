import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import { computeTotals, money, sentMessage, type InvoiceItem, type SendResult } from '@/lib/invoice'
import { btnPrimary, btnQuiet, chip, field, label, pill, sectionTitle } from '@/lib/admin-ui'

/** The slice of an invoice this panel lists and totals up. */
export type ClientInvoice = {
  id: string
  number: string | null
  status: string
  issue_date: string | null
  due_date: string | null
  tax_rate: number | null
  advance_paid: number | null
  public_token: string | null
  invoice_items: { qty: number; unit_price: number }[] | null
}

/** Just the client fields an invoice is built from. */
export type InvoiceBooking = {
  id: string
  name: string
  email: string | null
  package: string | null
  event_type: string | null
  event_date: string | null
  amount: number | null
  advance_amount: number | null
}


const statusClass: Record<string, string> = {
  draft: 'border-line text-muted',
  sent: 'border-brass/40 text-brass2',
  paid: 'border-[#6a9a7a]/40 text-[#8fc0a0]',
}

const today = () => new Date().toISOString().slice(0, 10)

/** Bare dates shift a day if parsed without a time zone. */
const fmtDate = (d?: string | null) =>
  d
    ? new Date(d + 'T00:00:00').toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '—'

const totalsOf = (inv: ClientInvoice) =>
  computeTotals(
    (inv.invoice_items ?? []).map((i) => ({ description: '', qty: i.qty, unit_price: i.unit_price })),
    Number(inv.tax_rate) || 0,
    Number(inv.advance_paid) || 0,
  )

/**
 * The three stages a booking is billed in.
 *
 * The venue's flow, not an invented taxonomy: confirm the booking and invoice
 * the advance (this one carries the agreement to sign), then after the event
 * invoice any extras, then the final payment.
 */
type Purpose = 'advance' | 'extras' | 'final'

const PURPOSES: { value: Purpose; label: string }[] = [
  { value: 'advance', label: 'Advance' },
  { value: 'extras', label: 'Extra charges' },
  { value: 'final', label: 'Final payment' },
]

type Draft = {
  issue_date: string
  due_date: string
  tax_rate: string
  advance_paid: string
  notes: string
  purpose: Purpose
  items: InvoiceItem[]
}

/** The two documents a client receives, and the two tabs of the viewer. */
type PreviewTab = 'invoice' | 'agreement'


/** The client-facing invoice URL, absolute so it can be copied and pasted. */
const publicInvoiceUrl = (token: string) => new URL(`/invoice/${token}`, location.origin).href

/**
 * Invoices for one client, raised without leaving their profile.
 *
 * The composer only ever creates: editing an existing invoice stays in the full
 * editor, which owns the number, the public token and the send state. Two places
 * that can rewrite an invoice already emailed to a client is one too many.
 */
export const ClientInvoicePanel = ({
  booking,
  invoices,
  onCreated,
  onStatusChange,
}: {
  booking: InvoiceBooking
  invoices: ClientInvoice[]
  onCreated: (invoice: ClientInvoice) => void
  onStatusChange: (id: string, status: string) => void
}) => {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [creating, setCreating] = useState(false)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [buildingId, setBuildingId] = useState<string | null>(null)

  // Which invoice is on screen in the viewer, and which of its two documents.
  const [viewer, setViewer] = useState<{ id: string; tab: PreviewTab } | null>(null)
  // The built agreement, kept as an object URL so switching tabs back doesn't
  // rebuild a PDF the function already spent a few seconds on.
  const [agreement, setAgreement] = useState<{ id: string; url: string } | null>(null)
  const [agreementError, setAgreementError] = useState<string | null>(null)
  const agreementUrl = useRef<string | null>(null)

  // Resolved from the list every render, so a status change or a rename shows
  // in the viewer header without a second copy of the row to keep in sync.
  const viewed = viewer ? (invoices.find((i) => i.id === viewer.id) ?? null) : null

  /** One live blob at a time: the old one is revoked before the new one lands. */
  const holdAgreement = (id: string, url: string | null) => {
    if (agreementUrl.current) URL.revokeObjectURL(agreementUrl.current)
    agreementUrl.current = url
    setAgreement(url ? { id, url } : null)
  }

  // Leaving the page with a PDF still held would leak it for the tab's lifetime.
  useEffect(
    () => () => {
      if (agreementUrl.current) URL.revokeObjectURL(agreementUrl.current)
    },
    [],
  )

  const agreed = Math.max(0, Number(booking.amount) || 0)
  // `deposit`, not `advance`: each invoice row below destructures an `advance`
  // of its own, meaning the part of the deposit that one invoice credits.
  const deposit = Math.max(0, Number(booking.advance_amount) || 0)
  // What the deposit has already been credited against. Crediting it a second
  // time would discount the same money twice.
  const credited = invoices.reduce((s, i) => s + (Number(i.advance_paid) || 0), 0)
  const uncredited = Math.max(0, deposit - credited)
  const isFollowUp = invoices.length > 0
  const base = [booking.package, booking.event_type].find((v) => (v ?? '').trim()) ?? ''

  /**
   * What a new invoice starts out billing, per stage of the booking.
   *
   *  - **advance** — sent with the booking confirmation and the agreement. Bills
   *    the deposit that holds the date, and credits nothing: this invoice *is*
   *    the request for that money.
   *  - **extras** — raised after the event for anything beyond the package.
   *    Deliberately empty; only the owner knows what happened on the night.
   *  - **final** — bills the agreed amount and credits the advance that hasn't
   *    been credited anywhere else, so the document reconciles the whole booking
   *    ("$500 total, less $300 advance, $200 due") and the two invoices add up
   *    to the booking rather than to twice it.
   *
   * All three are defaults. An invoice for something else is a matter of typing
   * over the line.
   */
  const stageDefaults = (purpose: Purpose): Pick<Draft, 'items' | 'advance_paid'> => {
    if (purpose === 'advance')
      return {
        advance_paid: '0',
        items: [
          {
            description: base ? `Advance payment: ${base}` : 'Advance payment to secure the date',
            qty: 1,
            unit_price: deposit,
          },
        ],
      }
    if (purpose === 'extras')
      return { advance_paid: '0', items: [{ description: '', qty: 1, unit_price: 0 }] }
    return {
      advance_paid: String(uncredited),
      items: [
        {
          description: base || 'Event package',
          qty: 1,
          unit_price: Math.max(0, agreed - credited),
        },
      ],
    }
  }

  /** Where the booking is up to, as far as the rows can tell. */
  const defaultPurpose: Purpose = !isFollowUp ? 'advance' : agreed - credited - uncredited > 0 ? 'final' : 'extras'

  const startDraft = () => {
    setDraft({
      issue_date: today(),
      due_date: '',
      tax_rate: '0',
      notes: booking.event_date ? `Event date: ${fmtDate(booking.event_date)}` : '',
      purpose: defaultPurpose,
      ...stageDefaults(defaultPurpose),
    })
    setOpen(true)
  }

  /** Switching stage re-prefills the money; the dates and notes stay put. */
  const setPurpose = (purpose: Purpose) =>
    setDraft((d) => (d ? { ...d, purpose, ...stageDefaults(purpose) } : d))

  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d))
  const setItem = (i: number, patch: Partial<InvoiceItem>) =>
    setDraft((d) =>
      d ? { ...d, items: d.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) } : d,
    )
  const addItem = () =>
    setDraft((d) => (d ? { ...d, items: [...d.items, { description: '', qty: 1, unit_price: 0 }] } : d))
  const removeItem = (i: number) =>
    setDraft((d) => (d ? { ...d, items: d.items.filter((_, idx) => idx !== i) } : d))

  const preview = draft
    ? computeTotals(draft.items, Number(draft.tax_rate) || 0, Number(draft.advance_paid) || 0)
    : null

  const create = async () => {
    if (!draft) return
    const rows = draft.items.filter((it) => it.description.trim() || Number(it.unit_price))
    if (rows.length === 0) return toast.error('Add at least one line item.')

    setCreating(true)
    const { data, error } = await supabase
      .from('invoices')
      .insert({
        client_id: booking.id,
        // Denormalised on purpose: the invoice must still read correctly years
        // later, even if the client record is edited or deleted.
        client_name: booking.name,
        client_email: booking.email,
        issue_date: draft.issue_date || today(),
        due_date: draft.due_date || null,
        status: 'draft',
        tax_rate: Number(draft.tax_rate) || 0,
        advance_paid: Math.max(0, Number(draft.advance_paid) || 0),
        notes: draft.notes || null,
      })
      .select('id, number, status, issue_date, due_date, tax_rate, advance_paid, public_token')
      .single()

    if (error || !data) {
      setCreating(false)
      toast.error('Could not create the invoice.')
      return
    }

    const items = rows.map((it, i) => ({
      invoice_id: data.id,
      description: it.description,
      qty: Number(it.qty) || 0,
      unit_price: Number(it.unit_price) || 0,
      sort: i,
    }))
    const { error: itemsError } = await supabase.from('invoice_items').insert(items)
    setCreating(false)

    if (itemsError) {
      // The invoice exists but is empty — say so, and leave it recoverable in
      // the full editor rather than pretending the whole thing worked.
      toast.error(`${data.number} was created but its line items did not save — open it to finish.`)
    } else {
      toast.success(`${data.number} created.`)
    }

    onCreated({
      ...(data as Omit<ClientInvoice, 'invoice_items'>),
      invoice_items: items.map((i) => ({ qty: i.qty, unit_price: i.unit_price })),
    })
    setOpen(false)
    setDraft(null)
    // Land on the finished document rather than back on a list row: the first
    // thing anyone does after raising an invoice is check it reads right.
    setViewer({ id: data.id, tab: 'invoice' })
  }

  /**
   * Surfaces the real reason a function call failed.
   *
   * Three different shapes arrive here and only the first is ours:
   *  - `{ error }` — send-invoice's own handled failures, already a sentence
   *    written for the owner ("No agreement template uploaded yet…").
   *  - `{ code, message }` — the Edge Runtime itself, before our code ran:
   *    BOOT_ERROR when a deploy missed `_shared/`, WORKER_LIMIT when the PDF
   *    blew the memory or CPU cap.
   *  - a bare stack trace, when the worker died before it could serialise JSON.
   *
   * This used to read `body.error` and return the fallback for everything else,
   * so a boot failure, a blown memory limit and a missing template all produced
   * the same sentence with nothing to act on. The status code is worth carrying
   * too — it's the difference between "we rejected this" and "it never ran".
   */
  const functionError = async (error: unknown, fallback: string) => {
    const res = (error as { context?: Response })?.context
    // No response at all: the request never landed (offline, CORS, DNS).
    if (!res) {
      const msg = (error as { message?: string })?.message
      return msg ? `${fallback} — ${msg}` : fallback
    }
    try {
      const body = await res.clone().json()
      if (body?.error) return String(body.error)
      const platform = [body?.code, body?.message].filter(Boolean).join(' — ')
      if (platform) return `${fallback} — ${platform} (HTTP ${res.status})`
    } catch {
      const text = (await res.clone().text().catch(() => '')).trim()
      if (text) return `${fallback} — ${text.slice(0, 300)} (HTTP ${res.status})`
    }
    return `${fallback} (HTTP ${res.status})`
  }

  const email = async (invoice: ClientInvoice) => {
    if (!booking.email) return toast.error('This client has no email address.')
    setSendingId(invoice.id)
    const { data, error } = await supabase.functions.invoke('send-invoice', {
      body: { id: invoice.id },
    })
    setSendingId(null)
    if (error) {
      toast.error(await functionError(error, 'Email not sent — the email service may not be configured yet.'))
      return
    }
    await supabase.from('invoices').update({ status: 'sent' }).eq('id', invoice.id)
    onStatusChange(invoice.id, 'sent')
    // Say when the agreement button wasn't included, and why. Left as one
    // message, "no agreement" reads as a fault every time — including on a
    // follow-up, where leaving it out is the whole point.
    toast.success(sentMessage(data as SendResult))
  }

  /**
   * Builds the exact PDF the email would attach and hands it to the viewer.
   *
   * Every failure is written into the viewer as well as toasted: a toast is
   * gone in four seconds, and "why is this panel empty" is the question the
   * message exists to answer.
   */
  const loadAgreement = async (invoice: ClientInvoice) => {
    if (agreement?.id === invoice.id) return // already built for this invoice
    setAgreementError(null)
    setBuildingId(invoice.id)
    const { data, error } = await supabase.functions.invoke('send-invoice', {
      body: { id: invoice.id, preview: 1 },
    })
    setBuildingId(null)
    if (error) {
      const message = await functionError(error, 'Could not build the agreement.')
      setAgreementError(message)
      toast.error(message)
      return
    }
    // A 200 that isn't a PDF means the function answered but the body wasn't
    // what we asked for — functions-js decodes by Content-Type, so anything
    // other than application/pdf arrives here as text or an object.
    if (!(data instanceof Blob)) {
      // `{ ok: true }` specifically means the deployed function is older than
      // this code: it has no `preview` branch, so it ignored the flag and took
      // the send path. Say that outright — the client was just emailed, and a
      // vague "could not build" reads as if nothing happened.
      if (data && typeof data === 'object' && 'ok' in data) {
        onStatusChange(invoice.id, 'sent')
        const message =
          'The deployed send-invoice function is out of date — it emailed the client instead of returning a preview. Redeploy it (see RUNBOOK.md).'
        setAgreementError(message)
        toast.error(message, { duration: 12000 })
        return
      }
      const body = typeof data === 'string' ? data : JSON.stringify(data)
      const message = `Could not build the agreement — the function returned ${body ? body.slice(0, 200) : 'an empty response'}.`
      setAgreementError(message)
      toast.error(message)
      return
    }
    holdAgreement(invoice.id, URL.createObjectURL(data))
  }

  const showDocument = (invoice: ClientInvoice, tab: PreviewTab) => {
    setViewer({ id: invoice.id, tab })
    if (tab === 'agreement') void loadAgreement(invoice)
  }

  const closeViewer = () => {
    setViewer(null)
    setAgreementError(null)
    holdAgreement('', null)
  }

  const copyLink = async (invoice: ClientInvoice) => {
    if (!invoice.public_token) return
    try {
      await navigator.clipboard.writeText(publicInvoiceUrl(invoice.public_token))
      toast.success('Client link copied.')
    } catch {
      toast.error('Could not copy the link — open it in a new tab and copy from the address bar.')
    }
  }

  return (
    /* A card, not a section divider: this is the primary block of the client
       page and holds the main column, with the booking details in the rail
       beside it. A top rule would read as a break in the wrong place. */
    <section className="rounded-lg border border-line bg-panel/20 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className={sectionTitle}>Invoices</h3>
          <p className="mt-0.5 text-[13px] text-muted">
            {invoices.length === 0
              ? 'Nothing raised yet for this booking.'
              : `${invoices.length} raised${uncredited > 0 ? ` · ${money(uncredited)} of the advance still uncredited` : ''}`}
          </p>
          <p className="mt-1 max-w-[68ch] text-[12px] leading-relaxed text-muted/80">
            {isFollowUp
              ? 'Emailing this one gives the client a download button for the invoice. The agreement went with the first invoice for this booking and is not sent again.'
              : 'The first email confirms the booking: a download button for the invoice, and one for this client’s rental agreement, filled in and ready to print, sign and return.'}
          </p>
        </div>
        {!open && (
          <button
            onClick={startDraft}
            className={`shrink-0 ${btnPrimary}`}
          >
            + New invoice
          </button>
        )}
      </div>

      {invoices.length > 0 && (
        <ul className="mt-5 space-y-2">
          {invoices.map((inv) => {
            const { total, advance, balance } = totalsOf(inv)
            return (
              <li
                key={inv.id}
                className={`rounded-md border px-4 py-3 transition-colors ${
                  viewer?.id === inv.id
                    ? 'border-brass/40 bg-panel/50'
                    : 'border-line bg-panel/20 hover:border-brass/30'
                }`}
              >
                {/* One line per invoice in the main column, wrapping into three
                    zones when the space isn't there. It used to be three fixed
                    rows because this panel lived in a ~420px rail, where the
                    number, the pill, the money and four actions all competed
                    for one row and "INV-2026-0004" wrapped a character at a
                    time. With the column width it reads as a ledger again. */}
                <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2.5">
                  <div className="flex min-w-0 flex-1 basis-[220px] flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className="whitespace-nowrap text-[14px] font-medium text-cream">
                      {inv.number ?? 'Draft'}
                    </span>
                    <span
                      className={`shrink-0 ${pill} ${statusClass[inv.status] ?? statusClass.draft}`}
                    >
                      {inv.status}
                    </span>
                    <span className="truncate text-[12px] text-muted">
                      Issued {fmtDate(inv.issue_date)}
                      {inv.due_date && ` · due ${fmtDate(inv.due_date)}`}
                    </span>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="text-[14px] font-medium text-cream">{money(total)}</div>
                    {advance > 0 && (
                      <div className="text-[12px] text-brass2">{money(balance)} due</div>
                    )}
                  </div>

                  {/* Preview covers what Link and Agreement used to do
                      separately, and shows the documents instead of describing
                      them. The link and the PDF download live inside it. */}
                  <div className="flex shrink-0 items-center gap-4 text-[13px] font-medium">
                    <button
                      onClick={() =>
                        viewer?.id === inv.id ? closeViewer() : showDocument(inv, 'invoice')
                      }
                      aria-expanded={viewer?.id === inv.id}
                      title="See exactly what the client receives"
                      className={`transition-colors hover:text-brass2 ${
                        viewer?.id === inv.id ? 'text-brass2' : 'text-muted'
                      }`}
                    >
                      Preview
                    </button>
                    <Link
                      to={`/admin/invoices/${inv.id}`}
                      className="text-muted transition-colors hover:text-brass2"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => email(inv)}
                      disabled={sendingId === inv.id}
                      className="text-brass2 transition-colors hover:text-brass disabled:opacity-50"
                    >
                      {sendingId === inv.id ? 'Sending…' : 'Email'}
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* The viewer. Inline under the list rather than a modal: the list stays
          on screen, so moving between two invoices is one click and the page
          behind it never disappears. Both documents are the real thing — the
          client-facing invoice page itself, and the PDF the email would
          attach — because a rendering of a document that only resembles what
          gets sent is worth nothing as a check. */}
      {viewed && (
        <div className="mt-5 overflow-hidden rounded-lg border border-brass/30 bg-panel/40">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3">
            <div className="flex items-center gap-1">
              {(['invoice', 'agreement'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => showDocument(viewed, tab)}
                  aria-pressed={viewer?.tab === tab}
                  className={chip(viewer?.tab === tab)}
                >
                  {tab === 'invoice' ? 'Invoice' : 'Agreement'}
                </button>
              ))}
            </div>
            <span className="text-[13px] text-muted">
              {viewed.number ?? 'Draft'}
              {viewer?.tab === 'agreement' && ' · rental agreement'}
            </span>

            <div className="ml-auto flex items-center gap-4 text-[13px] font-medium">
              {viewer?.tab === 'invoice' ? (
                <>
                  <button
                    onClick={() => copyLink(viewed)}
                    className="text-muted transition-colors hover:text-brass2"
                  >
                    Copy link
                  </button>
                  {viewed.public_token && (
                    <a
                      href={`/invoice/${viewed.public_token}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted transition-colors hover:text-brass2"
                    >
                      Open in new tab
                    </a>
                  )}
                </>
              ) : (
                agreement?.id === viewed.id && (
                  <a
                    href={agreement.url}
                    download={`Rental Agreement - ${booking.name}.pdf`}
                    className="text-muted transition-colors hover:text-brass2"
                  >
                    Download
                  </a>
                )
              )}
              <button onClick={closeViewer} className={btnQuiet}>
                Close
              </button>
            </div>
          </div>

          <div className="bg-ink/40">
            {viewer?.tab === 'invoice' ? (
              viewed.public_token ? (
                <iframe
                  key={viewed.id}
                  title={`Invoice ${viewed.number ?? 'draft'} as the client sees it`}
                  src={`/invoice/${viewed.public_token}`}
                  className="block h-[70vh] min-h-[420px] w-full border-0 bg-ink"
                />
              ) : (
                <p className="grid h-[420px] place-items-center px-6 text-center text-[13px] text-muted">
                  This invoice has no client link yet.
                </p>
              )
            ) : agreement?.id === viewed.id ? (
              /* `#toolbar=0&navpanes=0` are PDF open parameters, not URL query —
                 they strip the browser's own viewer chrome (print, download,
                 zoom, page thumbnails) so this reads as an embedded document
                 rather than a second application inside the panel. The panel
                 already has its own Download, and print belongs to the invoice,
                 not to a contract that goes out by email.

                 Chromium honours these; Firefox's pdf.js ignores them and keeps
                 its toolbar. The fragment is appended here rather than baked
                 into `agreement.url` because that same url is the href of the
                 Download link, which wants the bare blob. */
              <iframe
                key={`${viewed.id}-agreement`}
                title="Rental agreement as it would be sent"
                src={`${agreement.url}#toolbar=0&navpanes=0`}
                className="block h-[70vh] min-h-[420px] w-full border-0 bg-ink"
              />
            ) : (
              <div className="grid h-[420px] place-items-center px-6">
                {buildingId === viewed.id ? (
                  <p className="text-[13px] text-muted">Building the agreement…</p>
                ) : (
                  <div className="max-w-[52ch] text-center">
                    <p className="text-[13px] leading-relaxed text-muted">
                      {agreementError ?? 'The agreement has not been built yet.'}
                    </p>
                    <button
                      onClick={() => void loadAgreement(viewed)}
                      className={`mt-4 ${btnQuiet}`}
                    >
                      Try again
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {open && draft && preview && (
        <div className="mt-5 rounded-lg border border-brass/30 bg-panel/40 p-5">
          {/* Which stage this invoice is, and what that prefills. An amount
              that appears by itself has to explain itself: this is the
              booking's money, not a guess. */}
          <div className="mb-5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className={`${label} mb-0`}>This invoice is for</span>
              <div className="flex flex-wrap items-center gap-1">
                {PURPOSES.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setPurpose(p.value)}
                    aria-pressed={draft.purpose === p.value}
                    className={chip(draft.purpose === p.value)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-2 max-w-[68ch] text-[13px] leading-relaxed text-muted">
              {draft.purpose === 'advance' &&
                (deposit > 0 ? (
                  <>
                    The <span className="font-medium text-cream">{money(deposit)}</span> deposit
                    that holds the date, nothing credited against it. This one confirms the booking
                    and carries the agreement to sign.
                  </>
                ) : (
                  <>
                    No advance is recorded on this booking, so there is no amount to prefill. Type
                    the deposit here, or set it on the booking first.
                  </>
                ))}
              {draft.purpose === 'extras' && (
                <>Empty on purpose: add what the extras were, and what each one cost.</>
              )}
              {draft.purpose === 'final' &&
                (agreed > 0 ? (
                  <>
                    The {money(agreed)} agreed
                    {uncredited > 0 && `, less the ${money(uncredited)} advance already paid`}:{' '}
                    <span className="font-medium text-cream">
                      {money(Math.max(0, agreed - credited - uncredited))}
                    </span>{' '}
                    due.
                    {credited > 0 && ` ${money(credited)} of the advance was credited earlier.`}
                  </>
                ) : (
                  <>No agreed amount on this booking, so there is nothing to prefill.</>
                ))}
            </p>
          </div>

          {/* Four across once there's room for it. Two below that, never one:
              a date input squeezed into a third of a narrow column clips its
              own picker. */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div>
              <label className={label}>Issue date</label>
              <input
                type="date"
                value={draft.issue_date}
                onChange={(e) => set({ issue_date: e.target.value })}
                className={field}
              />
            </div>
            <div>
              <label className={label}>Due date</label>
              <input
                type="date"
                value={draft.due_date}
                onChange={(e) => set({ due_date: e.target.value })}
                className={field}
              />
            </div>
            <div>
              <label className={label}>Tax %</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={draft.tax_rate}
                onChange={(e) => set({ tax_rate: e.target.value })}
                className={field}
              />
            </div>
            <div>
              <label className={label}>Advance credited</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={draft.advance_paid}
                onChange={(e) => set({ advance_paid: e.target.value })}
                className={field}
              />
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <span className={label}>Line items</span>
              <button
                onClick={addItem}
                className="text-[13px] font-semibold text-brass2 transition-colors hover:text-brass"
              >
                + Add row
              </button>
            </div>
            <div className="space-y-2">
              {/* The inputs are sized by their wrappers, not by width classes on
                  the inputs themselves: `field` already carries w-full, which
                  Tailwind emits after w-16/w-28 and would win regardless of the
                  order they're written in. */}
              {draft.items.map((it, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[minmax(0,1fr)_64px_100px_20px] items-center gap-2"
                >
                  <input
                    placeholder="Description"
                    value={it.description}
                    onChange={(e) => setItem(i, { description: e.target.value })}
                    className={field}
                  />
                  <input
                    type="number"
                    aria-label="Quantity"
                    value={it.qty}
                    onChange={(e) => setItem(i, { qty: Number(e.target.value) })}
                    className={field}
                  />
                  <input
                    type="number"
                    aria-label="Unit price"
                    step="0.01"
                    value={it.unit_price}
                    onChange={(e) => setItem(i, { unit_price: Number(e.target.value) })}
                    className={field}
                  />
                  <button
                    onClick={() => removeItem(i)}
                    aria-label="Remove row"
                    className="text-[18px] leading-none text-muted transition-colors hover:text-[#e0916f]"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-md border border-line bg-ink/30 px-3 py-2">
            <dl className="text-[13px]">
              <div className="flex justify-between py-0.5 text-muted">
                <dt>Subtotal</dt>
                <dd>{money(preview.subtotal)}</dd>
              </div>
              <div className="flex justify-between py-0.5 text-muted">
                <dt>Tax</dt>
                <dd>{money(preview.tax)}</dd>
              </div>
              <div className="flex justify-between border-t border-line py-1 text-cream">
                <dt>Total</dt>
                <dd>{money(preview.total)}</dd>
              </div>
              {preview.advance > 0 && (
                <>
                  <div className="flex justify-between py-0.5 text-muted">
                    <dt>Advance</dt>
                    <dd>− {money(preview.advance)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-line py-1 text-brass2">
                    <dt>Balance due</dt>
                    <dd>{money(preview.balance)}</dd>
                  </div>
                </>
              )}
            </dl>
          </div>

          <div className="mt-5">
            <label className={label}>Notes</label>
            <textarea
              rows={2}
              value={draft.notes}
              onChange={(e) => set({ notes: e.target.value })}
              className={field}
            />
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={() => {
                setOpen(false)
                setDraft(null)
              }}
              className={btnQuiet}
            >
              Cancel
            </button>
            <button
              onClick={create}
              disabled={creating}
              className={`ml-auto ${btnPrimary}`}
            >
              {creating ? 'Creating…' : 'Create invoice'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
