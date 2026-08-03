import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'

type Row = Record<string, any>

const CATS = ['ceremony', 'reception', 'outdoor', 'details'] as const
const SPANS = [
  { value: '', label: 'Normal' },
  { value: 'tall', label: 'Tall (2 rows)' },
  { value: 'wide', label: 'Wide (2 cols)' },
]

const inputClass =
  'w-full rounded-[1px] border border-line bg-transparent px-[13px] py-2.5 text-sm text-cream outline-none transition-colors focus:border-brass'

export const AdminGallery = () => {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<Row | null>(null)
  const [uploading, setUploading] = useState(false)

  const load = () => {
    setLoading(true)
    supabase
      .from('gallery')
      .select('*')
      .order('sort', { ascending: true })
      .then(({ data, error }) => {
        if (error) toast.error('Could not load gallery.')
        else setRows(data ?? [])
        setLoading(false)
      })
  }
  useEffect(load, [])

  const blank = (): Row => ({
    label: '',
    cat: 'ceremony',
    src: '',
    span: '',
    featured: false,
    published: true,
    sort: rows.length,
  })

  const uploadFile = async (file: File) => {
    setUploading(true)
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '')
    const path = `${crypto.randomUUID()}-${safe}`
    const { error } = await supabase.storage.from('gallery').upload(path, file)
    if (error) {
      toast.error('Upload failed.')
      setUploading(false)
      return
    }
    const { data } = supabase.storage.from('gallery').getPublicUrl(path)
    setDraft((d) => (d ? { ...d, src: data.publicUrl } : d))
    setUploading(false)
    toast.success('Image uploaded.')
  }

  const save = async () => {
    if (!draft) return
    if (!String(draft.label).trim()) return toast.error('Label is required.')
    if (!String(draft.src).trim()) return toast.error('An image is required.')

    const payload = {
      label: draft.label,
      cat: draft.cat,
      src: draft.src,
      span: draft.span || null,
      featured: !!draft.featured,
      published: !!draft.published,
      sort: Number(draft.sort) || 0,
    }
    const res = draft.id
      ? await supabase.from('gallery').update(payload).eq('id', draft.id).select().single()
      : await supabase.from('gallery').insert(payload).select().single()
    if (res.error) return toast.error('Could not save.')

    // Single-featured is enforced by a DB trigger (0002_hardening.sql) — no
    // client-side clearing needed. `load()` below refetches the corrected state.
    setDraft(null)
    toast.success('Saved.')
    load()
  }

  const remove = async (row: Row) => {
    if (!confirm('Delete this photo permanently?')) return
    setRows((prev) => prev.filter((r) => r.id !== row.id))
    if (draft?.id === row.id) setDraft(null)
    const { error } = await supabase.from('gallery').delete().eq('id', row.id)
    if (error) {
      toast.error('Could not delete.')
      return
    }
    // Best-effort: also remove the uploaded file from Storage so it doesn't
    // orphan. Seed rows point at bundled /assets and have no Storage object —
    // those are skipped (marker absent).
    const marker = '/storage/v1/object/public/gallery/'
    const at = String(row.src ?? '').indexOf(marker)
    if (at !== -1) {
      const path = decodeURIComponent(String(row.src).slice(at + marker.length))
      await supabase.storage.from('gallery').remove([path])
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-line px-8 py-6">
        <div>
          <h1 className="font-serif text-2xl text-cream">Gallery</h1>
          <p className="mt-1 text-[12px] text-muted">{rows.length} photos</p>
        </div>
        <button
          onClick={() => setDraft(blank())}
          className="bg-brass px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-onbrass transition-colors hover:bg-brass2"
        >
          + New photo
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="w-[420px] shrink-0 overflow-y-auto border-r border-line">
          {loading ? (
            <p className="px-8 py-10 text-sm text-muted">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="px-8 py-10 text-sm text-muted">No photos yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 p-4">
              {rows.map((row) => (
                <button
                  key={row.id}
                  onClick={() => setDraft({ ...row, span: row.span ?? '' })}
                  className={`group relative aspect-square overflow-hidden rounded-[2px] border bg-cover bg-center text-left ${
                    draft?.id === row.id ? 'border-brass' : 'border-line'
                  }`}
                  style={{ backgroundImage: `url(${row.src})` }}
                >
                  <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-[rgba(10,8,6,0.9)] to-transparent p-2">
                    <span className="truncate text-[10px] text-cream">{row.label}</span>
                  </span>
                  <span className="absolute left-1.5 top-1.5 flex gap-1">
                    {row.featured && (
                      <span className="rounded-full bg-brass px-1.5 py-0.5 text-[8px] uppercase tracking-wide text-onbrass">
                        ★
                      </span>
                    )}
                    {!row.published && (
                      <span className="rounded-full border border-line bg-ink/80 px-1.5 py-0.5 text-[8px] uppercase tracking-wide text-muted">
                        Draft
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 overflow-y-auto">
          {!draft ? (
            <div className="grid h-full place-items-center text-sm text-muted">
              Select a photo, or add a new one.
            </div>
          ) : (
            <div className="max-w-2xl px-10 py-8">
              <h2 className="font-serif text-xl text-cream">
                {draft.id ? 'Edit photo' : 'New photo'}
              </h2>

              <div className="mt-6 space-y-5">
                <div>
                  <label className="mb-1.5 block text-[10px] uppercase tracking-[0.2em] text-muted">
                    Image *
                  </label>
                  {draft.src && (
                    <div
                      className="mb-3 aspect-[16/9] w-full rounded-[2px] border border-line bg-cover bg-center"
                      style={{ backgroundImage: `url(${draft.src})` }}
                    />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) void uploadFile(f)
                    }}
                    className="block w-full text-sm text-muted file:mr-4 file:cursor-pointer file:border file:border-line file:bg-transparent file:px-4 file:py-2 file:text-[11px] file:uppercase file:tracking-[0.18em] file:text-brass2"
                  />
                  {uploading && <p className="mt-2 text-[12px] text-brass2">Uploading…</p>}
                  <input
                    placeholder="…or paste an image URL / path"
                    value={draft.src ?? ''}
                    onChange={(e) => setDraft({ ...draft, src: e.target.value })}
                    className={`${inputClass} mt-3`}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[10px] uppercase tracking-[0.2em] text-muted">
                    Caption *
                  </label>
                  <input
                    value={draft.label ?? ''}
                    onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                    className={inputClass}
                  />
                </div>

                <div className="flex gap-5">
                  <div className="flex-1">
                    <label className="mb-1.5 block text-[10px] uppercase tracking-[0.2em] text-muted">
                      Category
                    </label>
                    <select
                      value={draft.cat}
                      onChange={(e) => setDraft({ ...draft, cat: e.target.value })}
                      className={inputClass}
                    >
                      {CATS.map((c) => (
                        <option key={c} value={c} className="bg-ink">
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="mb-1.5 block text-[10px] uppercase tracking-[0.2em] text-muted">
                      Size
                    </label>
                    <select
                      value={draft.span ?? ''}
                      onChange={(e) => setDraft({ ...draft, span: e.target.value })}
                      className={inputClass}
                    >
                      {SPANS.map((s) => (
                        <option key={s.value} value={s.value} className="bg-ink">
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

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
                      checked={!!draft.featured}
                      onChange={(e) => setDraft({ ...draft, featured: e.target.checked })}
                    />
                    Featured
                  </label>
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
                  disabled={uploading}
                  className="bg-brass px-5 py-2.5 text-[11px] uppercase tracking-[0.18em] text-onbrass transition-colors hover:bg-brass2 disabled:opacity-50"
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
