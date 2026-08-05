import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import { btnPrimary, btnSmall, pageTitle } from '@/lib/admin-ui'
import { COPY_DEFAULTS, type CopyEntry } from '@/data/copy'

const PAGES: { key: string; label: string; hint: string }[] = [
  { key: 'home', label: 'Home', hint: 'The homepage, top to bottom.' },
  { key: 'about', label: 'About', hint: 'Intro, amenities and “what’s included”.' },
  { key: 'gallery', label: 'Gallery', hint: 'Headings around the photo wall.' },
  { key: 'contact', label: 'Contact', hint: 'Inquiry form and FAQ headings.' },
  { key: 'global', label: 'Contact details', hint: 'Used across every page and the invoices.' },
]

const inputClass =
  'w-full rounded-[1px] border border-line bg-transparent px-[13px] py-2.5 text-sm text-cream outline-none transition-colors focus:border-brass'

/**
 * Editor for the keyed page copy in `site_copy`.
 *
 * Not built on `ContentEditor`: these rows aren't a list the owner adds to or
 * deletes from. The set of keys is fixed by what the components ask for, so the
 * field list comes from `copy.defaults.json` and the database only supplies
 * values. That also means the editor still renders every field before the
 * migration has been applied — it just can't save yet.
 *
 * Saving upserts, so a key that has never been edited (no row yet) is created
 * on the spot rather than needing a seed to exist first.
 */
export const AdminPageCopy = () => {
  const [page, setPage] = useState('home')
  const [values, setValues] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    supabase
      .from('site_copy')
      .select('key,value')
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          toast.error('Could not load page copy. Has migration 0003 been run?')
        } else {
          const next: Record<string, string> = {}
          for (const row of data ?? []) next[row.key] = row.value ?? ''
          setValues(next)
          setSaved(next)
        }
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const fields = useMemo(
    () =>
      COPY_DEFAULTS.filter((entry) => entry.page === page).sort((a, b) => a.sort - b.sort),
    [page],
  )

  /** A field is dirty when it differs from what's actually stored. */
  const dirtyKeys = useMemo(
    () => Object.keys(values).filter((key) => (values[key] ?? '') !== (saved[key] ?? '')),
    [values, saved],
  )

  const valueFor = (entry: CopyEntry) => values[entry.key] ?? ''

  const save = async () => {
    if (dirtyKeys.length === 0) return
    setBusy(true)

    // Upsert the full row: a key with no row yet needs its label/page/type too,
    // and they come from the same defaults file the site falls back to.
    const byKey = new Map(COPY_DEFAULTS.map((entry) => [entry.key, entry]))
    const payload = dirtyKeys.flatMap((key) => {
      const entry = byKey.get(key)
      if (!entry) return []
      return [
        {
          key,
          page: entry.page,
          label: entry.label,
          type: entry.type,
          sort: entry.sort,
          value: values[key] ?? '',
        },
      ]
    })

    const { error } = await supabase.from('site_copy').upsert(payload, { onConflict: 'key' })
    setBusy(false)

    if (error) {
      toast.error('Could not save.')
      return
    }
    setSaved((prev) => ({ ...prev, ...Object.fromEntries(dirtyKeys.map((k) => [k, values[k] ?? ''])) }))
    toast.success(
      `Saved ${payload.length} change${payload.length === 1 ? '' : 's'}. Publish to update the live site.`,
    )
  }

  const revert = (entry: CopyEntry) =>
    setValues((prev) => ({ ...prev, [entry.key]: entry.value }))

  const active = PAGES.find((p) => p.key === page)

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-line px-8 py-6">
        <div>
          <h1 className={pageTitle}>Page content</h1>
          <p className="mt-1 text-[12px] text-muted">
            {dirtyKeys.length === 0
              ? 'Every heading and paragraph on the public site.'
              : `${dirtyKeys.length} unsaved change${dirtyKeys.length === 1 ? '' : 's'}.`}
          </p>
        </div>
        <button
          onClick={save}
          disabled={busy || dirtyKeys.length === 0}
          className={btnPrimary}
        >
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="w-[260px] shrink-0 overflow-y-auto border-r border-line py-3">
          {PAGES.map((p) => {
            const pending = COPY_DEFAULTS.filter(
              (e) => e.page === p.key && dirtyKeys.includes(e.key),
            ).length
            return (
              <button
                key={p.key}
                onClick={() => setPage(p.key)}
                className={`flex w-full items-center justify-between gap-2 border-b border-line px-6 py-4 text-left ${
                  page === p.key ? 'bg-panel text-brass2' : 'text-cream/80 hover:text-brass2'
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[14px]">{p.label}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted">{p.hint}</span>
                </span>
                {pending > 0 && (
                  <span className="shrink-0 rounded-full border border-brass/40 px-2 py-0.5 text-[11px] font-medium text-brass2">
                    {pending}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="min-w-0 flex-1 overflow-y-auto">
          {loading ? (
            <p className="px-10 py-10 text-sm text-muted">Loading…</p>
          ) : (
            <div className="max-w-4xl px-8 py-7 2xl:px-10">
              <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-cream">
                {active?.label}
              </h2>
              <p className="mt-1 text-[12px] text-muted">
                Clearing a field restores the text the site shipped with.
              </p>

              <div className="mt-7 space-y-6">
                {fields.map((entry) => {
                  const isDirty = (values[entry.key] ?? '') !== (saved[entry.key] ?? '')
                  return (
                    <div key={entry.key}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-4">
                        <label
                          htmlFor={entry.key}
                          className="text-[12px] font-medium text-muted"
                        >
                          {entry.label}
                          {isDirty && <span className="ml-2 text-brass2">•</span>}
                        </label>
                        <button
                          type="button"
                          onClick={() => revert(entry)}
                          className={btnSmall}
                        >
                          Reset
                        </button>
                      </div>
                      {entry.type === 'multiline' ? (
                        <textarea
                          id={entry.key}
                          rows={4}
                          value={valueFor(entry)}
                          placeholder={entry.value}
                          onChange={(e) =>
                            setValues((prev) => ({ ...prev, [entry.key]: e.target.value }))
                          }
                          className={inputClass}
                        />
                      ) : (
                        <input
                          id={entry.key}
                          value={valueFor(entry)}
                          placeholder={entry.value}
                          onChange={(e) =>
                            setValues((prev) => ({ ...prev, [entry.key]: e.target.value }))
                          }
                          className={inputClass}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
