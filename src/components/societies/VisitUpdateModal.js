'use client'

import { useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Select, Textarea } from '@/components/ui/Input'
import { PERMISSION_STATUS_OPTIONS } from '@/lib/society'

/**
 * Record one visit to a society: what happened (required) and, if it moved,
 * the new permission status. The status starts on the current one, so a
 * visit that changed nothing is just a remark. Backdrop clicks don't close
 * it — a stray tap must not lose a typed remark.
 */
export function VisitUpdateModal({ buildingId, currentStatus, onClose, onSaved }) {
  const [remark, setRemark] = useState('')
  const [status, setStatus] = useState(currentStatus ?? '')
  const [attempted, setAttempted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const remarkError = attempted && !remark.trim() ? 'Say what happened on this visit' : null

  async function save() {
    if (!remark.trim()) {
      setAttempted(true)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const body = { remark: remark.trim() }
      if (status) body.permissionStatus = status
      const res = await apiClient.post(`/permission-buildings/${buildingId}/visits`, body)
      onSaved(res.data.data)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save the visit update'))
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissable={false}
      title="Add visit update"
      footer={
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1" disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={save} loading={busy} className="flex-1">
            Save update
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Textarea
          id="visit-remark"
          label="What happened on this visit?"
          rows={4}
          maxLength={1000}
          value={remark}
          error={remarkError}
          onChange={(e) => setRemark(e.target.value)}
          placeholder="e.g. Met the secretary — committee meets on Sunday, call back Monday"
        />
        <Select id="visit-status" label="Permission status" value={status} onChange={(e) => setStatus(e.target.value)}>
          {!currentStatus && <option value="">No status yet</option>}
          {PERMISSION_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        {error && <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>}
      </div>
    </Modal>
  )
}
