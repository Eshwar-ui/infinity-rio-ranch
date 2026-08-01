import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'

export type EditorField = {
  key: string
  label: string
  type: 'text' | 'textarea'
  required?: boolean
}

type Row = Record<string, any>

type Props = {
  table: string
  /** Plural, e.g. "Testimonials". */
  title: string
  fields: EditorField[]
  primary: (row: Row) => string
  subtitle?: (row: Row) => string
  /**
   * Restricts the editor to one slice of a shared table, e.g. `list_items`
   * holds both "What's included" and the inquiry form's event types under a
   * `list` column. Filters the read and is stamped onto every insert, so a row
   * created here can't land in the wrong list.
   */
  scope?: { column: string; value: string }
}

const inputClass =
  'w-full rounded-[1px] border border-line bg-transparent px-[13px] py-2.5 text-sm text-cream outline-none transition-colors focus:border-brass'

/**
 * Generic CRUD editor for the CMS content tables (testimonials, events, faqs).
 * Ordering + published toggle are handled here; per-type fields come from config.
 * The table's RLS is the real guard — this UI only runs for admins anyway.
 */
export const ContentEditor = ({
  table,
  title,
  fields,
  primary,
  subtitle,
  scope,
}: Props) => {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<Row | null>(null)

  const scopeColumn = scope?.column
  const scopeValue = scope?.value

  useEffect(() => {
    let active = true
    let query = supabase.from(table).select('*')
    if (scopeColumn && scopeValue) query = query.eq(scopeColumn, scopeValue)
    query
      .order('sort', { ascending: true })
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!active) return
        if (error) toast.error(`Could not load ${title.toLowerCase()}.`)
        else setRows(data ?? [])
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [table, title, scopeColumn, scopeValue])

  const blank = (): Row => {
    const r: Row = { published: true, sort: rows.length }
    for (const f of fields) r[f.key] = ''
    return r
  }

  const save = async () => {
    if (!draft) return
    for (const f of fields) {
      if (f.required && !String(draft[f.key] ?? '').trim()) {
        toast.error(`${f.label} is required.`)
        return
      }
    }
    const payload: Row = { published: !!draft.published, sort: Number(draft.sort) || 0 }
    for (const f of fields) payload[f.key] = draft[f.key] ?? null
    if (scopeColumn && scopeValue) payload[scopeColumn] = scopeValue

    const res = draft.id
      ? await supabase.from(table).update(payload).eq('id', draft.id).select().single()
      : await supabase.from(table).insert(payload).select().single()

    if (res.error) {
      toast.error('Could not save.')
      return
    }
    const saved = res.data as Row
    setRows((prev) => {
      const without = prev.filter((r) => r.id !== saved.id)
      return [...without, saved].sort(
        (a, b) => a.sort - b.sort || (a.created_at < b.created_at ? -1 : 1),
      )
    })
    setDraft(null)
    toast.success('Saved.')
  }

  const remove = async (row: Row) => {
    if (!confirm('Delete this item permanently?')) return
    setRows((prev) => prev.filter((r) => r.id !== row.id))
    if (draft?.id === row.id) setDraft(null)
    const { error } = await supabase.from(table).delete().eq('id', row.id)
    if (error) toast.error('Could not delete.')
  }

  const togglePublished = async (row: Row) => {
    const next = !row.published
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, published: next } : r)))
    const { error } = await supabase.from(table).update({ published: next }).eq('id', row.id)
    if (error) toast.error('Could not update.')
  }

  const singular = title.replace(/s$/, '')

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-line px-8 py-6">
        <div>
          <h1 className="font-serif text-2xl text-cream">{title}</h1>
          <p className="mt-1 text-[12px] text-muted">
            {rows.length} item{rows.length === 1 ? '' : 's'}
          </p>
        </div>
        <button
          onClick={() => setDraft(blank())}
          className="bg-brass px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-onbrass transition-colors hover:bg-brass2"
        >
          + New
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="w-[420px] shrink-0 overflow-y-auto border-r border-line">
          {loading ? (
            <p className="px-8 py-10 text-sm text-muted">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="px-8 py-10 text-sm text-muted">Nothing yet. Add the first item.</p>
          ) : (
            rows.map((row) => (
              <div
                key={row.id}
                className={`flex items-start justify-between gap-3 border-b border-line px-6 py-4 ${
                  draft?.id === row.id ? 'bg-panel' : ''
                }`}
              >
                <button
                  onClick={() => setDraft({ ...row })}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="truncate text-[14px] text-cream">{primary(row)}</div>
                  {subtitle && (
                    <div className="mt-0.5 truncate text-[12px] text-muted">{subtitle(row)}</div>
                  )}
                </button>
                <button
                  onClick={() => togglePublished(row)}
                  title="Toggle published"
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] ${
                    row.published ? 'border-brass/40 text-brass2' : 'border-line text-muted'
                  }`}
                >
                  {row.published ? 'Live' : 'Draft'}
                </button>
              </div>
            ))
          )}
        </div>

        <div className="min-w-0 flex-1 overflow-y-auto">
          {!draft ? (
            <div className="grid h-full place-items-center text-sm text-muted">
              Select an item, or add a new one.
            </div>
          ) : (
            <div className="max-w-2xl px-10 py-8">
              <h2 className="font-serif text-xl text-cream">
                {draft.id ? `Edit ${singular.toLowerCase()}` : `New ${singular.toLowerCase()}`}
              </h2>

              <div className="mt-6 space-y-5">
                {fields.map((f) => (
                  <div key={f.key}>
                    <label className="mb-1.5 block text-[10px] uppercase tracking-[0.2em] text-muted">
                      {f.label}
                      {f.required && ' *'}
                    </label>
                    {f.type === 'textarea' ? (
                      <textarea
                        rows={4}
                        value={draft[f.key] ?? ''}
                        onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                        className={inputClass}
                      />
                    ) : (
                      <input
                        value={draft[f.key] ?? ''}
                        onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                        className={inputClass}
                      />
                    )}
                  </div>
                ))}

                <div className="flex items-end gap-8">
                  <div>
                    <label className="mb-1.5 block text-[10px] uppercase tracking-[0.2em] text-muted">
                      Order
                    </label>
                    <input
                      type="number"
                      value={draft.sort ?? 0}
                      onChange={(e) => setDraft({ ...draft, sort: e.target.value })}
                      className={`${inputClass} w-24`}
                    />
                  </div>
                  <label className="flex items-center gap-2 pb-2.5 text-sm text-cream">
                    <input
                      type="checkbox"
                      checked={!!draft.published}
                      onChange={(e) => setDraft({ ...draft, published: e.target.checked })}
                    />
                    Published
                  </label>
                </div>
              </div>

              <div className="mt-8 flex items-center gap-4 border-t border-line pt-6">
                <button
                  onClick={save}
                  className="bg-brass px-5 py-2.5 text-[11px] uppercase tracking-[0.18em] text-onbrass transition-colors hover:bg-brass2"
                >
                  Save
                </button>
                <button
                  onClick={() => setDraft(null)}
                  className="text-[11px] uppercase tracking-[0.18em] text-muted hover:text-cream"
                >
                  Cancel
                </button>
                {draft.id && (
                  <button
                    onClick={() => remove(draft)}
                    className="ml-auto text-[11px] uppercase tracking-[0.18em] text-muted hover:text-[#d98a6a]"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
