'use client'

import { useEffect, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { uploadFile } from '@/lib/upload'
import { getCurrentLocation } from '@/lib/geolocation'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { IconLocate, IconOkCircle } from '@/components/ui/icons'

/**
 * Check in to a building: location is forced and a selfie is required. Location
 * is fetched on open (and can be retried); the selfie is captured and uploaded.
 * Only when both are ready can the visit be created.
 */
export function CheckInModal({ building, onClose, onDone }) {
  const [coords, setCoords] = useState(null)
  const [locating, setLocating] = useState(true)
  const [locError, setLocError] = useState(null)
  const [selfieUrl, setSelfieUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
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

  async function onSelfie(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      setSelfieUrl(await uploadFile(file))
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not upload the selfie'))
    } finally {
      setUploading(false)
    }
  }

  async function checkIn() {
    setBusy(true)
    setError(null)
    try {
      await apiClient.post('/sales/visits', {
        buildingId: building.id,
        checkInLat: coords.lat,
        checkInLng: coords.lng,
        selfieUrl,
      })
      onDone()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not check in'))
    } finally {
      setBusy(false)
    }
  }

  const ready = coords && selfieUrl && !busy

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title="Check in"
      footer={
        <Button fullWidth loading={busy} disabled={!ready} onClick={checkIn}>
          Check in
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-btn bg-paper px-4 py-3">
          <p className="text-sm font-medium text-ink">{building.buildingName}</p>
          <p className="text-sm font-normal text-muted">{building.formattedAddress}</p>
        </div>

        {/* Location — forced. */}
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

        {/* Selfie — required. */}
        <label className="flex cursor-pointer items-center gap-2 rounded-btn border border-line px-4 py-3 text-sm font-medium transition-colors hover:bg-paper">
          {selfieUrl ? (
            <>
              <IconOkCircle className="h-4 w-4 text-ok" aria-hidden="true" />
              <span className="text-ok">Selfie added</span>
              <span className="ml-auto text-muted">Retake</span>
            </>
          ) : (
            <span>{uploading ? 'Uploading selfie…' : 'Take a selfie'}</span>
          )}
          <input type="file" accept="image/*" capture="user" className="hidden" onChange={onSelfie} disabled={uploading} />
        </label>

        {error && <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>}
        {!ready && !error && <p className="text-xs font-normal text-faint">Location and a selfie are required to check in.</p>}
      </div>
    </Modal>
  )
}
