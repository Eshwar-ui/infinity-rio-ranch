// agreement.ts — stamps a client's details onto the venue's rental agreement.
//
// The template is the owner's own PDF, kept in the private `documents` bucket
// (migration 0007) rather than in this bundle, so replacing the wording is an
// upload, not a redeploy. It has no form fields, so every value is drawn at a
// fixed coordinate from agreement-fields.json — read the warning in that file
// before touching the template.
//
// Only the three booking blanks on page 1 and the client's name on the
// signature page are filled. The signing dates are left blank on purpose —
// "on this __ day of ____, 20__" and both "Date:" lines — because nobody knows
// the signing date when the email goes out; the client fills them in by hand
// along with the signatures.
//
// The opening line is a special case: the template's own wording is broken
// ("...entered into on this day of ________, 20, by and between:" — no day
// blank, no year blank, and the sentence stops mid-clause), so it is covered
// and redrawn. Blanks, not dates. See the `intro` block in the fields file.
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

/** The opening line, drawn over the template's broken one. */
type Intro = {
  page: number
  size: number
  leading: number
  baseline: number
  centerX: number
  lines: string[]
  cover: { x: number; y: number; width: number; height: number }
  coverColor: [number, number, number]
}
// Read through an index signature, not `FIELDS.intro`: deleting the block from
// the JSON (what the readme there tells you to do once the template's own
// wording is fixed) would otherwise stop this file compiling.
const intro = (FIELDS as Record<string, unknown>).intro as Intro | undefined

/**
 * Does this template look like the one the coordinates were measured against?
 *
 * Only the intro asks. Stamping a value into the wrong blank leaves a legible
 * document; painting a cover rectangle over an unknown layout could hide a
 * clause, so if the page count or page size has moved, the opening line is left
 * as the template has it — broken, but whole.
 */
const looksLikeKnownTemplate = (pages: { getSize(): { width: number; height: number } }[]) => {
  const { width, height } = FIELDS.pageSize
  if (pages.length !== FIELDS.pageCount) return false
  const page = pages[intro?.page ?? 0]
  if (!page) return false
  const size = page.getSize()
  return Math.abs(size.width - width) < 1 && Math.abs(size.height - height) < 1
}

/**
 * `kalyan asan` → `Kalyan Asan`, for a name going onto a contract.
 *
 * Deliberately additive: it uppercases the first letter of each word and
 * changes nothing else. The obvious version — lowercase the rest — would turn
 * `McDonald` into `Mcdonald` and a `III` suffix into `Iii`, and a wrong name on
 * a legal document is a worse failure than an unconverted one. That also means
 * a name typed in caps stays in caps; that reads as shouting but is at least
 * still their name.
 *
 * Hyphens and apostrophes split words too, so `mary-jane o'brien` comes out as
 * `Mary-Jane O'Brien` rather than `Mary-jane O'brien`.
 */
export const titleCaseName = (name: string) =>
  (name ?? '').replace(/[^\s\-'’]+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1))

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
  `Rental Agreement - ${titleCaseName(clientName || 'Client').replace(/[\\/:*?"<>|]/g, '').trim()}.pdf`

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

  /**
   * Cover the template's opening line and set it again, properly.
   *
   * The rectangle is the page's own cream, sampled from the document; the band
   * it sits in holds nothing but the old line, so the patch doesn't read as one.
   * The last line keeps the old baseline, so the gap down to "Client/Renter
   * Name:" is exactly what the template already had.
   */
  const drawIntro = () => {
    if (!intro || !looksLikeKnownTemplate(pages)) return
    const page = pages[intro.page]
    if (!page) return

    const [r, g, b] = intro.coverColor
    page.drawRectangle({ ...intro.cover, color: rgb(r, g, b) })

    intro.lines.forEach((line, i) => {
      const y = intro.baseline + (intro.lines.length - 1 - i) * intro.leading
      const width = font.widthOfTextAtSize(line, intro.size)
      page.drawText(line, {
        x: intro.centerX - width / 2,
        y,
        size: intro.size,
        font,
        color: INK,
      })
    })
  }

  drawIntro()
  // Title-cased at the point of drawing, not in the DB: the owner's own record
  // stays exactly as they typed it, and only the contract is presented.
  const clientName = titleCaseName(values.clientName)
  draw('clientName', clientName)
  draw('eventDate', formatEventDate(values.eventDate))
  draw('eventType', titleCaseName((values.eventType ?? '').trim()))
  draw('signatureClientName', clientName)

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
