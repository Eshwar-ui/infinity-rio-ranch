// send-invoice — emails a client their invoice via Resend, with Download
// invoice and Download agreement buttons.
//
// Neither document is attached. The invoice button opens /invoice/<token> (which
// has its own Print / Save PDF); the agreement button hits /agreement/<token>,
// served by the `public-agreement` function. Both are keyed on the same
// `public_token`, so the client holds one credential, not three.
//
// Invoked from the admin panel:
//   supabase.functions.invoke('send-invoice', { body: { id } })            → sends
//   supabase.functions.invoke('send-invoice', { body: { id, preview: 1 } }) → returns
//     the filled agreement as a PDF instead of emailing anything, so the owner
//     can check a contract before a client sees it. Same code path as the send,
//     deliberately: a preview that took a different route would prove nothing.
//
// Requires a logged-in ADMIN caller (verify_jwt on + admin_users check below).
// Reads the invoice with the service-role key (invoices are admin-only under RLS).
//
// Secrets to set (Dashboard → Edge Functions → send-invoice → Secrets, or
// `supabase secrets set`): RESEND_API_KEY, INVOICE_FROM, SITE_URL.
// Optional: INVOICE_REPLY_TO (where client replies should land, e.g. the venue's inbox).
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are injected automatically.
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { agreementFileName, buildAgreement } from '../_shared/agreement.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const INVOICE_FROM = Deno.env.get('INVOICE_FROM')          // e.g. "Infinity at Rio Ranch <invoices@infinityrioranch.com>"
const INVOICE_REPLY_TO = Deno.env.get('INVOICE_REPLY_TO')  // e.g. "infinityrioranch6@gmail.com" — replies reach a real inbox
const SITE_URL = Deno.env.get('SITE_URL') ?? ''            // e.g. "https://infinityrioranch.com"
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number.isFinite(n) ? n : 0)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

    // Authorize: the caller must be a logged-in admin.
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: userData } = await admin.auth.getUser(jwt)
    const user = userData?.user
    if (!user) return json({ error: 'Unauthorized.' }, 401)
    const { data: allow } = await admin
      .from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle()
    if (!allow) return json({ error: 'Forbidden — admins only.' }, 403)

    const { id, preview } = await req.json().catch(() => ({}))
    if (!id) return json({ error: 'Missing invoice id.' }, 400)

    const { data: inv, error } = await admin
      .from('invoices')
      .select('number, client_name, client_email, issue_date, due_date, tax_rate, advance_paid, notes, public_token, invoice_items(description, qty, unit_price, sort), clients(name, event_date, event_type)')
      .eq('id', id)
      .single()
    if (error || !inv) return json({ error: 'Invoice not found.' }, 404)

    // The agreement is per booking, so it only exists for an invoice raised
    // against a client. A standalone invoice simply goes out without one.
    const client = (inv as { clients?: { name: string; event_date: string | null; event_type: string | null } | null }).clients
    const agreement = client
      ? await buildAgreement(admin, {
          clientName: client.name,
          eventDate: client.event_date,
          eventType: client.event_type,
        })
      : null

    if (preview) {
      if (!client) return json({ error: 'This invoice is not linked to a client.' }, 400)
      if (!agreement)
        return json(
          { error: 'No agreement template uploaded yet — add it to the documents bucket.' },
          404,
        )
      return new Response(agreement, {
        headers: {
          ...cors,
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${agreementFileName(client.name)}"`,
        },
      })
    }

    // Checked here rather than at the top so `preview` still works before the
    // owner has set up Resend — nothing about generating a PDF needs email.
    // Graceful "not configured": the admin UI shows a friendly message on any error.
    if (!RESEND_API_KEY || !INVOICE_FROM) {
      return json({ error: 'Email service is not configured (missing RESEND_API_KEY or INVOICE_FROM).' }, 503)
    }
    if (!inv.client_email) return json({ error: 'This invoice has no client email.' }, 400)

    const items = (inv.invoice_items ?? []).slice().sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    const subtotal = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0)
    const tax = subtotal * ((Number(inv.tax_rate) || 0) / 100)
    const total = subtotal + tax
    // Mirrors computeTotals() in src/lib/invoice.ts — an advance over the total is
    // an overpayment to refund, never a negative amount due.
    const advance = Math.max(0, Number(inv.advance_paid) || 0)
    const balance = Math.max(0, total - advance)
    const link = `${SITE_URL}/invoice/${inv.public_token}`
    // Served by the `public-agreement` function, proxied through the venue's own
    // domain by a rewrite in vercel.json. A contract download pointing at a
    // supabase.co URL reads as a phishing link in the one email where it matters
    // most — and mail filters treat an unfamiliar host the same way.
    const agreementLink = `${SITE_URL}/agreement/${inv.public_token}`

    const rowsHtml = items.map((it) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f0eae0;color:#2a2320">${escapeHtml(it.description || '—')}</td>
        <td style="padding:8px 0;border-bottom:1px solid #f0eae0;text-align:right;color:#6b6155">${Number(it.qty) || 0}</td>
        <td style="padding:8px 0;border-bottom:1px solid #f0eae0;text-align:right;color:#6b6155">${money(Number(it.unit_price) || 0)}</td>
        <td style="padding:8px 0;border-bottom:1px solid #f0eae0;text-align:right;color:#2a2320">${money((Number(it.qty) || 0) * (Number(it.unit_price) || 0))}</td>
      </tr>`).join('')

    const html = `
    <div style="max-width:600px;margin:0 auto;font-family:Georgia,'Times New Roman',serif;color:#2a2320;background:#ffffff;padding:32px">
      <div style="font-size:22px;color:#1a1512">Infinity at Rio Ranch</div>
      <div style="font-size:12px;color:#a99a86;margin-top:2px">326 Rio Pk Dr, Liberty Hill, TX 78642</div>
      <h1 style="font-size:20px;color:#b08d3f;margin:28px 0 4px">Invoice ${escapeHtml(inv.number ?? '')}</h1>
      <p style="font-size:14px;line-height:1.6;color:#6b6155;margin:0 0 20px">
        Hi ${escapeHtml(inv.client_name)}, thank you for choosing Infinity at Rio Ranch.
        Your invoice is ready — the full itemized copy is below and always available at your private link.
        ${agreement ? 'Your rental agreement is ready to download below: please print it, sign and date it, and return it to us.' : ''}
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;font-family:Arial,sans-serif">
        <thead>
          <tr style="text-align:left;color:#a99a86;font-size:10px;text-transform:uppercase;letter-spacing:1px">
            <th style="padding-bottom:6px">Description</th>
            <th style="padding-bottom:6px;text-align:right">Qty</th>
            <th style="padding-bottom:6px;text-align:right">Unit</th>
            <th style="padding-bottom:6px;text-align:right">Amount</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <div style="margin-top:16px;font-size:13px;font-family:Arial,sans-serif;color:#6b6155">
        <div style="text-align:right">Subtotal: ${money(subtotal)}</div>
        <div style="text-align:right">Tax (${Number(inv.tax_rate) || 0}%): ${money(tax)}</div>
        <div style="text-align:right;margin-top:6px">Total: ${money(total)}</div>
        ${advance > 0 ? `
        <div style="text-align:right">Advance paid: &minus; ${money(advance)}</div>
        <div style="text-align:right;font-size:16px;color:#1a1512;margin-top:6px"><strong>Balance due: ${money(balance)}</strong></div>`
        : `<div style="text-align:right;font-size:16px;color:#1a1512;margin-top:6px"><strong>Amount due: ${money(total)}</strong></div>`}
      </div>
      <!-- Buttons sit in a table, not a flex row: Outlook ignores display:flex
           and would stack these full-width. Cells side by side work everywhere. -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0">
        <tr>
          <td style="padding-right:10px">
            <a href="${link}" style="display:inline-block;background:#b08d3f;color:#fff;text-decoration:none;padding:12px 26px;font-family:Arial,sans-serif;font-size:13px;letter-spacing:1px;text-transform:uppercase">Download invoice</a>
          </td>
          ${agreement ? `
          <td>
            <a href="${agreementLink}" style="display:inline-block;background:#ffffff;color:#2a2320;border:1px solid #b08d3f;text-decoration:none;padding:11px 26px;font-family:Arial,sans-serif;font-size:13px;letter-spacing:1px;text-transform:uppercase">Download agreement</a>
          </td>` : ''}
        </tr>
      </table>
      ${inv.notes ? `<p style="font-size:12px;color:#6b6155;font-family:Arial,sans-serif;line-height:1.6">${escapeHtml(inv.notes)}</p>` : ''}
      <!-- Both links spelled out: a client whose mail client strips the buttons
           still has to be able to reach a contract they are being asked to sign. -->
      <p style="font-size:11px;color:#a99a86;margin-top:24px;font-family:Arial,sans-serif;line-height:1.7">
        If the buttons don't work, copy these links:<br>
        Invoice: ${link}${agreement ? `<br>Agreement: ${agreementLink}` : ''}
      </p>
    </div>`

    const payload: Record<string, unknown> = {
      from: INVOICE_FROM,
      to: [inv.client_email],
      subject: `Invoice ${inv.number ?? ''} from Infinity at Rio Ranch`,
      html,
    }
    if (INVOICE_REPLY_TO) payload.reply_to = INVOICE_REPLY_TO
    // The agreement is a download button now, not an attachment. It is still
    // BUILT above rather than just linked, because `agreement` is what decides
    // whether the button is rendered at all — a link to a document that can't
    // be produced is worse than no link. Attaching it as well would put a
    // multi-megabyte PDF on every invoice email for no gain: same document,
    // twice, and attachment size is the main thing that lands mail in spam.

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!resp.ok) {
      const detail = await resp.text()
      return json({ error: 'Resend rejected the email.', detail }, 502)
    }
    // `agreement: false` is not an error — it means either a standalone invoice
    // or no template uploaded yet. The caller surfaces it so a silent omission
    // never looks like a successful send.
    return json({ ok: true, agreement: Boolean(agreement) })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}
