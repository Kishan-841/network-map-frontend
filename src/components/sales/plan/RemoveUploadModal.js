'use client'

import { useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { IconTrash } from '@/components/ui/icons'

const visits = (n) => `${n} ${n === 1 ? 'visit' : 'visits'}`

/**
 * Delete an upload (ADMIN, only while none of its visits has happened): the
 * server deletes every one of its visits — missed ones too — and the upload
 * itself, and refuses (409) if a visit was done meanwhile. Buildings stay assigned.
 */
export function RemoveUploadModal({ upload, onClose, onRemoved }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const count = upload.taskCount ?? 0

  async function remove() {
    setBusy(true)
    setError(null)
    try {
      const res = await apiClient.delete(`/sales/tasks/uploads/${upload.id}`)
      onRemoved(`Upload deleted · ${visits(res.data.data?.removed ?? 0)} removed`)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not delete the upload'))
      setBusy(false)
    }
  }

  const footer = (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button variant="secondary" onClick={onClose} disabled={busy}>
        Keep it
      </Button>
      <Button variant="danger" onClick={remove} loading={busy}>
        <IconTrash className="h-4 w-4" aria-hidden="true" /> Delete upload
      </Button>
    </div>
  )

  return (
    <Modal open onClose={busy ? () => {} : onClose} title="Delete this upload?" footer={footer}>
      <div className="flex flex-col gap-3 text-sm text-ink">
        {upload.fileName && <p className="truncate font-semibold">{upload.fileName}</p>}
        <p>
          Deletes all {visits(count)} in it and removes it from Uploads. None has been visited yet. Buildings stay
          assigned.
        </p>
        {error && <p className="rounded-btn bg-bad-tint px-4 py-3 font-medium text-bad">{error}</p>}
      </div>
    </Modal>
  )
}
