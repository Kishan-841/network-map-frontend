'use client'

import { useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'

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

/** One POST with busy / error state, shared by the three modals below. */
function usePost(url, body, fallback, onDone, message) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  async function run() {
    setBusy(true)
    setError(null)
    try {
      await apiClient.post(url, body())
      onDone(message)
    } catch (err) {
      setError(getApiErrorMessage(err, fallback))
      setBusy(false)
    }
  }
  return { busy, error, run }
}

/** ADMIN: approve the material request, with an optional note. */
export function ApproveMaterialsModal({ buildingId, buildingName, onClose, onDone }) {
  const [note, setNote] = useState('')
  const { busy, error, run } = usePost(
    `/permission-buildings/${buildingId}/survey/approve`,
    () => (note.trim() ? { note: note.trim() } : {}),
    'Could not approve the materials',
    onDone,
    'Materials approved',
  )
  return (
    <Modal
      open
      onClose={onClose}
      dismissable={false}
      title="Approve materials"
      footer={<Footer onClose={onClose} onConfirm={run} busy={busy} label="Approve" variant="success" />}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm font-normal text-muted">
          The survey of <span className="font-medium text-ink">{buildingName}</span> locks for the surveyor, and they can
          mark it live once the material has arrived and the connection works.
        </p>
        <Textarea
          id="materials-approve-note"
          label="Note (optional)"
          rows={3}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Fibre from the Cidco store"
        />
        <ErrorLine error={error} />
      </div>
    </Modal>
  )
}

/** ADMIN: send the survey back to the surveyor with the reason to fix. */
export function RejectMaterialsModal({ buildingId, buildingName, onClose, onDone }) {
  const [reason, setReason] = useState('')
  const [attempted, setAttempted] = useState(false)
  const { busy, error, run } = usePost(
    `/permission-buildings/${buildingId}/survey/reject`,
    () => ({ reason: reason.trim() }),
    'Could not reject the materials',
    onDone,
    'Materials rejected — the surveyor will see your reason',
  )
  const confirm = () => (reason.trim() ? run() : setAttempted(true))
  return (
    <Modal
      open
      onClose={onClose}
      dismissable={false}
      title="Reject materials"
      footer={<Footer onClose={onClose} onConfirm={confirm} busy={busy} label="Reject" variant="danger" />}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm font-normal text-muted">
          The survey of <span className="font-medium text-ink">{buildingName}</span> goes back to the surveyor with your
          reason. It comes back here when they submit it again.
        </p>
        <Textarea
          id="materials-reject-reason"
          label="Why is it rejected?"
          rows={4}
          maxLength={1000}
          value={reason}
          error={attempted && !reason.trim() ? 'Give a reason the surveyor can act on' : null}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. 48F is too much for two wings — use 12F"
        />
        <ErrorLine error={error} />
      </div>
    </Modal>
  )
}

/** The zone surveyor (or ADMIN): material arrived and the connection works. */
export function MarkLiveModal({ buildingId, buildingName, onClose, onDone }) {
  const { busy, error, run } = usePost(
    `/permission-buildings/${buildingId}/mark-live`,
    () => ({}),
    'Could not mark it live',
    onDone,
    'Marked live',
  )
  return (
    <Modal
      open
      onClose={onClose}
      dismissable={false}
      title="Mark live?"
      footer={<Footer onClose={onClose} onConfirm={run} busy={busy} label="Mark live" variant="success" />}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm font-normal text-ink">
          Confirm that the material for <span className="font-medium">{buildingName}</span> has arrived and the
          connection is done.
        </p>
        <p className="text-sm font-normal text-muted">
          The building shows as Live everywhere — sales can sell connections in it. Only an admin can undo this.
        </p>
        <ErrorLine error={error} />
      </div>
    </Modal>
  )
}
