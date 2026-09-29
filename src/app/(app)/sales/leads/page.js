'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { DataTable } from '@/components/ui/DataTable'
import { CallButton } from '@/components/sales/CallButton'
import { LEAD_STATUSES, leadStatusLabel, leadStatusBadge } from '@/lib/sales-lead-status'

const FILTERS = [{ value: '', label: 'All' }, ...LEAD_STATUSES.map((s) => ({ value: s.value, label: s.label }))]
const fmtWhen = (v) => (v ? new Date(v).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : null)

/**
 * A sales person's leads, as a table. Call the customer (mobile only), then set
 * where the lead stands. Scoped by the API — an executive sees their own, a team
 * leader or manager sees the team's.
 */
export default function LeadsPage() {
  const [leads, setLeads] = useState([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.get('/sales/inquiries', { params: filter ? { status: filter } : {} })
      setLeads(res.data.data)
    } catch (e) {
      setError(getApiErrorMessage(e, 'Could not load leads'))
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    load()
  }, [load])

  const updateLead = useCallback(async (id, status, followUpAt) => {
    try {
      const res = await apiClient.patch(`/sales/inquiries/${id}`, { status, ...(followUpAt ? { followUpAt } : {}) })
      setLeads((prev) => prev.map((l) => (l.id === id ? res.data.data : l)))
    } catch (e) {
      setError(getApiErrorMessage(e, 'Could not update the lead'))
    }
  }, [])

  const columns = [
    { key: 'customer', header: 'Customer', render: (l) => <span className="font-medium text-ink">{l.customerName}</span> },
    { key: 'building', header: 'Building', render: (l) => l.building?.buildingName ?? '—' },
    {
      key: 'phone',
      header: 'Phone',
      render: (l) => (
        <span className="flex items-center gap-2">
          <span className="tabular-nums">{l.phone}</span>
          <CallButton phone={l.phone} />
        </span>
      ),
    },
    {
      key: 'followUp',
      header: 'Follow-up',
      render: (l) =>
        l.status === 'FOLLOW_UP' && l.followUpAt ? <span className="text-warn">{fmtWhen(l.followUpAt)}</span> : '—',
    },
    { key: 'status', header: 'Status', render: (l) => <StatusControl lead={l} onUpdate={updateLead} /> },
  ]

  const renderCard = (l) => (
    <div className="flex flex-col gap-2 rounded-card border border-line bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-ink">{l.customerName}</p>
          <p className="truncate text-sm font-normal text-muted">
            {l.building?.buildingName ? `${l.building.buildingName} · ` : ''}
            {l.phone}
          </p>
          {l.status === 'FOLLOW_UP' && l.followUpAt && (
            <p className="mt-0.5 text-sm font-medium text-warn">Follow up {fmtWhen(l.followUpAt)}</p>
          )}
        </div>
        <CallButton phone={l.phone} />
      </div>
      <StatusControl lead={l} onUpdate={updateLead} />
    </div>
  )

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Leads</h1>
        <p className="text-sm font-normal text-muted">Call a lead, then set where it stands.</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`h-9 rounded-btn px-3 text-sm font-medium transition-colors ${
              filter === f.value ? 'bg-fiber text-on-fiber' : 'border border-line text-muted hover:text-ink'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>}

      <DataTable
        columns={columns}
        rows={leads}
        loading={loading}
        renderCard={renderCard}
        emptyState={<p className="py-8 text-center text-sm font-normal text-muted">No leads yet.</p>}
      />
    </div>
  )
}

/**
 * The status control for one lead: a colour-tinted dropdown that shows and
 * changes the status. Choosing Follow-up reveals a date+time input; the lead
 * saves when a time is picked. Other statuses save on selection.
 */
function StatusControl({ lead, onUpdate }) {
  const [picking, setPicking] = useState(false)

  const onChange = (e) => {
    const value = e.target.value
    if (value === 'FOLLOW_UP') {
      setPicking(true) // wait for a date before saving
      return
    }
    setPicking(false)
    onUpdate(lead.id, value)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <select
        aria-label="Lead status"
        value={picking ? 'FOLLOW_UP' : lead.status}
        onChange={onChange}
        className={`h-8 rounded-btn border border-line px-2 text-sm font-medium ${leadStatusBadge(lead.status)}`}
      >
        {LEAD_STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      {picking && (
        <input
          type="datetime-local"
          aria-label="Follow-up date and time"
          className="h-8 rounded-btn border border-line bg-card px-2 text-sm"
          onChange={(e) => {
            if (e.target.value) {
              onUpdate(lead.id, 'FOLLOW_UP', new Date(e.target.value).toISOString())
              setPicking(false)
            }
          }}
        />
      )}
    </div>
  )
}
