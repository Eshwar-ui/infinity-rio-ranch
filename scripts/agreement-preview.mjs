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

const { fields, intro, pageSize, pageCount } = JSON.parse(readFileSync(FIELDS, 'utf8'))

const formatEventDate = (d) =>
  d
    ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : ''

/** Mirrors titleCaseName() in agreement.ts — see the note there on why it only
 *  ever adds capitals. Keep the two in step or this preview lies. */
const titleCaseName = (name) =>
  (name ?? '').replace(/[^\s\-'’]+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1))

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

/** Same guard as agreement.ts: a cover rectangle on an unrecognised layout
 *  could hide a clause, so an unfamiliar template keeps its broken line. */
const looksLikeKnownTemplate = () => {
  if (pages.length !== pageCount) return false
  const page = pages[intro?.page ?? 0]
  if (!page) return false
  const { width, height } = page.getSize()
  return Math.abs(width - pageSize.width) < 1 && Math.abs(height - pageSize.height) < 1
}

/** Mirrors drawIntro() in agreement.ts — the template's opening line is broken,
 *  so it gets covered and reset. Keep the two in step or this preview lies. */
const drawIntro = () => {
  if (!intro) return
  if (!looksLikeKnownTemplate()) {
    console.log('  intro                SKIPPED — template is not the one these coordinates fit')
    return
  }
  const page = pages[intro.page]
  if (!page) return
  const [r, g, b] = intro.coverColor
  page.drawRectangle({ ...intro.cover, color: rgb(r, g, b) })
  intro.lines.forEach((line, i) => {
    const y = intro.baseline + (intro.lines.length - 1 - i) * intro.leading
    const width = font.widthOfTextAtSize(line, intro.size)
    page.drawText(line, { x: intro.centerX - width / 2, y, size: intro.size, font, color: rgb(0.1, 0.08, 0.07) })
    console.log(
      `  ${(i === 0 ? 'intro' : '').padEnd(20)} page ${intro.page + 1}  x ${(intro.centerX - width / 2).toFixed(1)}→${(intro.centerX + width / 2).toFixed(1)}  y ${y.toFixed(1)}  ${intro.size}pt  "${line}"`,
    )
  })
}

console.log('[agreement] stamping:')
drawIntro()
draw('clientName', titleCaseName(name))
draw('eventDate', formatEventDate(date))
draw('eventType', titleCaseName(type))
draw('signatureClientName', titleCaseName(name))

writeFileSync(OUT, await pdf.save())
console.log(`\n[agreement] wrote ${path.relative(root, OUT)} — open it and check every value sits on its line.`)
