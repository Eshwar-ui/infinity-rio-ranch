import defaults from './copy.defaults.json'

export type CopyType = 'text' | 'multiline'

export type CopyEntry = {
  /** Dotted address, `page.section.field` — the key the components ask for. */
  key: string
  /** Groups the key in the admin editor: home | about | gallery | contact | global. */
  page: string
  /** Human-readable label shown to whoever is editing. */
  label: string
  type: CopyType
  sort: number
  value: string
}

/**
 * Every editable string on the public site, with its shipped default.
 *
 * This file is the single source for three things that must not drift: the
 * fallback the components render when the CMS has nothing to say, the seed rows
 * in `supabase/migrations/0003_page_content.sql`, and the field list the admin
 * copy editor renders. Add a key here first, then reference it from a component.
 */
export const COPY_DEFAULTS = defaults as CopyEntry[]

export const DEFAULT_COPY: Record<string, string> = Object.fromEntries(
  COPY_DEFAULTS.map((entry) => [entry.key, entry.value]),
)
