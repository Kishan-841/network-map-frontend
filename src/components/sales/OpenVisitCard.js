'use client'

import { useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { getCurrentLocation } from '@/lib/geolocation'
import { Button } from '@/components/ui/Button'
import { InquiryModal } from './InquiryModal'

const ACTIVITIES = [
  { type: 'DESK', label: 'Desk' },
  { type: 'UMBRELLA', label: 'Umbrella' },
  { type: 'LIFT', label: 'Lift' },
]
const fmtTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

/**
 * The field user's current open visit: log Desk/Umbrella/Lift activities, raise
 * an inquiry (linked to this visit), and check out — capturing the location.
 */
export function OpenVisitCard({ visit, onChanged }) {
  const [busy, setBusy] = useState(null) // an activity type, or 'checkout'
  const [error, setError] = useState(null)
  const [inquiry, setInquiry] = useState(false)

  // Activities are a set of types done — selected or not, never counted.
  const selected = new Set((visit.activities ?? []).map((a) => a.type))

  async function toggleActivity(type) {
    setBusy(type)
    setError(null)
    try {
      if (selected.has(type)) await apiClient.delete(`/sales/visits/${visit.id}/activities/${type}`)
      else await apiClient.post(`/sales/visits/${visit.id}/activities`, { type })
      onChanged()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not update the activity'))
    } finally {
      setBusy(null)
    }
  }

  async function checkOut() {
    setBusy('checkout')
    setError(null)
    try {
      const loc = await getCurrentLocation() // forced location
      await apiClient.post(`/sales/visits/${visit.id}/checkout`, { checkOutLat: loc.lat, checkOutLng: loc.lng })
      onChanged()
    } catch (err) {
      setError(err.response ? getApiErrorMessage(err, 'Could not check out') : err.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="mb-6 rounded-card border-2 border-fiber/40 bg-card p-4 shadow-lift">
      <p className="text-xs font-medium uppercase tracking-wide text-fiber">Checked in</p>
      <p className="text-lg font-bold text-ink">{visit.building?.buildingName}</p>
      <p className="text-sm font-normal text-muted">
        Since {fmtTime(visit.visitedAt)} · {(visit.activities ?? []).length} activit
        {(visit.activities ?? []).length === 1 ? 'y' : 'ies'} · {(visit.inquiries ?? []).length} inquir
        {(visit.inquiries ?? []).length === 1 ? 'y' : 'ies'}
      </p>

      <p className="mt-4 text-sm font-medium text-muted">Work done here — tap all that apply</p>
      <div className="mt-1 flex flex-wrap gap-2">
        {ACTIVITIES.map((a) => {
          const on = selected.has(a.type)
          return (
            <button
              key={a.type}
              type="button"
              aria-pressed={on}
              disabled={busy === a.type}
              onClick={() => toggleActivity(a.type)}
              className={`inline-flex h-10 items-center gap-2 rounded-btn px-4 text-sm font-medium transition-colors disabled:opacity-60 ${
                on ? 'bg-fiber text-on-fiber' : 'border border-line text-ink hover:bg-paper'
              }`}
            >
              {busy === a.type && <span className="loading loading-spinner loading-xs" />}
              {a.label}
            </button>
          )
        })}
      </div>

      {/* An inquiry is a separate thing — a customer, not an activity. */}
      <div className="mt-4 border-t border-line pt-4">
        <Button variant="secondary" className="h-10 min-h-10" onClick={() => setInquiry(true)}>
          Generate inquiry
        </Button>
      </div>

      {error && <p className="mt-3 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>}

      <Button className="mt-4 w-full" loading={busy === 'checkout'} onClick={checkOut}>
        Check out
      </Button>

      {inquiry && (
        <InquiryModal
          building={{
            id: visit.buildingId,
            buildingName: visit.building?.buildingName,
            formattedAddress: visit.building?.formattedAddress,
          }}
          visitId={visit.id}
          onClose={() => setInquiry(false)}
          onDone={() => {
            setInquiry(false)
            onChanged()
          }}
        />
      )}
    </section>
  )
}
