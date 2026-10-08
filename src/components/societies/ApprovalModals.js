'use client'

import { useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { useZones } from '@/hooks/useZones'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { ZoneSearchSelect } from '@/components/buildings/ZoneSearchSelect'

function Footer({ onClose, onConfirm, busy, label, variant }) {
  return (
    <div className="flex gap-2">
      <Button type="button" variant="secondary" onClick={onClose} className="flex-1" disabled={busy}>
        Cancel
      </Button>
      <Button type="button" variant={variant} onClick={onConfirm} loading={busy} className="flex-1">
        {label}
      </Button>
    </div>
  )
}

const ErrorLine = ({ error }) =>
  error ? <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p> : null

/**
 * Approve a society in one step: the zone it belongs to (required — starts on
 * the zone the executive picked, if any) and an optional note. It then shows
 * up everywhere like any building. A typed searchable zone picker rather than
 * a <select>: a focused select changes value on a stray scroll.
 */
export function ApproveModal({ buildingId, buildingName, zoneId: initialZoneId, onClose, onDone }) {
  const { zones, loading } = useZones()
  const [zoneId, setZoneId] = useState(initialZoneId ?? '')
  const [note, setNote] = useState('')
  const [attempted, setAttempted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function approve() {
    if (!zoneId) {
      setAttempted(true)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const body = { zoneId }
      if (note.trim()) body.note = note.trim()
      await apiClient.post(`/permission-buildings/${buildingId}/approve`, body)
      onDone('Society approved')
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not approve this society'))
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissable={false}
      title="Approve society"
      footer={<Footer onClose={onClose} onConfirm={approve} busy={busy} label="Approve" />}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm font-normal text-muted">
          <span className="font-medium text-ink">{buildingName}</span> will appear in Buildings, on the map and for
          sales like any building, and the executive can no longer change it.
        </p>
        <ZoneSearchSelect
          id="approve-zone"
          zones={zones ?? []}
          value={zoneId}
          onChange={setZoneId}
          disabled={loading && !zones}
          error={attempted && !zoneId ? 'Pick a zone' : null}
        />
        <Textarea
          id="approve-note"
          label="Note (optional)"
          rows={3}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Letter checked — signed by the chairman"
        />
        <ErrorLine error={error} />
      </div>
    </Modal>
  )
}

/** Send a society back to its executive with the reason they must fix. */
export function RejectModal({ buildingId, buildingName, onClose, onDone }) {
  const [reason, setReason] = useState('')
  const [attempted, setAttempted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function reject() {
    if (!reason.trim()) {
      setAttempted(true)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await apiClient.post(`/permission-buildings/${buildingId}/reject`, { reason: reason.trim() })
      onDone('Society rejected — the executive will see your reason')
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not reject this society'))
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissable={false}
      title="Reject society"
      footer={<Footer onClose={onClose} onConfirm={reject} busy={busy} label="Reject" variant="danger" />}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm font-normal text-muted">
          <span className="font-medium text-ink">{buildingName}</span> goes back to the executive with your reason.
          It comes back here when they mark it Accepted again.
        </p>
        <Textarea
          id="reject-reason"
          label="Why is it rejected?"
          rows={4}
          maxLength={1000}
          value={reason}
          error={attempted && !reason.trim() ? 'Give a reason the executive can act on' : null}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. The permission letter is not signed"
        />
        <ErrorLine error={error} />
      </div>
    </Modal>
  )
}
