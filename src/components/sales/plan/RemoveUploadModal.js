'use client'

import { useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { IconTrash } from '@/components/ui/icons'

const visits = (n) => `${n} ${n === 1 ? 'visit' : 'visits'}`

/**
 * Undo an upload (spec 2026-10-09 §3): the server deletes the upload's
 * unvisited visits dated today or later. Visits that happened, and past days
 * that were missed, stay as history; buildings stay assigned.
 */
export function RemoveUploadModal({ upload, onClose, onRemoved }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const upcoming = upload.upcomingCount ?? 0
  // Everything else stays linked: visited ones and past days that were missed.
  const kept = Math.max(0, (upload.taskCount ?? 0) - upcoming)

  async function remove() {
    setBusy(true)
    setError(null)
    try {
      const res = await apiClient.delete(`/sales/tasks/uploads/${upload.id}`)
      const { removed = 0, kept: stayed = 0 } = res.data.data ?? {}
      onRemoved(`Removed ${visits(removed)}${stayed ? ` · ${stayed} kept` : ''}`)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not remove the upload'))
      setBusy(false)
    }
  }

  const footer = (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button variant="secondary" onClick={onClose} disabled={busy}>
        Keep it
      </Button>
      <Button variant="danger" onClick={remove} loading={busy}>
        <IconTrash className="h-4 w-4" aria-hidden="true" /> Remove {visits(upcoming)}
      </Button>
    </div>
  )

  return (
    <Modal open onClose={busy ? () => {} : onClose} title="Remove this upload?" footer={footer}>
      <div className="flex flex-col gap-3 text-sm text-ink">
        {upload.fileName && <p className="truncate font-semibold">{upload.fileName}</p>}
        <p>
          Removes {upcoming} upcoming {upcoming === 1 ? 'visit' : 'visits'}.
          {kept > 0 &&
            ` ${kept} ${kept === 1 ? 'visit that already happened or was missed stays' : 'that already happened or were missed stay'}.`}{' '}
          Buildings stay assigned.
        </p>
        {error && <p className="rounded-btn bg-bad-tint px-4 py-3 font-medium text-bad">{error}</p>}
      </div>
    </Modal>
  )
}
