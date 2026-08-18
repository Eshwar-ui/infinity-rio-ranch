/**
 * vendor-agreement.ts — stamps a vendor's details onto the venue's own
 * Vendor Services Agreement PDF.
 *
 * The client rental agreement is built in an edge function because its email
 * needs it. Nothing emails a vendor agreement: the owner fills the form, reads
 * the finished document on screen and downloads it. So this one is built in the
 * browser — the admin panel is lazy-loaded behind auth, `pdf-lib` is already a
 * dependency, and generating locally is what makes the preview update as you
 * type instead of costing a round trip per keystroke.
 *
 * The template itself still lives in the private `documents` bucket, like the
 * rental one, so replacing the wording is an upload and not a deploy. An admin
 * can read that bucket (0007's RLS policies); nobody else can.
 *
 * Every value sits at a fixed coordinate from `vendor-agreement-fields.json` —
 * read the warning at the top of that file before touching either.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'

import FIELDS from './vendor-agreement-fields.json'
import { SERVICE_LABELS, type ServiceType } from './vendor-services'
import { supabase } from './supabase'

export const TEMPLATE_BUCKET = 'documents'
export const TEMPLATE_PATH = 'vendor-agreement-template.pdf'

/** Near-black with a little warmth, matching the rental agreement's ink. */
const INK = rgb(0.1, 0.08, 0.07)

// Re-exported so a caller building a document doesn't need both imports; the
// names themselves live in vendor-services.ts, away from pdf-lib.
export { SERVICE_TYPES, SERVICE_LABELS, type ServiceType } from './vendor-services'

/**
 * Which of the template's four printed boxes each service ticks.
 *
 * The document says Food / Decoration / DJ / Other; the venue says Catering /
 * Decor / DJ / Event Manager. Rather than make the owner translate at the point
 * of filling a contract, the panel speaks the venue's words and this maps them
 * onto the squares the paper actually has. An Event Manager ticks Other and
 * writes its own name on the line beside it, which is what that line is for.
 */
const BOX: Record<ServiceType, string> = {
  catering: 'food',
  decor: 'decoration',
  dj: 'dj',
  event_manager: 'other',
}

export type VendorAgreementValues = {
  businessName: string
  contactPerson?: string | null
  phone?: string | null
  email?: string | null
  clientEventName?: string | null
  serviceTypes?: ServiceType[] | null
  /** 'YYYY-MM-DD' — the date the agreement is made. */
  agreementDate?: string | null
  /** 'YYYY-MM-DD' — the date of the event the vendor is working. */
  eventDate?: string | null
  vendorRepName?: string | null
  venueRepName?: string | null
}

type Field = { page: number; x: number; y: number; size: number; maxWidth: number }
type Checkbox = { page: number; x: number; y: number; size: number }

const fields = FIELDS.fields as Record<string, Field>
const checkboxes = FIELDS.checkboxes as Record<string, Checkbox>

/**
 * Bare dates shift a day if parsed without a time zone — the same trap the
 * rental agreement's formatter avoids.
 */
const parseDate = (d?: string | null) => {
  if (!d) return null
  const date = new Date(d + 'T00:00:00Z')
  return Number.isNaN(date.getTime()) ? null : date
}

/** `2027-06-12` → `June 12, 2027`, for the single-line EVENT DATE blank. */
export const formatEventDate = (d?: string | null) => {
  const date = parseDate(d)
  return date
    ? date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : ''
}

/**
 * The AGREEMENT DATE blank is printed as `___ / ________ / 20__`, so the date
 * arrives in three pieces and the year is only its last two digits — writing
 * `2027` after the template's own `20` would read as `202027`.
 */
export const splitAgreementDate = (d?: string | null) => {
  const date = parseDate(d)
  if (!date) return { day: '', month: '', year: '' }
  return {
    day: String(date.getUTCDate()),
    month: date.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' }),
    year: String(date.getUTCFullYear()).slice(-2),
  }
}

/** `Vendor Agreement - Hill Country Catering.pdf`, minus anything a filesystem hates. */
export const vendorAgreementFileName = (businessName: string) =>
  `Vendor Agreement - ${(businessName || 'Vendor').replace(/[\\/:*?"<>|]/g, '').trim()}.pdf`

/**
 * Fetches the blank template. Returns null when the owner hasn't uploaded one
 * yet, so the caller can say so plainly rather than throwing at them.
 */
export const loadVendorTemplate = async (): Promise<Uint8Array | null> => {
  const { data, error } = await supabase.storage.from(TEMPLATE_BUCKET).download(TEMPLATE_PATH)
  if (error || !data) return null
  return new Uint8Array(await data.arrayBuffer())
}

/**
 * Draws `values` onto the template and returns the finished PDF.
 *
 * Long values are shrunk to fit their blank rather than running across the rule
 * beside them — a business name is worth setting small, never worth spilling
 * into the next column of a contract.
 */
export const fillVendorAgreement = async (
  template: Uint8Array,
  values: VendorAgreementValues,
): Promise<Uint8Array> => {
  const pdf = await PDFDocument.load(template)
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const pages = pdf.getPages()

  const draw = (key: string, text: string) => {
    const f = fields[key]
    if (!f || !text) return
    const page: PDFPage | undefined = pages[f.page]
    if (!page) return // a shorter template than these coordinates fit — skip, don't throw

    let size = f.size
    while (size > 6 && font.widthOfTextAtSize(text, size) > f.maxWidth) size -= 0.25
    page.drawText(text, { x: f.x, y: f.y, size, font, color: INK })
  }

  /** An X centred in one of the template's empty 8.2pt squares. */
  const tick = (service: ServiceType, mark: PDFFont) => {
    const box = checkboxes[BOX[service]]
    if (!box) return
    const page: PDFPage | undefined = pages[box.page]
    if (!page) return

    const size = box.size * 0.85
    const width = mark.widthOfTextAtSize('X', size)
    const capHeight = mark.heightAtSize(size, { descender: false })
    page.drawText('X', {
      x: box.x + (box.size - width) / 2,
      y: box.y + (box.size - capHeight) / 2,
      size,
      font: mark,
      color: INK,
    })
  }

  const { day, month, year } = splitAgreementDate(values.agreementDate)

  draw('venue', FIELDS.constants.venue)
  draw('agreementDay', day)
  draw('agreementMonth', month)
  draw('agreementYear', year)
  draw('eventDate', formatEventDate(values.eventDate))

  // Typed by the owner into the form that makes this document, so they go on
  // exactly as typed. (The rental agreement title-cases its client name because
  // that name is copied from whatever the couple typed into the contact form.)
  draw('businessName', (values.businessName ?? '').trim())
  draw('contactPerson', (values.contactPerson ?? '').trim())
  draw('phone', (values.phone ?? '').trim())
  draw('email', (values.email ?? '').trim())
  draw('clientEventName', (values.clientEventName ?? '').trim())
  draw('vendorRepName', (values.vendorRepName ?? '').trim())
  draw('venueRepName', (values.venueRepName ?? '').trim())

  for (const service of values.serviceTypes ?? []) tick(service, bold)
  // The template's "Other ______" line is only ever filled by the service that
  // ticked that box, so it says what the vendor is instead of leaving a reader
  // to guess what "Other" meant.
  if ((values.serviceTypes ?? []).includes('event_manager')) {
    draw('otherLine', SERVICE_LABELS.event_manager)
  }

  return await pdf.save()
}

/** Template → filled PDF in one call. Null when no template is uploaded. */
export const buildVendorAgreement = async (
  values: VendorAgreementValues,
): Promise<Uint8Array | null> => {
  const template = await loadVendorTemplate()
  if (!template) return null
  return await fillVendorAgreement(template, values)
}
