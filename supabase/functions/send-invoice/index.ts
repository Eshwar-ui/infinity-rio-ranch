// send-invoice — emails a client a link to their invoice via Resend.
//
// Invoked from the admin panel: supabase.functions.invoke('send-invoice', { body: { id } }).
// Requires a logged-in ADMIN caller (verify_jwt on + admin_users check below).
// Reads the invoice with the service-role key (invoices are admin-only under RLS).
//
// Secrets to set (Dashboard → Edge Functions → send-invoice → Secrets, or
// `supabase secrets set`): RESEND_API_KEY, INVOICE_FROM, SITE_URL.
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are injected automatically.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const INVOICE_FROM = Deno.env.get('INVOICE_FROM')          // e.g. "Infinity at Rio Ranch <invoices@yourdomain.com>"
const SITE_URL = Deno.env.get('SITE_URL') ?? ''            // e.g. "https://infinity-rio-ranch.vercel.app"
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
    // Graceful "not configured" — the admin UI shows a friendly message on any error.
    if (!RESEND_API_KEY || !INVOICE_FROM) {
      return json({ error: 'Email service is not configured (missing RESEND_API_KEY or INVOICE_FROM).' }, 503)
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

    // Authorize: the caller must be a logged-in admin.
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: userData } = await admin.auth.getUser(jwt)
    const user = userData?.user
    if (!user) return json({ error: 'Unauthorized.' }, 401)
    const { data: allow } = await admin
      .from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle()
    if (!allow) return json({ error: 'Forbidden — admins only.' }, 403)

    const { id } = await req.json().catch(() => ({}))
    if (!id) return json({ error: 'Missing invoice id.' }, 400)

    const { data: inv, error } = await admin
      .from('invoices')
      .select('number, client_name, client_email, issue_date, due_date, tax_rate, notes, public_token, invoice_items(description, qty, unit_price, sort)')
      .eq('id', id)
      .single()
    if (error || !inv) return json({ error: 'Invoice not found.' }, 404)
    if (!inv.client_email) return json({ error: 'This invoice has no client email.' }, 400)

    const items = (inv.invoice_items ?? []).slice().sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    const subtotal = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0)
    const tax = subtotal * ((Number(inv.tax_rate) || 0) / 100)
    const total = subtotal + tax
    const link = `${SITE_URL}/invoice/${inv.public_token}`

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
        <div style="text-align:right;font-size:16px;color:#1a1512;margin-top:6px"><strong>Total: ${money(total)}</strong></div>
      </div>
      <div style="margin:28px 0">
        <a href="${link}" style="display:inline-block;background:#b08d3f;color:#fff;text-decoration:none;padding:12px 26px;font-family:Arial,sans-serif;font-size:13px;letter-spacing:1px;text-transform:uppercase">View &amp; print invoice</a>
      </div>
      ${inv.notes ? `<p style="font-size:12px;color:#6b6155;font-family:Arial,sans-serif;line-height:1.6">${escapeHtml(inv.notes)}</p>` : ''}
      <p style="font-size:11px;color:#a99a86;margin-top:24px;font-family:Arial,sans-serif">If the button doesn't work, copy this link: ${link}</p>
    </div>`

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: INVOICE_FROM,
        to: [inv.client_email],
        subject: `Invoice ${inv.number ?? ''} from Infinity at Rio Ranch`,
        html,
      }),
    })

    if (!resp.ok) {
      const detail = await resp.text()
      return json({ error: 'Resend rejected the email.', detail }, 502)
    }
    return json({ ok: true })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}
