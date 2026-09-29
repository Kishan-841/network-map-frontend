'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { CallButton } from '@/components/sales/CallButton'
import { LEAD_STATUSES, leadStatusLabel, leadStatusBadge } from '@/lib/sales-lead-status'

const FILTERS = [{ value: '', label: 'All' }, ...LEAD_STATUSES.map((s) => ({ value: s.value, label: s.label }))]
const fmtWhen = (v) => (v ? new Date(v).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : null)

/**
 * A sales person's leads. Call the customer (mobile only), then set where the
 * lead stands. Scoped by the API — an executive sees their own, a team leader
 * or manager sees the team's.
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

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 lg:p-6">
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

      {loading ? (
        <p className="text-sm font-normal text-muted">Loading…</p>
      ) : leads.length === 0 ? (
        <p className="text-sm font-normal text-muted">No leads yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onUpdate={updateLead} />
          ))}
        </div>
      )}
    </div>
  )
}

function LeadCard({ lead, onUpdate }) {
  const [followUp, setFollowUp] = useState('')
  const [picking, setPicking] = useState(false)

  const onStatusChange = (e) => {
    const value = e.target.value
    if (value === 'FOLLOW_UP') {
      setPicking(true) // reveal the date+time picker; save is a second step
      return
    }
    setPicking(false)
    onUpdate(lead.id, value)
  }

  return (
    <div className="rounded-card border border-line bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-ink">{lead.customerName}</p>
          <p className="truncate text-sm font-normal text-muted">
            {lead.building?.buildingName ? `${lead.building.buildingName} · ` : ''}
            {lead.phone}
          </p>
          {lead.status === 'FOLLOW_UP' && lead.followUpAt && (
            <p className="mt-1 text-sm font-medium text-warn">Follow up {fmtWhen(lead.followUpAt)}</p>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${leadStatusBadge(lead.status)}`}>
          {leadStatusLabel(lead.status)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <CallButton phone={lead.phone} />
        <Select
          id={`status-${lead.id}`}
          aria-label="Lead status"
          value={lead.status}
          onChange={onStatusChange}
          className="h-9 w-auto"
        >
          {LEAD_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>

      {picking && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <Input
            id={`followup-${lead.id}`}
            label="Follow up on"
            type="datetime-local"
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
          />
          <Button
            type="button"
            disabled={!followUp}
            onClick={() => {
              onUpdate(lead.id, 'FOLLOW_UP', new Date(followUp).toISOString())
              setPicking(false)
            }}
          >
            Save
          </Button>
        </div>
      )}
    </div>
  )
}
