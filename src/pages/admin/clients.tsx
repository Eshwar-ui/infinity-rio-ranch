import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { supabase } from '@/lib/supabase'
import { money } from '@/lib/invoice'
import { useList } from '@/hooks/use-site-content'

type ClientStatus = 'booked' | 'completed' | 'cancelled'

type Client = {
  id: string
  lead_id: string | null
  name: string
  email: string | null
  phone: string | null
  event_date: string | null
  event_type: string | null
  guest_count: number | null
  package: string | null
  amount: number | null
  status: ClientStatus
  notes: string | null
  created_at: string
}

const STATUSES: ClientStatus[] = ['booked', 'completed', 'cancelled']

const statusClass: Record<ClientStatus, string> = {
  booked: 'bg-brass/15 text-brass2 border-brass/40',
  completed: 'bg-[#6a9a7a]/15 text-[#8fc0a0] border-[#6a9a7a]/40',
  cancelled: 'bg-transparent text-muted/60 border-line',
}

const field =
  'w-full rounded-[1px] border border-line bg-transparent px-[12px] py-2 text-sm text-cream outline-none transition-colors focus:border-brass'
const label = 'mb-1 block text-[10px] uppercase tracking-[0.18em] text-muted'

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

/** `event_date` is a bare date — parsing it without a time zone shifts it a day. */
const fmtEventDate = (d: string | null) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

const blank = (): Client => ({
  id: '',
  lead_id: null,
  name: '',
  email: '',
  phone: '',
  event_date: '',
  event_type: '',
  guest_count: null,
  package: '',
  amount: null,
  status: 'booked',
  notes: '',
  created_at: new Date().toISOString(),
})

/** Empty strings become NULL; the columns are nullable, not ''-defaulted. */
const nullable = (v: string | null | undefined) => {
  const s = (v ?? '').trim()
  return s === '' ? null : s
}

export const AdminClients = () => {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Client | null>(null)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'all' | ClientStatus>('all')
  const eventTypes = useList('event_types')
  // Set by the Leads page right after a conversion, so the new client opens
  // already selected instead of the admin having to hunt for it in the list.
  const [params, setParams] = useSearchParams()
  const focusId = params.get('id')

  useEffect(() => {
    supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          toast.error('Could not load clients.')
          setLoading(false)
          return
        }
        const rows = (data ?? []) as Client[]
        setClients(rows)
        setLoading(false)
        if (focusId) {
          const match = rows.find((c) => c.id === focusId)
          if (match) {
            setSelectedId(match.id)
            setDraft({ ...match })
          }
          setParams({}, { replace: true })
        }
      })
    // Runs once: the param is consumed and cleared on the first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const visible = useMemo(
    () => (filter === 'all' ? clients : clients.filter((c) => c.status === filter)),
    [clients, filter],
  )

  const select = (client: Client) => {
    setSelectedId(client.id)
    setDraft({ ...client })
  }

  const startNew = () => {
    setSelectedId(null)
    setDraft(blank())
  }

  const set = (patch: Partial<Client>) => setDraft((d) => (d ? { ...d, ...patch } : d))

  const save = async () => {
    if (!draft) return
    if (!draft.name.trim()) return toast.error('Name is required.')

    setSaving(true)
    const payload = {
      name: draft.name.trim(),
      email: nullable(draft.email),
      phone: nullable(draft.phone),
      event_date: nullable(draft.event_date),
      event_type: nullable(draft.event_type),
      guest_count: draft.guest_count ?? null,
      package: nullable(draft.package),
      amount: draft.amount ?? null,
      status: draft.status,
      notes: nullable(draft.notes),
    }

    const query = draft.id
      ? supabase.from('clients').update(payload).eq('id', draft.id).select().single()
      : supabase.from('clients').insert(payload).select().single()

    const { data, error } = await query
    setSaving(false)
    if (error || !data) {
      toast.error('Could not save this client.')
      return
    }

    const saved = data as Client
    setClients((prev) =>
      draft.id ? prev.map((c) => (c.id === saved.id ? saved : c)) : [saved, ...prev],
    )
    setSelectedId(saved.id)
    setDraft({ ...saved })
    toast.success('Client saved.')
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this client permanently?')) return
    setClients((prev) => prev.filter((c) => c.id !== id))
    setSelectedId(null)
    setDraft(null)
    const { error } = await supabase.from('clients').delete().eq('id', id)
    if (error) toast.error('Could not delete this client.')
  }

  const bookedCount = clients.filter((c) => c.status === 'booked').length

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-line px-8 py-6">
        <div>
          <h1 className="font-serif text-2xl text-cream">Clients</h1>
          <p className="mt-1 text-[12px] text-muted">
            {clients.length} total{bookedCount > 0 && ` · ${bookedCount} booked`}
          </p>
        </div>
        <div className="flex items-center gap-3">
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
          <button
            onClick={startNew}
            className="bg-brass px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-onbrass transition-colors hover:bg-brass2"
          >
            + New client
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* List */}
        <div className="w-[380px] shrink-0 overflow-y-auto border-r border-line">
          {loading ? (
            <p className="px-8 py-10 text-sm text-muted">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="px-8 py-10 text-sm text-muted">
              No clients here yet. Convert a lead, or add one by hand.
            </p>
          ) : (
            visible.map((client) => (
              <button
                key={client.id}
                onClick={() => select(client)}
                className={`block w-full border-b border-line px-6 py-4 text-left transition-colors hover:bg-panel ${
                  selectedId === client.id ? 'bg-panel' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[14px] text-cream">{client.name}</span>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] ${statusClass[client.status]}`}
                  >
                    {client.status}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-muted">
                  <span className="truncate">{client.event_type || 'Event'}</span>
                  <span className="shrink-0">{fmtEventDate(client.event_date)}</span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Detail / editor */}
        <div className="min-w-0 flex-1 overflow-y-auto">
          {!draft ? (
            <div className="grid h-full place-items-center text-sm text-muted">
              Select a client, or add a new one.
            </div>
          ) : (
            <div className="max-w-2xl px-10 py-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-serif text-2xl text-cream">
                    {draft.id ? draft.name : 'New client'}
                  </h2>
                  <p className="mt-1 text-[12px] text-muted">
                    {draft.id ? `Added ${fmtDate(draft.created_at)}` : 'Not saved yet'}
                    {draft.lead_id && ' · converted from a lead'}
                    {draft.amount != null && ` · ${money(Number(draft.amount))}`}
                  </p>
                </div>
                {draft.id && (
                  <button
                    onClick={() => remove(draft.id)}
                    className="text-[11px] uppercase tracking-[0.16em] text-muted hover:text-[#d98a6a]"
                  >
                    Delete
                  </button>
                )}
              </div>

              <div className="mt-8 space-y-5">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className={label}>Name *</label>
                    <input
                      value={draft.name}
                      onChange={(e) => set({ name: e.target.value })}
                      className={field}
                    />
                  </div>
                  <div className="flex-1">
                    <label className={label}>Email</label>
                    <input
                      value={draft.email ?? ''}
                      onChange={(e) => set({ email: e.target.value })}
                      className={field}
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className={label}>Phone</label>
                    <input
                      value={draft.phone ?? ''}
                      onChange={(e) => set({ phone: e.target.value })}
                      className={field}
                    />
                  </div>
                  <div className="flex-1">
                    <label className={label}>Event date</label>
                    <input
                      type="date"
                      value={draft.event_date ?? ''}
                      onChange={(e) => set({ event_date: e.target.value })}
                      className={field}
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className={label}>Event type</label>
                    {/* A datalist, not a select: the list is CMS-editable and old
                        clients keep types that were since renamed or removed. */}
                    <input
                      list="client-event-types"
                      value={draft.event_type ?? ''}
                      onChange={(e) => set({ event_type: e.target.value })}
                      className={field}
                    />
                    <datalist id="client-event-types">
                      {eventTypes.map((t) => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                  </div>
                  <div className="w-32">
                    <label className={label}>Guests</label>
                    <input
                      type="number"
                      min={0}
                      value={draft.guest_count ?? ''}
                      onChange={(e) =>
                        set({ guest_count: e.target.value === '' ? null : Number(e.target.value) })
                      }
                      className={field}
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className={label}>Package</label>
                    <input
                      value={draft.package ?? ''}
                      onChange={(e) => set({ package: e.target.value })}
                      className={field}
                    />
                  </div>
                  <div className="w-40">
                    <label className={label}>Agreed amount</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={draft.amount ?? ''}
                      onChange={(e) =>
                        set({ amount: e.target.value === '' ? null : Number(e.target.value) })
                      }
                      className={field}
                    />
                  </div>
                </div>

                <div>
                  <label className={label}>Notes</label>
                  <textarea
                    rows={5}
                    value={draft.notes ?? ''}
                    onChange={(e) => set({ notes: e.target.value })}
                    className={field}
                  />
                </div>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-line pt-6">
                <span className="text-[11px] uppercase tracking-[0.18em] text-muted">Status</span>
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => set({ status: s })}
                    className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.1em] transition-colors ${
                      draft.status === s ? statusClass[s] : 'border-line text-muted hover:text-cream'
                    }`}
                  >
                    {s}
                  </button>
                ))}
                <button
                  onClick={save}
                  disabled={saving}
                  className="ml-auto bg-brass px-5 py-2 text-[11px] uppercase tracking-[0.18em] text-onbrass hover:bg-brass2 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
