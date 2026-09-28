'use client'

import { useEffect, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { getCurrentLocation } from '@/lib/geolocation'
import { Button } from '@/components/ui/Button'
import { IconLocate, IconOkCircle, IconPlus } from '@/components/ui/icons'
import { InquiryModal } from './InquiryModal'

const ACTIVITIES = [
  { type: 'DESK', label: 'Desk' },
  { type: 'UMBRELLA', label: 'Umbrella' },
  { type: 'LIFT', label: 'Leafleting' },
]
const fmtTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
const pad = (n) => String(n).padStart(2, '0')

/** Live "time on site" since check-in, ticking every second (h:mm:ss or mm:ss). */
function useElapsed(sinceIso) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const s = Math.max(0, Math.floor((now - new Date(sinceIso).getTime()) / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`
}

/**
 * The field user's current open visit — deliberately the loudest thing on the
 * screen, because check-in / check-out (with location) happen here. A live
 * header band with a pulsing dot and a running timer signals it is ongoing;
 * activities are toggled, a lead can be raised, and Check out ends the session.
 */
export function OpenVisitCard({ visit, onChanged }) {
  const [busy, setBusy] = useState(null) // an activity type, or 'checkout'
  const [error, setError] = useState(null)
  const [inquiry, setInquiry] = useState(false)
  const elapsed = useElapsed(visit.visitedAt)

  const selected = new Set((visit.activities ?? []).map((a) => a.type))
  const nActs = (visit.activities ?? []).length
  const nLeads = (visit.inquiries ?? []).length

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
    <section className="mb-6 overflow-hidden rounded-card border border-fiber/40 bg-card shadow-lift ring-2 ring-fiber/20">
      {/* Live header — the visit is ongoing; the timer keeps running. A filled
          pill keeps the badge legible on any theme (fiber/on-fiber contrast). */}
      <div className="flex items-center justify-between gap-3 border-b border-line bg-fiber/10 px-4 py-3">
        <span className="inline-flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-fiber px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-on-fiber">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-on-fiber opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-on-fiber" />
            </span>
            Live
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Checked in</span>
        </span>
        <span className="font-mono text-base font-bold tabular-nums text-ink" aria-label="Time on site">
          {elapsed}
        </span>
      </div>

      <div className="p-4">
        <p className="text-xl font-bold text-ink">{visit.building?.buildingName}</p>
        <p className="mt-0.5 text-sm font-normal text-muted">
          On site since {fmtTime(visit.visitedAt)} · {nActs} activit{nActs === 1 ? 'y' : 'ies'} · {nLeads} lead
          {nLeads === 1 ? '' : 's'}
        </p>

        {/* Activities — a set of what was done here. */}
        <p className="mt-5 text-sm font-medium text-muted">Work done here — tap all that apply</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {ACTIVITIES.map((a) => {
            const on = selected.has(a.type)
            return (
              <button
                key={a.type}
                type="button"
                aria-pressed={on}
                disabled={busy === a.type}
                onClick={() => toggleActivity(a.type)}
                className={`inline-flex h-10 items-center gap-1.5 rounded-btn px-4 text-sm font-semibold transition-colors disabled:opacity-60 ${
                  on
                    ? 'bg-fiber text-on-fiber shadow-soft'
                    : 'border border-line text-ink hover:border-fiber/50 hover:bg-paper'
                }`}
              >
                {busy === a.type ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : on ? (
                  <IconOkCircle className="h-4 w-4" aria-hidden="true" />
                ) : null}
                {a.label}
              </button>
            )
          })}
        </div>

        {/* A lead is a customer captured on this visit, not an activity. */}
        <div className="mt-5 border-t border-line pt-4">
          <button
            type="button"
            onClick={() => setInquiry(true)}
            className="inline-flex h-10 items-center gap-2 rounded-btn border border-line px-4 text-sm font-semibold text-ink transition-colors hover:border-fiber/50 hover:bg-paper"
          >
            <IconPlus className="h-4 w-4" aria-hidden="true" />
            Lead generation
          </button>
        </div>

        {error && <p className="mt-4 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>}

        {/* Hero action — ends the visit and captures the check-out location. */}
        <Button className="mt-5 w-full gap-2" loading={busy === 'checkout'} onClick={checkOut}>
          <IconLocate className="h-4.5 w-4.5" aria-hidden="true" />
          Check out
        </Button>
        <p className="mt-2 flex items-center justify-center gap-1 text-xs font-normal text-faint">
          <IconLocate className="h-3.5 w-3.5" aria-hidden="true" />
          Your location is recorded when you check out
        </p>
      </div>

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
