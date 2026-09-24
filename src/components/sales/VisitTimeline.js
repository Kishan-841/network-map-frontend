'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'

const fmtTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
const fmtDay = (iso) => new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' })
const ACTIVITY_LABEL = { DESK: 'Desk', UMBRELLA: 'Umbrella', LIFT: 'Lift' }
const mapHref = (lat, lng) => (lat != null && lng != null ? `https://www.google.com/maps?q=${lat},${lng}` : null)

function duration(inIso, outIso) {
  if (!outIso) return null
  const mins = Math.max(0, Math.round((new Date(outIso) - new Date(inIso)) / 60000))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h ? `${h}h ${m}m` : `${m}m`
}

function activityCounts(activities) {
  const c = {}
  for (const a of activities ?? []) c[a.type] = (c[a.type] ?? 0) + 1
  return Object.entries(c).map(([type, n]) => `${ACTIVITY_LABEL[type] ?? type}${n > 1 ? ` ×${n}` : ''}`)
}

/**
 * The field-work timeline for the selected period: every visit in scope, most
 * recent first — who, which building, IN/OUT times + map links, duration,
 * selfie, and the activities + inquiries done between.
 */
export function VisitTimeline({ from }) {
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    apiClient
      .get('/sales/visits', { params: from ? { from } : {} })
      .then((res) => alive && (setVisits(res.data.data), setLoading(false)))
      .catch(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [from])

  return (
    <div className="mt-4 flex flex-col gap-2">
      <p className="text-sm font-medium text-muted">Field visits</p>
      {loading && <p className="text-sm font-normal text-muted">Loading…</p>}
      {!loading && visits.length === 0 && (
        <p className="text-sm font-normal text-muted">No visits in this period.</p>
      )}
      {visits.map((v) => {
        const dur = duration(v.visitedAt, v.checkOutAt)
        const inHref = mapHref(v.checkInLat, v.checkInLng)
        const outHref = mapHref(v.checkOutLat, v.checkOutLng)
        const acts = activityCounts(v.activities)
        return (
          <div key={v.id} className="flex gap-3 rounded-card border border-line bg-card p-3">
            {v.selfieUrl && (
              <a href={v.selfieUrl} target="_blank" rel="noreferrer" className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.selfieUrl} alt="Selfie" className="h-14 w-14 rounded-btn object-cover" />
              </a>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">
                {v.user?.name} <span className="font-normal text-muted">· {v.building?.buildingName}</span>
              </p>
              <p className="text-sm font-normal text-muted">
                {fmtDay(v.visitedAt)} · {inHref ? (
                  <a href={inHref} target="_blank" rel="noreferrer" className="text-fiber underline-offset-2 hover:underline">
                    IN {fmtTime(v.visitedAt)}
                  </a>
                ) : (
                  <>IN {fmtTime(v.visitedAt)}</>
                )}
                {' → '}
                {v.checkOutAt ? (
                  outHref ? (
                    <a href={outHref} target="_blank" rel="noreferrer" className="text-fiber underline-offset-2 hover:underline">
                      OUT {fmtTime(v.checkOutAt)}
                    </a>
                  ) : (
                    <>OUT {fmtTime(v.checkOutAt)}</>
                  )
                ) : (
                  <span className="text-fiber">still in</span>
                )}
                {dur && <span className="text-faint"> · {dur}</span>}
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {acts.map((a) => (
                  <span key={a} className="rounded-full bg-paper px-2 py-0.5 text-xs font-medium text-muted">
                    {a}
                  </span>
                ))}
                {(v.inquiries?.length ?? 0) > 0 && (
                  <span className="rounded-full bg-ok-tint px-2 py-0.5 text-xs font-medium text-ok">
                    {v.inquiries.length} inquir{v.inquiries.length === 1 ? 'y' : 'ies'}
                  </span>
                )}
                {acts.length === 0 && (v.inquiries?.length ?? 0) === 0 && (
                  <span className="text-xs font-normal text-faint">No work logged</span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
