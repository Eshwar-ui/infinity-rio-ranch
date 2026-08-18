/**
 * The four kinds of vendor the venue books, and nothing else.
 *
 * Deliberately its own module rather than part of `vendor-agreement.ts`: that
 * file pulls in `pdf-lib` (~400 kB) to build the document, and the vendors list
 * only needs the names. Importing them from there put the whole PDF library in
 * the list's chunk, downloaded by anyone who so much as opened the table.
 *
 * These are the venue's words. The printed template has boxes for Food,
 * Decoration, DJ and Other — `vendor-agreement.ts` owns that translation.
 */
export const SERVICE_TYPES = ['catering', 'decor', 'dj', 'event_manager'] as const
export type ServiceType = (typeof SERVICE_TYPES)[number]

export const SERVICE_LABELS: Record<ServiceType, string> = {
  catering: 'Catering',
  decor: 'Decor',
  dj: 'DJ',
  event_manager: 'Event Manager',
}
