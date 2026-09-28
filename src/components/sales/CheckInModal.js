'use client'

import { useEffect, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { getCurrentLocation } from '@/lib/geolocation'
import { useAuthStore } from '@/stores/auth-store'
import { isTeamLeader } from '@/lib/roles'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { MultiSelect } from '@/components/ui/MultiSelect'
import { SelfieCapture } from './SelfieCapture'
import { IconLocate } from '@/components/ui/icons'

/**
 * Check in to a building: location is forced and a live-camera selfie is
 * required (no gallery upload). A TEAM_LEADER also records who they went with —
 * one or more of their executives, or "went solo". Only when everything
 * required is ready can the visit be created.
 */
export function CheckInModal({ building, onClose, onDone }) {
  const role = useAuthStore((s) => s.user?.role)
  const isTL = isTeamLeader(role)

  const [coords, setCoords] = useState(null)
  const [locating, setLocating] = useState(true)
  const [locError, setLocError] = useState(null)
  const [selfieUrl, setSelfieUrl] = useState(null)
  const [execs, setExecs] = useState([])
  const [companions, setCompanions] = useState(() => new Set())
  const [wentSolo, setWentSolo] = useState(false)
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

  // A team leader picks from their own executives.
  useEffect(() => {
    if (!isTL) return undefined
    let alive = true
    apiClient
      .get('/sales/team')
      .then((res) => alive && setExecs(res.data.data.filter((u) => u.role === 'SALES_EXECUTIVE')))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [isTL])

  function goSolo() {
    setWentSolo(true)
    setCompanions(new Set())
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
        ...(isTL ? { companionIds: [...companions], wentSolo } : {}),
      })
      onDone()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not check in'))
    } finally {
      setBusy(false)
    }
  }

  const companionsChosen = !isTL || wentSolo || companions.size > 0
  const ready = coords && selfieUrl && companionsChosen && !busy

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

        {/* Team leader: who did you go with? (their executives, or solo) */}
        {isTL && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-muted">Who did you go with?</p>
              <button
                type="button"
                aria-pressed={wentSolo}
                disabled={busy}
                onClick={() => (wentSolo ? setWentSolo(false) : goSolo())}
                className={`inline-flex h-8 items-center rounded-btn px-3 text-sm font-medium transition-colors disabled:opacity-60 ${
                  wentSolo ? 'bg-fiber text-on-fiber' : 'border border-line text-ink hover:bg-paper'
                }`}
              >
                Went solo
              </button>
            </div>
            {!wentSolo &&
              (execs.length === 0 ? (
                <p className="text-xs font-normal text-faint">You have no executives yet — mark that you went solo.</p>
              ) : (
                <MultiSelect
                  options={execs.map((u) => ({ id: u.id, label: u.name }))}
                  selectedIds={[...companions]}
                  onChange={(ids) => {
                    setWentSolo(false)
                    setCompanions(new Set(ids))
                  }}
                  placeholder="Search executives…"
                  emptyText="No matching executives"
                />
              ))}
          </div>
        )}

        {error && <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>}
        {!ready && !error && (
          <p className="text-xs font-normal text-faint">
            {isTL
              ? 'Location, a selfie and who you went with are required to check in.'
              : 'Location and a selfie are required to check in.'}
          </p>
        )}
      </div>
    </Modal>
  )
}
