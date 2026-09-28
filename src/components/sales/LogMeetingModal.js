'use client'

import { useEffect, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { getCurrentLocation } from '@/lib/geolocation'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Input'
import { SelfieCapture } from './SelfieCapture'
import { IconLocate } from '@/components/ui/icons'

/**
 * Log this morning's team meeting: the location is captured automatically, a
 * live-camera photo is required (rear camera, no gallery), and an optional
 * note. One meeting per day — logging again replaces today's.
 */
export function LogMeetingModal({ onClose, onDone }) {
  const [coords, setCoords] = useState(null)
  const [locating, setLocating] = useState(true)
  const [locError, setLocError] = useState(null)
  const [photoUrl, setPhotoUrl] = useState(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function locate() {
    setLocating(true)
    setLocError(null)
    try {
      setCoords(await getCurrentLocation())
    } catch (err) {
      setLocError(err.message)
    } finally {
      setLocating(false)
    }
  }
  useEffect(() => {
    locate()
  }, [])

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      await apiClient.post('/sales/meetings', {
        photoUrl,
        latitude: coords.lat,
        longitude: coords.lng,
        note: note.trim() || undefined,
      })
      onDone()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not log the meeting'))
    } finally {
      setBusy(false)
    }
  }

  const ready = coords && photoUrl && !busy

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title="Log morning meeting"
      footer={
        <Button fullWidth loading={busy} disabled={!ready} onClick={submit}>
          Save meeting
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Location — captured automatically. */}
        <div className="flex items-center gap-2 text-sm">
          <IconLocate className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          {coords ? (
            <span className="font-medium text-ok">
              Location captured ({coords.lat.toFixed(5)}, {coords.lng.toFixed(5)})
            </span>
          ) : locating ? (
            <span className="text-muted">Getting your location…</span>
          ) : (
            <span className="text-bad">{locError}</span>
          )}
          {!coords && !locating && (
            <button type="button" onClick={locate} className="ml-auto text-fiber underline-offset-2 hover:underline">
              Retry
            </button>
          )}
        </div>

        {/* Meeting photo — live camera, required. */}
        <SelfieCapture
          onCaptured={setPhotoUrl}
          disabled={busy}
          facingMode="environment"
          label="Take the meeting photo"
          doneLabel="Photo captured"
        />

        <Textarea
          id="mtg-note"
          label="Note (optional)"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Who attended, what was discussed…"
        />

        {error && <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>}
        {!ready && !error && (
          <p className="text-xs font-normal text-faint">A photo and your location are required.</p>
        )}
      </div>
    </Modal>
  )
}
