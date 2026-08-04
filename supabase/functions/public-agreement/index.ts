// public-agreement — returns a client's filled rental agreement as a download.
//
//   GET /functions/v1/public-agreement?token=<invoices.public_token>
//
// UNAUTHENTICATED BY DESIGN (verify_jwt = false in supabase/config.toml). The
// invoice's `public_token` is the credential, exactly as it already is for the
// client-facing invoice page: `get_invoice_by_token` in 0001 established that a
// holder of the token may read that invoice, and this grants no more than that
// — the agreement is built from the same booking the token already exposes.
// Keep it that way. If you ever need a value here that the invoice page does
// not already show the client, it does not belong in this function.
//
// It is a separate function from `send-invoice` rather than a branch inside it
// because verify_jwt is per-function: making send-invoice public to serve this
// route would drop the admin check from the send path too.
//
// The PDF is rebuilt per request instead of stored, so it always reflects the
// current template and coordinates, and there is no second copy to go stale.
// A contract is small and this is a rare, human-paced request — the rebuild is
// not worth caching, and caching it would defeat the point.
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { agreementFileName, buildAgreement } from '../_shared/agreement.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** Plain text, not JSON: a person following a link from their email is the only
 *  caller, and an unstyled sentence beats a JSON blob in a browser window. */
const fail = (message: string, status: number) =>
  new Response(message, {
    status,
    headers: { ...cors, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  })

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'GET' && req.method !== 'HEAD') return fail('Method not allowed.', 405)

  try {
    const token = new URL(req.url).searchParams.get('token') ?? ''
    // Shape-check before it reaches Postgres: public_token is a uuid column, so
    // anything else is a 400 rather than a type error surfacing as a 500.
    if (!UUID.test(token)) return fail('This link is not valid.', 400)

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

    // Service role, because invoices are admin-only under RLS. The token in the
    // URL is what authorises this read — nothing else is selected.
    const { data: inv, error } = await admin
      .from('invoices')
      .select('clients(name, event_date, event_type)')
      .eq('public_token', token)
      .maybeSingle()

    // Same answer for "no such token" and "token exists but the invoice is not
    // linked to a client": a wrong link should not report which it was.
    const client = (inv as { clients?: { name: string; event_date: string | null; event_type: string | null } | null } | null)?.clients
    if (error || !client) return fail('This link is not valid, or it has expired.', 404)

    const agreement = await buildAgreement(admin, {
      clientName: client.name,
      eventDate: client.event_date,
      eventType: client.event_type,
    })
    // Owner-side problem (no template uploaded), but a client is reading this —
    // so it says what to do next, not what is misconfigured.
    if (!agreement)
      return fail('The agreement is not available yet. Please contact the venue.', 404)

    return new Response(agreement, {
      headers: {
        ...cors,
        'Content-Type': 'application/pdf',
        // `attachment`, not `inline`: the email button says Download.
        'Content-Disposition': `attachment; filename="${agreementFileName(client.name)}"`,
        'Cache-Control': 'private, no-store',
        'X-Robots-Tag': 'noindex, nofollow, noarchive',
      },
    })
  } catch (_e) {
    // Deliberately not echoed: this response is read by a client, and the
    // message could carry schema or storage detail.
    return fail('Something went wrong building the agreement.', 500)
  }
})
