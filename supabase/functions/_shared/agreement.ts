// agreement.ts — stamps a client's details onto the venue's rental agreement.
//
// The template is the owner's own PDF, kept in the private `documents` bucket
// (migration 0007) rather than in this bundle, so replacing the wording is an
// upload, not a redeploy. It has no form fields, so every value is drawn at a
// fixed coordinate from agreement-fields.json — read the warning in that file
// before touching the template.
//
// Only the three booking blanks on page 1 and the client's name on the
// signature page are filled. The "day of ____, 20__" line and both "Date:"
// lines are left blank on purpose: those are the date of *signing*, which
// nobody knows when the email goes out, and the client fills them in by hand
// along with the signatures.
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1'
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

import FIELDS from './agreement-fields.json' with { type: 'json' }

export const TEMPLATE_BUCKET = 'documents'
export const TEMPLATE_PATH = 'rental-agreement-template.pdf'

/** Near-black with a little warmth, so it reads as ink on the cream page. */
const INK = rgb(0.1, 0.08, 0.07)

export type AgreementValues = {
  clientName: string
  eventDate?: string | null // 'YYYY-MM-DD'
  eventType?: string | null
}

type Field = { page: number; x: number; y: number; size: number; maxWidth: number }
const fields = FIELDS.fields as Record<string, Field>

/** Bare dates shift a day if parsed without a time zone. */
export const formatEventDate = (d?: string | null) =>
  d
    ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : ''

/** `Rental Agreement - Priya & Daniel.pdf`, with anything filesystem-hostile out. */
export const agreementFileName = (clientName: string) =>
  `Rental Agreement - ${(clientName || 'Client').replace(/[\\/:*?"<>|]/g, '').trim()}.pdf`

/**
 * Fetches the blank template. Returns null when the owner hasn't uploaded one
 * yet — the caller carries on without an attachment rather than failing the
 * whole email over a document that was never set up.
 */
export const loadAgreementTemplate = async (
  admin: SupabaseClient,
): Promise<Uint8Array | null> => {
  const { data, error } = await admin.storage.from(TEMPLATE_BUCKET).download(TEMPLATE_PATH)
  if (error || !data) return null
  return new Uint8Array(await data.arrayBuffer())
}

/**
 * Draws `values` onto the template and returns the finished PDF.
 *
 * Long values are shrunk to fit their blank instead of running across the text
 * beside them — a name is worth making small, never worth mangling the contract.
 */
export const fillAgreement = async (
  template: Uint8Array,
  values: AgreementValues,
): Promise<Uint8Array> => {
  const pdf = await PDFDocument.load(template)
  const font = await pdf.embedFont(StandardFonts.TimesRoman)
  const pages = pdf.getPages()

  const draw = (key: string, text: string) => {
    const f = fields[key]
    if (!f || !text) return
    const page = pages[f.page]
    if (!page) return // template replaced with a shorter document — skip, don't throw

    let size = f.size
    while (size > 7 && font.widthOfTextAtSize(text, size) > f.maxWidth) size -= 0.5
    page.drawText(text, { x: f.x, y: f.y, size, font, color: INK })
  }

  draw('clientName', values.clientName)
  draw('eventDate', formatEventDate(values.eventDate))
  draw('eventType', (values.eventType ?? '').trim())
  draw('signatureClientName', values.clientName)

  return await pdf.save()
}

/** Template → filled PDF in one call. Null when no template is uploaded. */
export const buildAgreement = async (
  admin: SupabaseClient,
  values: AgreementValues,
): Promise<Uint8Array | null> => {
  const template = await loadAgreementTemplate(admin)
  if (!template) return null
  return await fillAgreement(template, values)
}
