import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash, CaretUp, CaretDown } from '@phosphor-icons/react'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import {
  btnDanger,
  btnGhost,
  btnPrimary,
  btnQuiet,
  card,
  field,
  hint,
  iconBtn,
  iconBtnDanger,
  label,
  pageTitle,
  pill,
  sectionTitle,
} from '@/lib/admin-ui'
import { FilterBar, FilterGroup, SearchBox } from '@/components/admin/list-filters'
import { PostBody } from '@/lib/markdown'
import { formatPostDate } from '@/lib/post-format'

type QandA = { q: string; a: string }
type Row = Record<string, any>

type StatusFilter = 'all' | 'live' | 'draft'

/** Recommended maxima. Over these, search engines truncate — they don't reject. */
const TITLE_LIMIT = 60
const DESC_LIMIT = 155

/**
 * Title → slug. Deliberately matches the CHECK constraint in 0008: lowercase,
 * alphanumerics, single hyphens, no leading or trailing hyphen. Generating
 * something the database will reject is a worse experience than a blank field.
 */
const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    // Combining diacritics, so "Café" becomes "cafe" rather than "caf".
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const blankPost = (): Row => ({
  slug: '',
  title: '',
  excerpt: '',
  body: '',
  cover_image: '',
  cover_alt: '',
  seo_title: '',
  seo_description: '',
  author: '',
  faqs: [] as QandA[],
  cta_heading: '',
  cta_body: '',
  published: false,
})

/** Character counter that only turns amber once the limit is actually passed. */
const Counter = ({ value, limit }: { value: string; limit: number }) => (
  <span className={`tabular-nums ${value.length > limit ? 'text-[#e0b46f]' : 'text-muted/60'}`}>
    {value.length}/{limit}
  </span>
)

/**
 * Blog editor.
 *
 * Not built on `ContentEditor`: a post needs an image upload, a long-form body
 * with a preview, a repeatable FAQ list and its own SEO block, none of which
 * the generic field list can express. The list/detail shape and the RLS-only
 * security model are the same.
 */
export const AdminBlog = () => {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<Row | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState(false)
  const [picking, setPicking] = useState(false)
  const [gallery, setGallery] = useState<Row[] | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')

  const load = () => {
    setLoading(true)
    supabase
      .from('posts')
      .select('*')
      .order('published_at', { ascending: false, nullsFirst: true })
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error('Could not load posts. Has migration 0008 been run?')
        else setRows(data ?? [])
        setLoading(false)
      })
  }
  useEffect(load, [])

  /*
   * Counts are computed against the *other* active filter, so "Live 6" can
   * never sit above a list of two — same rule the leads and invoices lists use.
   */
  const bySearch = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) =>
      [r.title, r.slug, r.excerpt].some((v) => String(v ?? '').toLowerCase().includes(q)),
    )
  }, [rows, search])

  const visible = useMemo(
    () =>
      status === 'all'
        ? bySearch
        : bySearch.filter((r) => (status === 'live' ? r.published : !r.published)),
    [bySearch, status],
  )

  const statusOptions = [
    { value: 'all' as const, label: 'All', count: bySearch.length },
    { value: 'live' as const, label: 'Live', count: bySearch.filter((r) => r.published).length },
    { value: 'draft' as const, label: 'Draft', count: bySearch.filter((r) => !r.published).length },
  ]

  const patch = (changes: Row) => setDraft((d) => (d ? { ...d, ...changes } : d))

  const uploadCover = async (file: File) => {
    setUploading(true)
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '')
    const path = `blog/${crypto.randomUUID()}-${safe}`
    // Reuses the public `gallery` bucket — it already has the right policies,
    // and the gallery editor lists rows from the gallery *table*, not the bucket.
    const { error } = await supabase.storage.from('gallery').upload(path, file)
    if (error) {
      toast.error('Upload failed.')
      setUploading(false)
      return
    }
    const { data } = supabase.storage.from('gallery').getPublicUrl(path)
    patch({ cover_image: data.publicUrl })
    setUploading(false)
    toast.success('Cover uploaded.')
  }

  /*
   * Covers usually already exist. Most posts are about the venue, and the venue's
   * photos are already in the gallery — re-uploading one would duplicate the
   * file in Storage *and* lose the responsive ladder, because `SmartImage` only
   * has derivatives for the bundled `/assets` paths, not for Storage URLs.
   * Picking reuses both. Fetched on first open rather than with the page.
   */
  const openPicker = () => {
    setPicking(true)
    if (gallery) return
    void supabase
      .from('gallery')
      .select('label,src,cat')
      .eq('published', true)
      .order('sort', { ascending: true })
      .then(({ data, error }) => {
        if (error) toast.error('Could not load the gallery.')
        setGallery(data ?? [])
      })
  }

  const chooseFromGallery = (photo: Row) => {
    patch({
      cover_image: photo.src,
      // Only fills a blank alt — an alt the owner has already written for this
      // post is more specific than the gallery's generic caption.
      cover_alt: String(draft?.cover_alt ?? '').trim() || photo.label,
    })
    setPicking(false)
  }

  // ---- FAQ repeater --------------------------------------------------------
  const faqs = (draft?.faqs ?? []) as QandA[]
  const setFaqs = (next: QandA[]) => patch({ faqs: next })
  const updateFaq = (i: number, changes: Partial<QandA>) =>
    setFaqs(faqs.map((f, n) => (n === i ? { ...f, ...changes } : f)))
  const moveFaq = (i: number, by: number) => {
    const to = i + by
    if (to < 0 || to >= faqs.length) return
    const next = [...faqs]
    ;[next[i], next[to]] = [next[to], next[i]]
    setFaqs(next)
  }

  const save = async () => {
    if (!draft) return
    const title = String(draft.title ?? '').trim()
    const slug = String(draft.slug ?? '').trim()

    if (!title) return toast.error('A title is required.')
    if (!slug) return toast.error('A URL slug is required.')
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return toast.error('The slug can only use lowercase letters, numbers and hyphens.')
    }

    setSaving(true)
    const payload = {
      slug,
      title,
      excerpt: String(draft.excerpt ?? '').trim(),
      body: draft.body ?? '',
      cover_image: String(draft.cover_image ?? '').trim() || null,
      cover_alt: String(draft.cover_alt ?? '').trim(),
      seo_title: String(draft.seo_title ?? '').trim(),
      seo_description: String(draft.seo_description ?? '').trim(),
      author: String(draft.author ?? '').trim(),
      // Blank pairs would become empty <Question> nodes in the FAQ schema.
      faqs: faqs.filter((f) => f.q.trim() && f.a.trim()),
      cta_heading: String(draft.cta_heading ?? '').trim(),
      cta_body: String(draft.cta_body ?? '').trim(),
      published: !!draft.published,
      // published_at is stamped by the database on first publish — never here.
    }

    const res = draft.id
      ? await supabase.from('posts').update(payload).eq('id', draft.id).select().single()
      : await supabase.from('posts').insert(payload).select().single()

    setSaving(false)

    if (res.error) {
      // 23505 = unique_violation, which for this table can only be the slug.
      toast.error(
        res.error.code === '23505'
          ? `The slug "${slug}" is already used by another post.`
          : 'Could not save.',
      )
      return
    }

    setDraft(null)
    toast.success(
      payload.published
        ? 'Saved. Publish to the live site to show it to search engines.'
        : 'Saved as a draft.',
    )
    load()
  }

  const remove = async (row: Row) => {
    if (!confirm(`Delete "${row.title}" permanently?`)) return
    setRows((prev) => prev.filter((r) => r.id !== row.id))
    if (draft?.id === row.id) setDraft(null)

    const { error } = await supabase.from('posts').delete().eq('id', row.id)
    if (error) {
      toast.error('Could not delete.')
      load()
      return
    }
    /*
     * Best-effort cleanup of the uploaded cover — but ONLY files this editor
     * uploaded, which is what the `blog/` prefix identifies.
     *
     * The narrower check is load-bearing now that a cover can be picked from the
     * gallery. A picked photo is either a bundled /assets path (no storage
     * object at all) or a file the gallery editor uploaded and a gallery row
     * still points at. Deleting a post must never take that file with it —
     * doing so would silently blank a photo on the public gallery page.
     */
    const marker = '/storage/v1/object/public/gallery/'
    const at = String(row.cover_image ?? '').indexOf(marker)
    if (at !== -1) {
      const path = decodeURIComponent(String(row.cover_image).slice(at + marker.length))
      if (path.startsWith('blog/')) {
        await supabase.storage.from('gallery').remove([path])
      }
    }
  }

  const togglePublished = async (row: Row) => {
    const next = !row.published
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, published: next } : r)))
    const { error } = await supabase.from('posts').update({ published: next }).eq('id', row.id)
    if (error) {
      toast.error('Could not update.')
      load()
      return
    }
    // The first publish stamps published_at server-side; refetch so the list
    // shows the real date rather than a blank where the trigger just wrote one.
    if (next) load()
  }

  const filtersActive = search.trim() !== '' || status !== 'all'

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-line px-8 py-6">
        <div>
          <h1 className={pageTitle}>Blog</h1>
          <p className="mt-1 text-[13px] text-muted">
            {rows.length} post{rows.length === 1 ? '' : 's'} · new posts reach Google
            only after you publish to the live site
          </p>
        </div>
        <button onClick={() => { setDraft(blankPost()); setPreview(false) }} className={btnPrimary}>
          + New post
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ---- List rail ---------------------------------------------- */}
        <div className="flex w-[clamp(280px,26vw,400px)] shrink-0 flex-col border-r border-line">
          <FilterBar
            showing={visible.length}
            total={rows.length}
            active={filtersActive}
            onReset={() => {
              setSearch('')
              setStatus('all')
            }}
          >
            <SearchBox value={search} onChange={setSearch} placeholder="Search posts" />
            <FilterGroup label="Status" options={statusOptions} value={status} onChange={setStatus} />
          </FilterBar>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <p className="px-6 py-10 text-sm text-muted">Loading…</p>
            ) : visible.length === 0 ? (
              <p className="px-6 py-10 text-sm text-muted">
                {rows.length === 0 ? 'No posts yet. Write the first one.' : 'Nothing matches.'}
              </p>
            ) : (
              visible.map((row) => (
                <div
                  key={row.id}
                  className={`flex items-start justify-between gap-3 border-b border-line px-5 py-4 ${
                    draft?.id === row.id ? 'bg-panel' : ''
                  }`}
                >
                  <button
                    onClick={() => { setDraft({ ...row, faqs: row.faqs ?? [] }); setPreview(false) }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="truncate text-[14px] font-medium text-cream">{row.title}</div>
                    <div className="mt-0.5 truncate text-[12px] text-muted">
                      /blog/{row.slug}
                      {row.published_at ? ` · ${formatPostDate(row.published_at)}` : ''}
                    </div>
                  </button>
                  <button
                    onClick={() => togglePublished(row)}
                    title={row.published ? 'Unpublish' : 'Publish'}
                    className={`shrink-0 transition-colors ${pill} ${
                      row.published
                        ? 'border-brass/40 text-brass2 hover:bg-brass/10'
                        : 'border-line text-muted hover:text-cream'
                    }`}
                  >
                    {row.published ? 'Live' : 'Draft'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ---- Editor -------------------------------------------------- */}
        <div className="min-w-0 flex-1 overflow-y-auto">
          {!draft ? (
            <div className="grid h-full place-items-center text-sm text-muted">
              Select a post, or write a new one.
            </div>
          ) : (
            <div className="max-w-3xl px-8 py-7 2xl:px-10">
              <h2 className={sectionTitle}>{draft.id ? 'Edit post' : 'New post'}</h2>

              {/* ---- Basics ---- */}
              <div className="mt-6 space-y-5">
                <div>
                  <label className={label}>Title *</label>
                  <input
                    value={draft.title ?? ''}
                    onChange={(e) => {
                      const title = e.target.value
                      // Auto-slug only until the post exists: changing the slug
                      // of a published post breaks its URL and any links to it.
                      patch(
                        draft.id
                          ? { title }
                          : { title, slug: slugify(title) },
                      )
                    }}
                    className={field}
                  />
                </div>

                <div>
                  <label className={label}>URL slug *</label>
                  <input
                    value={draft.slug ?? ''}
                    onChange={(e) => patch({ slug: e.target.value })}
                    className={field}
                  />
                  <p className={hint}>
                    Lives at <span className="text-cream/80">/blog/{draft.slug || '…'}</span>.
                    {draft.id
                      ? ' Changing this breaks the old URL and any links pointing at it.'
                      : ' Generated from the title — edit it before saving if you want something shorter.'}
                  </p>
                </div>

                <div>
                  <label className={label}>Excerpt</label>
                  <textarea
                    rows={3}
                    value={draft.excerpt ?? ''}
                    onChange={(e) => patch({ excerpt: e.target.value })}
                    className={field}
                  />
                  <p className={hint}>
                    Shown on the blog index, and used as the search description when
                    the SEO description below is blank.
                  </p>
                </div>

                <div>
                  <label className={label}>Author</label>
                  {/* Width on the wrapper: `field` carries w-full, which Tailwind
                      emits after w-64 and would override. */}
                  <div className="w-64">
                    <input
                      value={draft.author ?? ''}
                      onChange={(e) => patch({ author: e.target.value })}
                      className={field}
                      placeholder="Optional"
                    />
                  </div>
                  <p className={hint}>Blank credits the venue itself.</p>
                </div>
              </div>

              {/* ---- Cover ---- */}
              <div className={`mt-8 p-5 ${card}`}>
                <h3 className={sectionTitle}>Cover image</h3>
                <div className="mt-4 space-y-4">
                  {draft.cover_image && (
                    <img
                      src={draft.cover_image}
                      alt=""
                      className="h-40 w-full rounded-md object-cover"
                    />
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    <button onClick={openPicker} className={btnGhost}>
                      Choose from gallery
                    </button>
                    <label className={`${btnGhost} cursor-pointer`}>
                      {uploading ? 'Uploading…' : 'Upload new'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) void uploadCover(file)
                          e.target.value = ''
                        }}
                      />
                    </label>
                    {draft.cover_image && (
                      <button
                        onClick={() => patch({ cover_image: '' })}
                        className={btnQuiet}
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  {picking && (
                    <div className="rounded-md border border-line bg-panel/40 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-[12px] font-medium text-cream">
                          Venue gallery
                        </span>
                        <button onClick={() => setPicking(false)} className={btnQuiet}>
                          Close
                        </button>
                      </div>

                      {gallery === null ? (
                        <p className="py-6 text-center text-[13px] text-muted">Loading…</p>
                      ) : gallery.length === 0 ? (
                        <p className="py-6 text-center text-[13px] text-muted">
                          No published photos in the gallery yet.
                        </p>
                      ) : (
                        <div className="grid max-h-[320px] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
                          {gallery.map((photo) => {
                            const chosen = draft.cover_image === photo.src
                            return (
                              <button
                                key={photo.src}
                                onClick={() => chooseFromGallery(photo)}
                                title={photo.label}
                                aria-label={`Use "${photo.label}" as the cover`}
                                aria-pressed={chosen}
                                className={`group relative aspect-[3/2] overflow-hidden rounded-[3px] border-2 transition-colors ${
                                  chosen ? 'border-brass' : 'border-transparent hover:border-line'
                                }`}
                              >
                                <img
                                  src={photo.src}
                                  alt=""
                                  loading="lazy"
                                  className="h-full w-full object-cover"
                                />
                                <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-transparent px-1.5 pb-1 pt-4 text-left text-[10px] text-white">
                                  {photo.label}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  <div>
                    <label className={label}>Alt text</label>
                    <input
                      value={draft.cover_alt ?? ''}
                      onChange={(e) => patch({ cover_alt: e.target.value })}
                      className={field}
                      placeholder="Describe the photo for screen readers and search"
                    />
                  </div>
                </div>
              </div>

              {/* ---- Body ---- */}
              <div className="mt-8">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className={label}>Body (Markdown)</span>
                  <button onClick={() => setPreview((p) => !p)} className={btnQuiet}>
                    {preview ? 'Edit' : 'Preview'}
                  </button>
                </div>
                {preview ? (
                  <div className={`min-h-[320px] p-6 ${card}`}>
                    {draft.body?.trim() ? (
                      <PostBody>{draft.body}</PostBody>
                    ) : (
                      <p className="text-sm text-muted">Nothing to preview yet.</p>
                    )}
                  </div>
                ) : (
                  <textarea
                    rows={20}
                    value={draft.body ?? ''}
                    onChange={(e) => patch({ body: e.target.value })}
                    className={`${field} font-mono text-[13px] leading-relaxed`}
                    placeholder={'## A section heading\n\nA paragraph of text.\n\n- A bullet\n- Another bullet\n\n[A link](/contact)'}
                  />
                )}
                <p className={hint}>
                  <strong className="font-medium text-cream/80">##</strong> makes a heading,
                  <strong className="font-medium text-cream/80"> **bold**</strong> bolds,
                  <strong className="font-medium text-cream/80"> -</strong> starts a bullet,
                  and <strong className="font-medium text-cream/80">[text](/contact)</strong> links.
                  Preview shows exactly what visitors see.
                </p>
              </div>

              {/* ---- SEO ---- */}
              <div className={`mt-8 p-5 ${card}`}>
                <h3 className={sectionTitle}>Search engine listing</h3>
                <p className={hint}>
                  What Google and ChatGPT show when they link to this post. Leave
                  blank to use the title and excerpt above.
                </p>
                <div className="mt-4 space-y-5">
                  <div>
                    <div className="flex items-baseline justify-between">
                      <label className={label}>SEO title</label>
                      <span className="text-[12px]">
                        <Counter value={String(draft.seo_title ?? '')} limit={TITLE_LIMIT} />
                      </span>
                    </div>
                    <input
                      value={draft.seo_title ?? ''}
                      onChange={(e) => patch({ seo_title: e.target.value })}
                      className={field}
                      placeholder={draft.title ? `${draft.title} | Infinity at Rio Ranch` : ''}
                    />
                  </div>
                  <div>
                    <div className="flex items-baseline justify-between">
                      <label className={label}>SEO description</label>
                      <span className="text-[12px]">
                        <Counter value={String(draft.seo_description ?? '')} limit={DESC_LIMIT} />
                      </span>
                    </div>
                    <textarea
                      rows={3}
                      value={draft.seo_description ?? ''}
                      onChange={(e) => patch({ seo_description: e.target.value })}
                      className={field}
                      placeholder={draft.excerpt || ''}
                    />
                  </div>
                </div>
              </div>

              {/* ---- FAQ ---- */}
              <div className={`mt-8 p-5 ${card}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className={sectionTitle}>Frequently asked questions</h3>
                    <p className={hint}>
                      Shown at the end of the post and submitted to Google as FAQ
                      structured data, which can win extra space in the results.
                    </p>
                  </div>
                  <button
                    onClick={() => setFaqs([...faqs, { q: '', a: '' }])}
                    aria-label="Add a question"
                    title="Add a question"
                    className={iconBtn}
                  >
                    <Plus size={15} />
                  </button>
                </div>

                {faqs.length === 0 ? (
                  <p className="mt-4 text-[13px] text-muted">No questions yet.</p>
                ) : (
                  <div className="mt-4 space-y-4">
                    {faqs.map((faq, i) => (
                      <div key={i} className="rounded-md border border-line p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-[11px] font-medium text-muted/70">
                            Question {i + 1}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => moveFaq(i, -1)}
                              disabled={i === 0}
                              aria-label="Move up"
                              title="Move up"
                              className={`${iconBtn} disabled:opacity-30`}
                            >
                              <CaretUp size={14} />
                            </button>
                            <button
                              onClick={() => moveFaq(i, 1)}
                              disabled={i === faqs.length - 1}
                              aria-label="Move down"
                              title="Move down"
                              className={`${iconBtn} disabled:opacity-30`}
                            >
                              <CaretDown size={14} />
                            </button>
                            <button
                              onClick={() => setFaqs(faqs.filter((_, n) => n !== i))}
                              aria-label="Remove this question"
                              title="Remove this question"
                              className={iconBtnDanger}
                            >
                              <Trash size={14} />
                            </button>
                          </div>
                        </div>
                        <input
                          value={faq.q}
                          onChange={(e) => updateFaq(i, { q: e.target.value })}
                          placeholder="Question"
                          className={`${field} mb-2`}
                        />
                        <textarea
                          rows={3}
                          value={faq.a}
                          onChange={(e) => updateFaq(i, { a: e.target.value })}
                          placeholder="Answer"
                          className={field}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ---- CTA ---- */}
              <div className={`mt-8 p-5 ${card}`}>
                <h3 className={sectionTitle}>Closing call to action</h3>
                <p className={hint}>
                  Every post ends with a tour prompt and the venue phone number.
                  Fill these in only to override the default wording.
                </p>
                <div className="mt-4 space-y-5">
                  <div>
                    <label className={label}>Heading</label>
                    <input
                      value={draft.cta_heading ?? ''}
                      onChange={(e) => patch({ cta_heading: e.target.value })}
                      className={field}
                      placeholder="Ready to see it in person?"
                    />
                  </div>
                  <div>
                    <label className={label}>Text</label>
                    <textarea
                      rows={3}
                      value={draft.cta_body ?? ''}
                      onChange={(e) => patch({ cta_body: e.target.value })}
                      className={field}
                      placeholder="The fastest way to know if a venue is right for your day is to walk it yourself…"
                    />
                  </div>
                </div>
              </div>

              {/* ---- Actions ---- */}
              <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-line pt-6">
                <button onClick={save} disabled={saving} className={btnPrimary}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <label className="flex items-center gap-2 text-[14px] text-cream">
                  <input
                    type="checkbox"
                    checked={!!draft.published}
                    onChange={(e) => patch({ published: e.target.checked })}
                    className="h-4 w-4 accent-[color:var(--brass)]"
                  />
                  Published
                </label>
                <button onClick={() => setDraft(null)} className={btnQuiet}>
                  Cancel
                </button>
                {draft.id && (
                  <button onClick={() => remove(draft)} className={`ml-auto ${btnDanger}`}>
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
