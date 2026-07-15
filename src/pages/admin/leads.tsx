import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'

type LeadStatus = 'new' | 'read' | 'replied' | 'archived'

type Lead = {
  id: string
  name: string
  email: string
  phone: string | null
  event_date: string | null
  type: string
  message: string | null
  status: LeadStatus
  created_at: string
}

const STATUSES: LeadStatus[] = ['new', 'read', 'replied', 'archived']

const statusClass: Record<LeadStatus, string> = {
  new: 'bg-brass/15 text-brass2 border-brass/40',
  read: 'bg-cream/5 text-cream/70 border-line',
  replied: 'bg-[#6a9a7a]/15 text-[#8fc0a0] border-[#6a9a7a]/40',
  archived: 'bg-transparent text-muted/60 border-line',
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

export const LeadsPage = () => {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | LeadStatus>('all')

  useEffect(() => {
    supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error('Could not load leads.')
        else setLeads((data ?? []) as Lead[])
        setLoading(false)
      })
  }, [])

  const visible = useMemo(
    () => (filter === 'all' ? leads : leads.filter((l) => l.status === filter)),
    [leads, filter],
  )
  const selected = leads.find((l) => l.id === selectedId) ?? null

  const patchStatus = async (id: string, status: LeadStatus) => {
    // Optimistic — the list reflects the change immediately.
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)))
    const { error } = await supabase.from('leads').update({ status }).eq('id', id)
    if (error) toast.error('Could not update status.')
  }

  const openLead = (lead: Lead) => {
    setSelectedId(lead.id)
    if (lead.status === 'new') void patchStatus(lead.id, 'read')
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this lead permanently?')) return
    setLeads((prev) => prev.filter((l) => l.id !== id))
    setSelectedId(null)
    const { error } = await supabase.from('leads').delete().eq('id', id)
    if (error) toast.error('Could not delete lead.')
  }

  const newCount = leads.filter((l) => l.status === 'new').length

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-line px-8 py-6">
        <div>
          <h1 className="font-serif text-2xl text-cream">Leads</h1>
          <p className="mt-1 text-[12px] text-muted">
            {leads.length} total{newCount > 0 && ` · ${newCount} new`}
          </p>
        </div>
        <div className="flex gap-1">
          {(['all', ...STATUSES] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-[2px] px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] transition-colors ${
                filter === s ? 'bg-brass/15 text-brass2' : 'text-muted hover:text-cream'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* List */}
        <div className="w-[380px] shrink-0 overflow-y-auto border-r border-line">
          {loading ? (
            <p className="px-8 py-10 text-sm text-muted">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="px-8 py-10 text-sm text-muted">No leads here yet.</p>
          ) : (
            visible.map((lead) => (
              <button
                key={lead.id}
                onClick={() => openLead(lead)}
                className={`block w-full border-b border-line px-6 py-4 text-left transition-colors hover:bg-panel ${
                  selectedId === lead.id ? 'bg-panel' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[14px] text-cream">{lead.name}</span>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] ${statusClass[lead.status]}`}
                  >
                    {lead.status}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-muted">
                  <span className="truncate">{lead.type}</span>
                  <span className="shrink-0">{fmtDate(lead.created_at)}</span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Detail */}
        <div className="min-w-0 flex-1 overflow-y-auto">
          {!selected ? (
            <div className="grid h-full place-items-center text-sm text-muted">
              Select a lead to read it.
            </div>
          ) : (
            <div className="max-w-2xl px-10 py-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-serif text-2xl text-cream">{selected.name}</h2>
                  <p className="mt-1 text-[12px] text-muted">
                    {selected.type} · submitted {fmtDate(selected.created_at)}
                  </p>
                </div>
                <button
                  onClick={() => remove(selected.id)}
                  className="text-[11px] uppercase tracking-[0.16em] text-muted hover:text-[#d98a6a]"
                >
                  Delete
                </button>
              </div>

              <dl className="mt-8 grid grid-cols-[110px_1fr] gap-y-3 text-sm">
                <dt className="text-[11px] uppercase tracking-[0.18em] text-muted">Email</dt>
                <dd>
                  <a href={`mailto:${selected.email}`} className="text-brass2 hover:text-brass">
                    {selected.email}
                  </a>
                </dd>
                <dt className="text-[11px] uppercase tracking-[0.18em] text-muted">Phone</dt>
                <dd className="text-cream">{selected.phone || '—'}</dd>
                <dt className="text-[11px] uppercase tracking-[0.18em] text-muted">Event date</dt>
                <dd className="text-cream">{selected.event_date || '—'}</dd>
              </dl>

              <div className="mt-8">
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted">Message</div>
                <p className="mt-2 whitespace-pre-wrap text-[15px] leading-[1.7] text-cream/90">
                  {selected.message || 'No message provided.'}
                </p>
              </div>

              <div className="mt-10 flex items-center gap-3 border-t border-line pt-6">
                <span className="text-[11px] uppercase tracking-[0.18em] text-muted">Status</span>
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => patchStatus(selected.id, s)}
                    className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.1em] transition-colors ${
                      selected.status === s
                        ? statusClass[s]
                        : 'border-line text-muted hover:text-cream'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
