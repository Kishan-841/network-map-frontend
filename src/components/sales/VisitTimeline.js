'use client'

import Link from 'next/link'
import { IconChevronRight } from '@/components/ui/icons'

const fmtTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
const fmtDay = (iso) => new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' })
const ACTIVITY_LABEL = { DESK: 'Desk', UMBRELLA: 'Umbrella', LIFT: 'Lift' }

function duration(inIso, outIso) {
  if (!outIso) return null
  const mins = Math.max(0, Math.round((new Date(outIso) - new Date(inIso)) / 60000))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h ? `${h}h ${m}m` : `${m}m`
}

/**
 * The field-work timeline for the selected period: every visit in scope, most
 * recent first. Each card links to that visit's detail page — clicking opens
 * everything about the visit.
 */
export function VisitTimeline({ visits = [], loading = false }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-muted">Field visits</p>
      {loading && <p className="text-sm font-normal text-muted">Loading…</p>}
      {!loading && visits.length === 0 && (
        <p className="text-sm font-normal text-muted">No visits in this period.</p>
      )}
      {visits.map((v) => {
        const dur = duration(v.visitedAt, v.checkOutAt)
        const acts = [...new Set((v.activities ?? []).map((a) => ACTIVITY_LABEL[a.type] ?? a.type))]
        return (
          <Link
            key={v.id}
            href={`/sales/visits/${v.id}`}
            className="flex items-center gap-3 rounded-card border border-line bg-card p-3 transition-colors hover:border-faint hover:bg-paper"
          >
            {v.selfieUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={v.selfieUrl}
                alt=""
                className="h-12 w-12 shrink-0 rounded-btn bg-paper object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">
                {v.user?.name} <span className="font-normal text-muted">· {v.building?.buildingName}</span>
              </p>
              <p className="text-sm font-normal text-muted">
                {fmtDay(v.visitedAt)} · IN {fmtTime(v.visitedAt)}
                {' → '}
                {v.checkOutAt ? `OUT ${fmtTime(v.checkOutAt)}` : <span className="text-fiber">still in</span>}
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
            <IconChevronRight className="h-5 w-5 shrink-0 text-faint" aria-hidden="true" />
          </Link>
        )
      })}
    </div>
  )
}
