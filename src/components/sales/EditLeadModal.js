'use client'

import { useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { LEAD_STATUSES } from '@/lib/sales-lead-status'

// An ISO instant → the value a <input type="datetime-local"> expects (local tz).
const toLocalInput = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

/**
 * Update one lead's status after calling the customer. Status is changed here,
 * behind an explicit Save — never inline in the table. Choosing Follow-up asks
 * for a date+time; any other status clears it (the server does too).
 */
export function EditLeadModal({ lead, onClose, onSaved }) {
  const [status, setStatus] = useState(lead.status)
  const [followUpAt, setFollowUpAt] = useState(toLocalInput(lead.followUpAt))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const needsFollowUp = status === 'FOLLOW_UP'
  const valid = !needsFollowUp || Boolean(followUpAt)

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const res = await apiClient.patch(`/sales/inquiries/${lead.id}`, {
        status,
        ...(needsFollowUp ? { followUpAt: new Date(followUpAt).toISOString() } : {}),
      })
      onSaved(res.data.data)
    } catch (e) {
      setError(getApiErrorMessage(e, 'Could not update the lead'))
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title="Update lead"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button className="flex-1" loading={busy} disabled={!valid || busy} onClick={save}>
            Save
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="rounded-btn bg-paper px-4 py-3">
          <p className="text-sm font-medium text-ink">{lead.customerName}</p>
          <p className="text-sm font-normal text-muted">
            {lead.building?.buildingName ? `${lead.building.buildingName} · ` : ''}
            {lead.phone}
          </p>
        </div>
        <Select id="edit-status" label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          {LEAD_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
        {needsFollowUp && (
          <Input
            id="edit-followup"
            label="Follow up on"
            type="datetime-local"
            value={followUpAt}
            onChange={(e) => setFollowUpAt(e.target.value)}
            required
          />
        )}
        {error && <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>}
      </div>
    </Modal>
  )
}
