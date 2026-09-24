'use client'

import { useEffect, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { getCurrentLocation } from '@/lib/geolocation'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { SelfieCapture } from './SelfieCapture'
import { IconLocate } from '@/components/ui/icons'

/**
 * Check in to a building: location is forced and a live-camera selfie is
 * required (no gallery upload). Location is fetched on open (and can be
 * retried); the selfie is taken with the camera and uploaded. Only when both
 * are ready can the visit be created.
 */
export function CheckInModal({ building, onClose, onDone }) {
  const [coords, setCoords] = useState(null)
  const [locating, setLocating] = useState(true)
  const [locError, setLocError] = useState(null)
  const [selfieUrl, setSelfieUrl] = useState(null)
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

        {/* Selfie — required, taken with the live camera (no gallery). */}
        <SelfieCapture onCaptured={setSelfieUrl} disabled={busy} />

        {error && <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>}
        {!ready && !error && <p className="text-xs font-normal text-faint">Location and a selfie are required to check in.</p>}
      </div>
    </Modal>
  )
}
