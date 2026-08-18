// vendor-agreement-preview.mjs — stamp sample values onto the vendor agreement.
//
//   node scripts/vendor-agreement-preview.mjs
//   node scripts/vendor-agreement-preview.mjs "Hill Country Catering" 2027-06-12 catering,dj
//
// Writes .vendor-agreement-preview.pdf (gitignored) and prints where every
// value landed.
//
// Same reason the rental agreement has one: the template has no form fields, so
// each value is drawn at a fixed coordinate from src/lib/vendor-agreement-fields.json.
// Re-export the template and those coordinates go silently wrong — a vendor
// receives a contract with their email through a table rule and nothing errors.
// Run this and LOOK at the output after any change to either file.
//
// It reads the same JSON and repeats the same drawing rules as
// src/lib/vendor-agreement.ts, which is what the admin panel runs. The only
// difference is where the template comes from: this reads the repo copy, the
// panel downloads it from the `documents` bucket. Keep the two in step.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import pkg from 'pdf-lib'
const { PDFDocument, StandardFonts, rgb } = pkg

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TEMPLATE = path.join(root, 'INFINITY RIO RANCH - Vendor Agreement.pdf')
const FIELDS = path.join(root, 'src/lib/vendor-agreement-fields.json')
const OUT = path.join(root, '.vendor-agreement-preview.pdf')

const [
  businessName = 'Hill Country Catering Co.',
  eventDate = '2027-06-12',
  services = 'catering,event_manager',
] = process.argv.slice(2)

const { fields, checkboxes, constants } = JSON.parse(readFileSync(FIELDS, 'utf8'))

// Mirrors BOX in src/lib/vendor-agreement.ts: the panel's service names on the
// left, the boxes the template actually prints on the right.
const BOX = { catering: 'food', decor: 'decoration', dj: 'dj', event_manager: 'other' }
const SERVICE_LABELS = { catering: 'Catering', decor: 'Decor', dj: 'DJ', event_manager: 'Event Manager' }

const sample = {
  businessName,
  contactPerson: 'Marisol Vega',
  phone: '(512) 555-0148',
  email: 'events@hillcountrycatering.com',
  clientEventName: 'Raghunathan / Okonkwo Wedding',
  serviceTypes: services.split(',').map((s) => s.trim()).filter(Boolean),
  agreementDate: '2026-11-03',
  eventDate,
  vendorRepName: 'Marisol Vega',
  venueRepName: 'Infinity Rio Ranch',
}

const parseDate = (d) => {
  if (!d) return null
  const date = new Date(d + 'T00:00:00Z')
  return Number.isNaN(date.getTime()) ? null : date
}
const formatEventDate = (d) => {
  const date = parseDate(d)
  return date
    ? date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    : ''
}
const splitAgreementDate = (d) => {
  const date = parseDate(d)
  if (!date) return { day: '', month: '', year: '' }
  return {
    day: String(date.getUTCDate()),
    month: date.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' }),
    year: String(date.getUTCFullYear()).slice(-2),
  }
}

const pdf = await PDFDocument.load(readFileSync(TEMPLATE))
const font = await pdf.embedFont(StandardFonts.Helvetica)
const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
const pages = pdf.getPages()
const INK = rgb(0.1, 0.08, 0.07)

const draw = (key, text) => {
  const f = fields[key]
  if (!f || !text) return
  const page = pages[f.page]
  if (!page) return
  let size = f.size
  while (size > 6 && font.widthOfTextAtSize(text, size) > f.maxWidth) size -= 0.25
  page.drawText(text, { x: f.x, y: f.y, size, font, color: INK })
  const w = font.widthOfTextAtSize(text, size)
  console.log(
    `  ${key.padEnd(16)} page ${f.page + 1}  x ${f.x}→${(f.x + w).toFixed(1)} (max ${(f.x + f.maxWidth).toFixed(1)})  y ${f.y}  ${size}pt${size !== f.size ? ' (shrunk)' : ''}  "${text}"`,
  )
}

const tick = (service) => {
  const box = checkboxes[BOX[service]]
  if (!box) return
  const page = pages[box.page]
  if (!page) return
  const size = box.size * 0.85
  const width = bold.widthOfTextAtSize('X', size)
  const capHeight = bold.heightAtSize(size, { descender: false })
  const x = box.x + (box.size - width) / 2
  const y = box.y + (box.size - capHeight) / 2
  page.drawText('X', { x, y, size, font: bold, color: INK })
  console.log(`  ${('☑ ' + service).padEnd(16)} page ${box.page + 1}  x ${x.toFixed(1)}  y ${y.toFixed(1)}  box ${box.x}..${(box.x + box.size).toFixed(1)}`)
}

console.log('[vendor agreement] stamping:')
const { day, month, year } = splitAgreementDate(sample.agreementDate)
draw('venue', constants.venue)
draw('agreementDay', day)
draw('agreementMonth', month)
draw('agreementYear', year)
draw('eventDate', formatEventDate(sample.eventDate))
draw('businessName', sample.businessName)
draw('contactPerson', sample.contactPerson)
draw('phone', sample.phone)
draw('email', sample.email)
draw('clientEventName', sample.clientEventName)
draw('vendorRepName', sample.vendorRepName)
draw('venueRepName', sample.venueRepName)
for (const service of sample.serviceTypes) tick(service)
if (sample.serviceTypes.includes('event_manager')) draw('otherLine', SERVICE_LABELS.event_manager)

writeFileSync(OUT, await pdf.save())
console.log(`\n[vendor agreement] wrote ${path.relative(root, OUT)} — open it and check every value sits on its line.`)
