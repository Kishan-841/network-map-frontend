'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { DataTable } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { CallButton } from '@/components/sales/CallButton'
import { EditLeadModal } from '@/components/sales/EditLeadModal'
import { LEAD_STATUSES, leadStatusLabel, leadStatusBadge } from '@/lib/sales-lead-status'

const FILTERS = [{ value: '', label: 'All' }, ...LEAD_STATUSES.map((s) => ({ value: s.value, label: s.label }))]
const fmtWhen = (v) => (v ? new Date(v).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : null)

const StatusBadge = ({ status }) => (
  <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${leadStatusBadge(status)}`}>
    {leadStatusLabel(status)}
  </span>
)

/**
 * A sales person's leads, as a table. Call the customer (mobile only), then use
 * Edit to set where the lead stands — status is never changed inline. Scoped by
 * the API: an executive sees their own, a team leader or manager the team's.
 */
export default function LeadsPage() {
  const [leads, setLeads] = useState([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null)

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

  const onSaved = (updated) => {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
    setEditing(null)
  }

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
    { key: 'status', header: 'Status', render: (l) => <StatusBadge status={l.status} /> },
    {
      key: 'edit',
      header: '',
      className: 'text-right',
      render: (l) => (
        <Button variant="secondary" className="h-8 min-h-8 px-3" onClick={() => setEditing(l)}>
          Edit
        </Button>
      ),
    },
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
        <StatusBadge status={l.status} />
      </div>
      <div className="flex items-center gap-2">
        <CallButton phone={l.phone} />
        <Button variant="secondary" className="h-8 min-h-8 px-3" onClick={() => setEditing(l)}>
          Edit
        </Button>
      </div>
    </div>
  )

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Leads</h1>
        <p className="text-sm font-normal text-muted">Call a lead, then Edit to set where it stands.</p>
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

      {editing && <EditLeadModal lead={editing} onClose={() => setEditing(null)} onSaved={onSaved} />}
    </div>
  )
}
