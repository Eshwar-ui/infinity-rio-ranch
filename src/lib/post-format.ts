/**
 * Post dates, formatted identically everywhere.
 *
 * Deliberately not `toLocaleDateString()`. That reads the *runtime's* locale and
 * timezone, so the prerenderer (Node, on a build machine, in UTC) and the
 * visitor's browser can produce different strings for the same post — which is
 * a hydration mismatch on a prerendered page, and React's recovery is to throw
 * away the server HTML and re-render the whole route on the client.
 *
 * Reading the date parts straight out of the ISO string avoids both problems at
 * once: no timezone shift (a post published late evening UTC doesn't show as
 * the previous day in Texas), and no dependency on which ICU data the runtime
 * happens to ship.
 */

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/** `2026-03-14T…` → `14 March 2026`. Returns '' for anything unparseable. */
export const formatPostDate = (iso: string | null): string => {
  if (!iso) return ''
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!match) return ''
  const [, year, month, day] = match
  const name = MONTHS[Number(month) - 1]
  if (!name) return ''
  return `${Number(day)} ${name} ${year}`
}

export type ArticleHeading = {
  id: string
  level: number
  text: string
  line: number
}

/** Turns a markdown heading into a stable, readable fragment identifier. */
const headingSlug = (value: string) =>
  value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section'

/**
 * The article's navigable headings. `line` also lets the markdown renderer use
 * exactly the same IDs, including when two headings have identical wording.
 */
export const articleHeadings = (body: string): ArticleHeading[] => {
  const used = new Map<string, number>()
  let inCodeFence = false

  return body.split(/\r?\n/).flatMap((line, index) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inCodeFence = !inCodeFence
      return []
    }
    if (inCodeFence) return []

    const match = /^(#{1,4})\s+(.+?)(?:\s+#+)?\s*$/.exec(line)
    if (!match) return []

    const [, marks, rawText] = match
    const text = rawText.trim()
    const base = headingSlug(text)
    const count = used.get(base) ?? 0
    used.set(base, count + 1)

    return [{ id: count === 0 ? base : `${base}-${count + 1}`, level: marks.length, text, line: index + 1 }]
  })
}
