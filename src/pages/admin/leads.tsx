import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import { btnDanger, btnGhost, btnPrimary, pageTitle, pill } from '@/lib/admin-ui'
import { FilterBar, FilterGroup, SearchBox } from '@/components/admin/list-filters'

type LeadStatus = 'new' | 'read' | 'replied' | 'converted' | 'archived'

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

/**
 * Statuses an admin sets by hand. 'converted' is deliberately not here — it is
 * owned by convert_lead_to_client(), and setting it manually would claim a
 * client record that doesn't exist.
 */
const STATUSES: LeadStatus[] = ['new', 'read', 'replied', 'archived']
const FILTERS: LeadStatus[] = ['new', 'read', 'replied', 'converted', 'archived']

const statusClass: Record<LeadStatus, string> = {
  new: 'bg-brass/15 text-brass2 border-brass/40',
  read: 'bg-cream/5 text-cream/70 border-line',
  replied: 'bg-[#6a9a7a]/15 text-[#8fc0a0] border-[#6a9a7a]/40',
  converted: 'bg-brass/25 text-brass2 border-brass',
  archived: 'bg-transparent text-muted/60 border-line',
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

export const LeadsPage = () => {
  const navigate = useNavigate()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | LeadStatus>('all')
  const [query, setQuery] = useState('')
  const [converting, setConverting] = useState(false)

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

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return leads.filter(
      (l) =>
        (filter === 'all' || l.status === filter) &&
        (q === '' ||
          [l.name, l.email, l.phone, l.type, l.message].some((v) =>
            (v ?? '').toLowerCase().includes(q),
          )),
    )
  }, [leads, filter, query])

  /* Counts ignore the status filter (otherwise every unselected chip reads 0)
     but respect the search, so they always describe reachable rows. */
  const countFor = useMemo(() => {
    const q = query.trim().toLowerCase()
    const searched = leads.filter(
      (l) =>
        q === '' ||
        [l.name, l.email, l.phone, l.type, l.message].some((v) =>
          (v ?? '').toLowerCase().includes(q),
        ),
    )
    return (v: 'all' | LeadStatus) =>
      v === 'all' ? searched.length : searched.filter((l) => l.status === v).length
  }, [leads, query])

  const filtersActive = filter !== 'all' || query.trim() !== ''
  const resetFilters = () => {
    setFilter('all')
    setQuery('')
  }
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

  /**
   * One RPC, not "insert a client then update the lead" — the function runs both
   * in a single transaction, so a failure can't leave a lead marked converted
   * with nothing on the clients side. Re-running it on an already-converted lead
   * returns the existing client rather than creating a second one.
   */
  const convert = async (lead: Lead) => {
    if (!confirm(`Convert ${lead.name} into a client?`)) return
    setConverting(true)
    const { data, error } = await supabase.rpc('convert_lead_to_client', {
      p_lead_id: lead.id,
    })
    setConverting(false)
    if (error) {
      toast.error('Could not convert this lead.')
      return
    }
    setLeads((prev) =>
      prev.map((l) => (l.id === lead.id ? { ...l, status: 'converted' } : l)),
    )
    toast.success('Lead converted to a client.')
    navigate(`/admin/clients?id=${data}`)
  }

  const newCount = leads.filter((l) => l.status === 'new').length

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-line px-8 py-6">
        <div>
          <h1 className={pageTitle}>Leads</h1>
          <p className="mt-1 text-[13px] text-muted">
            {newCount > 0 ? `${newCount} new to read` : 'Nothing new to read'}
          </p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* List */}
        <div className="flex w-[clamp(280px,24vw,360px)] shrink-0 flex-col border-r border-line">
          <FilterBar
            showing={visible.length}
            total={leads.length}
            active={filtersActive}
            onReset={resetFilters}
          >
            <SearchBox value={query} onChange={setQuery} placeholder="Search leads" />
            <FilterGroup
              label="Status"
              value={filter}
              onChange={setFilter}
              options={(['all', ...FILTERS] as const).map((v) => ({
                value: v,
                label: v,
                count: countFor(v),
              }))}
            />
          </FilterBar>

          <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <p className="px-5 py-8 text-[13px] text-muted">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="px-5 py-8 text-[13px] text-muted">
              {filtersActive ? 'Nothing matches those filters.' : 'No leads here yet.'}
            </p>
          ) : (
            visible.map((lead) => (
              <button
                key={lead.id}
                onClick={() => openLead(lead)}
                className={`block w-full border-b border-line px-4 py-3 text-left transition-colors hover:bg-panel ${
                  selectedId === lead.id ? 'bg-panel' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[14px] font-medium text-cream">{lead.name}</span>
                  <span className={`shrink-0 ${pill} ${statusClass[lead.status]}`}>
                    {lead.status}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[12px] text-muted">
                  <span className="truncate">{lead.type}</span>
                  <span className="shrink-0">{fmtDate(lead.created_at)}</span>
                </div>
              </button>
            ))
          )}
          </div>
        </div>

        {/* Detail */}
        <div className="min-w-0 flex-1 overflow-y-auto">
          {!selected ? (
            <div className="grid h-full place-items-center text-sm text-muted">
              Select a lead to read it.
            </div>
          ) : (
            <div className="max-w-5xl px-8 py-7 2xl:px-10">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-cream">
                    {selected.name}
                  </h2>
                  <p className="mt-1 text-[13px] text-muted">
                    {selected.type} · submitted {fmtDate(selected.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  {selected.status === 'converted' ? (
                    <button
                      onClick={() => navigate('/admin/clients')}
                      className={btnGhost}
                    >
                      View in Clients
                    </button>
                  ) : (
                    <button
                      onClick={() => convert(selected)}
                      disabled={converting}
                      className={btnPrimary}
                    >
                      {converting ? 'Converting…' : 'Convert to client'}
                    </button>
                  )}
                  <button
                    onClick={() => remove(selected.id)}
                    className={btnDanger}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <dl className="mt-7 grid grid-cols-[110px_minmax(0,1fr)] gap-y-3 text-[14px] lg:grid-cols-[110px_minmax(0,1fr)_110px_minmax(0,1fr)] lg:gap-x-6">
                <dt className="text-[13px] font-medium text-muted">Email</dt>
                <dd>
                  <a href={`mailto:${selected.email}`} className="text-brass2 hover:text-brass">
                    {selected.email}
                  </a>
                </dd>
                <dt className="text-[13px] font-medium text-muted">Phone</dt>
                <dd className="text-cream">{selected.phone || '—'}</dd>
                <dt className="text-[13px] font-medium text-muted">Event date</dt>
                <dd className="text-cream">{selected.event_date || '—'}</dd>
              </dl>

              <div className="mt-8">
                <div className="text-[13px] font-medium text-muted">Message</div>
                <p className="mt-2 whitespace-pre-wrap text-[15px] leading-[1.7] text-cream/90">
                  {selected.message || 'No message provided.'}
                </p>
              </div>

              <div className="mt-10 flex items-center gap-3 border-t border-line pt-6">
                <span className="text-[13px] font-medium text-muted">Status</span>
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => patchStatus(selected.id, s)}
                    className={`${pill} transition-colors ${
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
