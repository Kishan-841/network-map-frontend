'use client'

import Link from 'next/link'
import { IconChevronRight, IconClock } from '@/components/ui/icons'

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

function initialsOf(name) {
  const parts = (name || '?').split(/\s+/).filter(Boolean)
  const picks = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts
  return picks.slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'
}

/**
 * A person avatar that always occupies the same slot: the check-in selfie when
 * we have one, layered over an initials fallback so a missing OR broken image
 * degrades to a tidy circle instead of collapsing the row's alignment. A live
 * (still checked-in) visit gets a green ring.
 */
function Avatar({ name, src, live }) {
  return (
    <div
      className={`relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-fiber-tint ring-2 ${
        live ? 'ring-ok' : 'ring-transparent'
      }`}
    >
      <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-fiber">
        {initialsOf(name)}
      </span>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      )}
    </div>
  )
}

function LiveTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-ok-tint px-1.5 py-0.5 text-[0.6875rem] font-semibold text-ok">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-ok" />
      </span>
      Live
    </span>
  )
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
        <p className="rounded-card border border-dashed border-line bg-card px-4 py-8 text-center text-sm font-normal text-muted">
          No visits in this period.
        </p>
      )}
      {visits.map((v) => {
        const live = !v.checkOutAt
        const dur = duration(v.visitedAt, v.checkOutAt)
        const acts = [...new Set((v.activities ?? []).map((a) => ACTIVITY_LABEL[a.type] ?? a.type))]
        const inquiries = v.inquiries?.length ?? 0
        return (
          <Link
            key={v.id}
            href={`/sales/visits/${v.id}`}
            className="group flex items-center gap-3 rounded-card border border-line bg-card p-3 transition-colors hover:border-faint hover:bg-paper"
          >
            <Avatar name={v.user?.name} src={v.selfieUrl} live={live} />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">
                {v.user?.name}
                <span className="font-normal text-muted"> · {v.building?.buildingName}</span>
              </p>

              <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted">
                <IconClock className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden="true" />
                <span className="tabular-nums">
                  {fmtDay(v.visitedAt)} · {fmtTime(v.visitedAt)}
                </span>
                <span className="text-faint">→</span>
                {live ? (
                  <LiveTag />
                ) : (
                  <>
                    <span className="tabular-nums">{fmtTime(v.checkOutAt)}</span>
                    {dur && (
                      <span className="rounded-full bg-paper px-1.5 py-0.5 font-medium text-muted tabular-nums group-hover:bg-card">
                        {dur}
                      </span>
                    )}
                  </>
                )}
              </p>

              <div className="mt-1.5 flex flex-wrap gap-1">
                {acts.map((a) => (
                  <span
                    key={a}
                    className="rounded-full bg-paper px-2 py-0.5 text-xs font-medium text-muted group-hover:bg-card"
                  >
                    {a}
                  </span>
                ))}
                {inquiries > 0 && (
                  <span className="rounded-full bg-ok-tint px-2 py-0.5 text-xs font-medium text-ok">
                    {inquiries} inquir{inquiries === 1 ? 'y' : 'ies'}
                  </span>
                )}
                {acts.length === 0 && inquiries === 0 && (
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
