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
