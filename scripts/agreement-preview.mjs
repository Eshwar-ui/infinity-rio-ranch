// agreement-preview.mjs — stamp sample values onto the rental agreement locally.
//
//   node scripts/agreement-preview.mjs                    # sample data
//   node scripts/agreement-preview.mjs "Priya & Daniel" 2027-06-12 Wedding
//
// Writes .agreement-preview.pdf (gitignored) and prints where each value landed.
//
// This exists because the template has no form fields: every value is drawn at
// a fixed coordinate from supabase/functions/_shared/agreement-fields.json. If
// the template PDF is ever re-exported, those coordinates go silently wrong and
// a client receives a contract with their name across the middle of a sentence.
// Run this and LOOK at the output after any change to either file.
//
// It reads the same JSON the edge function does, so what you see here is what
// gets emailed — the only difference is where the template comes from (this
// reads the repo copy; the function downloads it from the `documents` bucket).
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import pkg from 'pdf-lib'
const { PDFDocument, StandardFonts, rgb } = pkg

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TEMPLATE = path.join(root, 'INFINITY RIO RANCH - Rental Agreement.pdf')
const FIELDS = path.join(root, 'supabase/functions/_shared/agreement-fields.json')
const OUT = path.join(root, '.agreement-preview.pdf')

const [name = 'Priya Raghunathan & Daniel Okonkwo', date = '2027-06-12', type = 'Wedding'] =
  process.argv.slice(2)

const { fields } = JSON.parse(readFileSync(FIELDS, 'utf8'))

const formatEventDate = (d) =>
  d
    ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : ''

const pdf = await PDFDocument.load(readFileSync(TEMPLATE))
const font = await pdf.embedFont(StandardFonts.TimesRoman)
const pages = pdf.getPages()

const draw = (key, text) => {
  const f = fields[key]
  if (!f || !text) return
  const page = pages[f.page]
  if (!page) return
  let size = f.size
  while (size > 7 && font.widthOfTextAtSize(text, size) > f.maxWidth) size -= 0.5
  page.drawText(text, { x: f.x, y: f.y, size, font, color: rgb(0.1, 0.08, 0.07) })
  const w = font.widthOfTextAtSize(text, size)
  console.log(
    `  ${key.padEnd(20)} page ${f.page + 1}  x ${f.x}→${(f.x + w).toFixed(1)} (max ${(f.x + f.maxWidth).toFixed(1)})  y ${f.y}  ${size}pt${size !== f.size ? ' (shrunk)' : ''}  "${text}"`,
  )
}

console.log('[agreement] stamping:')
draw('clientName', name)
draw('eventDate', formatEventDate(date))
draw('eventType', type)
draw('signatureClientName', name)

writeFileSync(OUT, await pdf.save())
console.log(`\n[agreement] wrote ${path.relative(root, OUT)} — open it and check every value sits on its line.`)
