import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, DownloadSimple, Trash } from '@phosphor-icons/react'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import {
  fillVendorAgreement,
  loadVendorTemplate,
  vendorAgreementFileName,
  type VendorAgreementValues,
} from '@/lib/vendor-agreement'
import { SERVICE_LABELS, SERVICE_TYPES, type ServiceType } from '@/lib/vendor-services'
import {
  btnGhost,
  btnPrimary,
  btnSmall,
  card,
  chip,
  field,
  hint,
  iconBtnDanger,
  label,
  pageTitle,
  sectionTitle,
} from '@/lib/admin-ui'
import { fmtDate, type VendorAgreement } from './vendor-shared'

const blank = (): VendorAgreement => ({
  id: '',
  business_name: '',
  contact_person: '',
  phone: '',
  email: '',
  client_event_name: '',
  service_types: [],
  // The agreement is nearly always written the day it is raised, so today is
  // the right guess; the event is not, so that one stays empty.
  agreement_date: new Date().toISOString().slice(0, 10),
  event_date: '',
  vendor_rep_name: '',
  venue_rep_name: '',
  notes: '',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
})

/** Empty strings become NULL; the columns are nullable, not ''-defaulted. */
const nullable = (v: string | null | undefined) => {
  const s = (v ?? '').trim()
  return s === '' ? null : s
}

/** The row as the PDF generator wants it. */
const toValues = (v: VendorAgreement): VendorAgreementValues => ({
  businessName: v.business_name,
  contactPerson: v.contact_person,
  phone: v.phone,
  email: v.email,
  clientEventName: v.client_event_name,
  serviceTypes: v.service_types,
  agreementDate: v.agreement_date,
  eventDate: v.event_date,
  vendorRepName: v.vendor_rep_name,
  venueRepName: v.venue_rep_name,
})

/**
 * One vendor agreement: the details on the left, the document they produce on
 * the right.
 *
 * The form is the whole page rather than a profile behind an Edit toggle, the
 * way a client is. A client row is read far more often than it is changed — you
 * open it to check a balance. A vendor agreement is opened to fill it in and
 * print it, and there is nothing else to do with one, so it stays editable.
 *
 * The preview is the real PDF, rebuilt in the browser as you type — not a
 * mock-up of it. A preview that only resembles what gets signed is worth
 * nothing as a check, which is the same reason the client invoice panel iframes
 * the actual invoice page.
 */
export const AdminVendorDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id

  const [draft, setDraft] = useState<VendorAgreement | null>(isNew ? blank() : null)
  const [saved, setSaved] = useState<VendorAgreement | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)

  // The blank template, fetched once per visit and reused for every keystroke.
  const template = useRef<Uint8Array | null>(null)
  const [templateMissing, setTemplateMissing] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const pdfBytes = useRef<Uint8Array | null>(null)
  const objectUrl = useRef<string | null>(null)

  useEffect(() => {
    if (isNew) return
    supabase
      .from('vendor_agreements')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) toast.error('Could not load that agreement.')
        else {
          setSaved(data as VendorAgreement)
          setDraft(data as VendorAgreement)
        }
        setLoading(false)
      })
  }, [id, isNew])

  const set = (patch: Partial<VendorAgreement>) =>
    setDraft((d) => (d ? { ...d, ...patch } : d))

  const toggleService = (s: ServiceType) =>
    setDraft((d) =>
      d
        ? {
            ...d,
            service_types: d.service_types.includes(s)
              ? d.service_types.filter((v) => v !== s)
              : [...d.service_types, s],
          }
        : d,
    )

  /* What the preview is built from, as a string. The rebuild watches this and
     not `draft` itself, so editing Notes — which is panel-only and never printed
     — doesn't rebuild the document. */
  const values = useMemo(() => (draft ? toValues(draft) : null), [draft])
  const valuesKey = values ? JSON.stringify(values) : ''
  const latest = useRef(values)
  latest.current = values

  const releaseUrl = useCallback(() => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
    objectUrl.current = null
  }, [])

  // Rebuild the document a beat after typing stops. One object URL is alive at
  // a time — an iframe holding a revoked one goes blank, so the old URL is only
  // dropped once the new document has replaced it.
  useEffect(() => {
    if (!valuesKey) return
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        if (!template.current) {
          const bytes = await loadVendorTemplate()
          if (!bytes) {
            if (!cancelled) setTemplateMissing(true)
            return
          }
          template.current = bytes
        }
        const current = latest.current
        if (!current) return
        const out = await fillVendorAgreement(template.current, current)
        if (cancelled) return
        pdfBytes.current = out
        const next = URL.createObjectURL(new Blob([out as BlobPart], { type: 'application/pdf' }))
        releaseUrl()
        objectUrl.current = next
        setPdfUrl(next)
      } catch {
        if (!cancelled) toast.error('Could not build the agreement PDF.')
      }
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [valuesKey, releaseUrl])

  // Only on unmount: revoking between rebuilds is handled above.
  useEffect(() => releaseUrl, [releaseUrl])

  const save = async () => {
    if (!draft) return
    if (!draft.business_name.trim()) {
      toast.error('Business name is required.')
      return
    }

    setSaving(true)
    const payload = {
      business_name: draft.business_name.trim(),
      contact_person: nullable(draft.contact_person),
      phone: nullable(draft.phone),
      email: nullable(draft.email),
      client_event_name: nullable(draft.client_event_name),
      service_types: draft.service_types,
      agreement_date: nullable(draft.agreement_date),
      event_date: nullable(draft.event_date),
      vendor_rep_name: nullable(draft.vendor_rep_name),
      venue_rep_name: nullable(draft.venue_rep_name),
      notes: nullable(draft.notes),
    }

    const write = draft.id
      ? supabase.from('vendor_agreements').update(payload).eq('id', draft.id).select().single()
      : supabase.from('vendor_agreements').insert(payload).select().single()

    const { data, error } = await write
    setSaving(false)
    if (error || !data) {
      toast.error('Could not save this agreement.')
      return
    }

    const row = data as VendorAgreement
    setSaved(row)
    setDraft(row)
    toast.success('Agreement saved.')
    // A new agreement now has a URL of its own — land on it, replacing /new so
    // Back doesn't reopen an empty form.
    if (!draft.id) navigate(`/admin/vendors/${row.id}`, { replace: true })
  }

  const remove = async () => {
    if (!saved) return
    if (!confirm('Delete this vendor agreement permanently?')) return
    const { error } = await supabase.from('vendor_agreements').delete().eq('id', saved.id)
    if (error) {
      toast.error('Could not delete this agreement.')
      return
    }
    toast.success('Agreement deleted.')
    navigate('/admin/vendors', { replace: true })
  }

  const download = () => {
    if (!pdfBytes.current || !draft) return
    const blob = new Blob([pdfBytes.current as BlobPart], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = vendorAgreementFileName(draft.business_name)
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-[13px] text-muted">Loading…</p>
      </div>
    )
  }
  if (!draft) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <p className="text-[13px] text-muted">That agreement no longer exists.</p>
        <button onClick={() => navigate('/admin/vendors')} className={btnGhost}>
          Back to vendors
        </button>
      </div>
    )
  }

  const dirty = !saved || JSON.stringify(saved) !== JSON.stringify(draft)

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-line px-8 py-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={() => navigate('/admin/vendors')}
            className={btnSmall}
            aria-label="Back to vendors"
          >
            <ArrowLeft size={16} weight="bold" />
          </button>
          <div className="min-w-0">
            <h1 className={`${pageTitle} truncate`}>
              {draft.business_name.trim() || (isNew ? 'New vendor agreement' : 'Vendor agreement')}
            </h1>
            <p className="mt-1 text-[13px] text-muted">
              {saved
                ? `Saved ${fmtDate(saved.updated_at.slice(0, 10)) ?? ''}`
                : 'Not saved yet — the document below is built from what you type.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <button onClick={remove} className={iconBtnDanger} aria-label="Delete agreement" title="Delete agreement">
              <Trash size={16} weight="bold" />
            </button>
          )}
          <button onClick={download} className={btnGhost} disabled={!pdfUrl}>
            <DownloadSimple size={16} weight="bold" className="mr-2" />
            Download PDF
          </button>
          <button onClick={save} className={btnPrimary} disabled={saving || !dirty}>
            {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto px-8 py-6 lg:grid-cols-[minmax(360px,460px)_1fr]">
        {/* ---- the details ---- */}
        <div className="space-y-6">
          <section className={`${card} p-5`}>
            <h2 className={sectionTitle}>Vendor</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className={label} htmlFor="business_name">
                  Business name
                </label>
                <input
                  id="business_name"
                  value={draft.business_name}
                  onChange={(e) => set({ business_name: e.target.value })}
                  className={field}
                  placeholder="Hill Country Catering Co."
                />
              </div>
              <div>
                <label className={label} htmlFor="contact_person">
                  Contact person
                </label>
                <input
                  id="contact_person"
                  value={draft.contact_person ?? ''}
                  onChange={(e) => set({ contact_person: e.target.value })}
                  className={field}
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className={label} htmlFor="phone">
                    Phone
                  </label>
                  <input
                    id="phone"
                    value={draft.phone ?? ''}
                    onChange={(e) => set({ phone: e.target.value })}
                    className={field}
                  />
                </div>
                <div className="flex-1">
                  <label className={label} htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={draft.email ?? ''}
                    onChange={(e) => set({ email: e.target.value })}
                    className={field}
                  />
                </div>
              </div>
              <div>
                <span className={label}>Service</span>
                <div className="flex flex-wrap gap-2">
                  {SERVICE_TYPES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleService(s)}
                      aria-pressed={draft.service_types.includes(s)}
                      className={chip(draft.service_types.includes(s))}
                    >
                      {SERVICE_LABELS[s]}
                    </button>
                  ))}
                </div>
                <p className={hint}>
                  Ticks the matching box on the form. The printed boxes read Food, Decoration, DJ
                  and Other — an event manager ticks Other and is named on the line beside it.
                </p>
              </div>
            </div>
          </section>

          <section className={`${card} p-5`}>
            <h2 className={sectionTitle}>Event</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className={label} htmlFor="client_event_name">
                  Client / event name
                </label>
                <input
                  id="client_event_name"
                  value={draft.client_event_name ?? ''}
                  onChange={(e) => set({ client_event_name: e.target.value })}
                  className={field}
                  placeholder="Raghunathan / Okonkwo Wedding"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className={label} htmlFor="event_date">
                    Event date
                  </label>
                  <input
                    id="event_date"
                    type="date"
                    value={draft.event_date ?? ''}
                    onChange={(e) => set({ event_date: e.target.value })}
                    className={field}
                  />
                </div>
                <div className="flex-1">
                  <label className={label} htmlFor="agreement_date">
                    Agreement date
                  </label>
                  <input
                    id="agreement_date"
                    type="date"
                    value={draft.agreement_date ?? ''}
                    onChange={(e) => set({ agreement_date: e.target.value })}
                    className={field}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className={`${card} p-5`}>
            <h2 className={sectionTitle}>Signatures</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className={label} htmlFor="vendor_rep_name">
                  Vendor representative
                </label>
                <input
                  id="vendor_rep_name"
                  value={draft.vendor_rep_name ?? ''}
                  onChange={(e) => set({ vendor_rep_name: e.target.value })}
                  className={field}
                />
              </div>
              <div>
                <label className={label} htmlFor="venue_rep_name">
                  Venue representative
                </label>
                <input
                  id="venue_rep_name"
                  value={draft.venue_rep_name ?? ''}
                  onChange={(e) => set({ venue_rep_name: e.target.value })}
                  className={field}
                />
              </div>
              <p className={hint}>
                Both signature and date lines are left blank on purpose — they are signed by hand,
                the same way the client rental agreement is.
              </p>
            </div>
          </section>

          <section className={`${card} p-5`}>
            <h2 className={sectionTitle}>Notes</h2>
            <p className={hint}>Kept in the panel only. Nothing here is printed on the agreement.</p>
            <textarea
              rows={4}
              value={draft.notes ?? ''}
              onChange={(e) => set({ notes: e.target.value })}
              className={`${field} mt-3`}
            />
          </section>
        </div>

        {/* ---- the document itself ---- */}
        <section className={`${card} flex min-h-[600px] flex-col overflow-hidden lg:sticky lg:top-0 lg:h-[calc(100vh-8rem)]`}>
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
            <h2 className={sectionTitle}>Agreement</h2>
            <span className="text-[12px] text-muted">
              {templateMissing ? 'No template uploaded' : pdfUrl ? 'Live preview' : 'Building…'}
            </span>
          </div>
          {templateMissing ? (
            <div className="flex flex-1 items-center justify-center px-8 text-center">
              <p className="max-w-sm text-[13px] leading-relaxed text-muted">
                No vendor agreement template found. Upload the blank document to Storage →
                <span className="text-cream"> documents</span> as
                <span className="text-cream"> vendor-agreement-template.pdf</span>, then reload this
                page.
              </p>
            </div>
          ) : pdfUrl ? (
            /* The viewer parameters strip Chrome's own PDF chrome — toolbar,
               thumbnail rail, zoom — so the pane shows the document and nothing
               else. Downloading and printing are the header's job, and a second
               set of controls inside the preview only invited the question of
               which one was the real document. Firefox ignores these and draws
               its own toolbar; nothing breaks, it just looks like Firefox. */
            <iframe
              src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
              title="Vendor agreement preview"
              className="min-h-0 flex-1 border-0 bg-panel2"
            />
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-[13px] text-muted">Building the document…</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
