'use client'

import { useRouter } from 'next/navigation'
import { DataTable } from '@/components/ui/DataTable'

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

function LiveTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-ok-tint px-2 py-0.5 text-xs font-semibold text-ok">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-ok" />
      </span>
      Live
    </span>
  )
}

/** The Desk / Umbrella / Lift + inquiry chips a visit produced, or a dash. */
function Work({ visit }) {
  const acts = [...new Set((visit.activities ?? []).map((a) => ACTIVITY_LABEL[a.type] ?? a.type))]
  const inquiries = visit.inquiries?.length ?? 0
  if (acts.length === 0 && inquiries === 0) return <span className="text-faint">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {acts.map((a) => (
        <span key={a} className="rounded-full bg-paper px-2 py-0.5 text-xs font-medium text-muted">
          {a}
        </span>
      ))}
      {inquiries > 0 && (
        <span className="rounded-full bg-ok-tint px-2 py-0.5 text-xs font-medium text-ok">
          {inquiries} inquir{inquiries === 1 ? 'y' : 'ies'}
        </span>
      )}
    </div>
  )
}

/**
 * The field-work for the selected period as a responsive table (Design.md:
 * a real table on desktop, stacked cards on a phone). A row opens that visit's
 * detail page.
 */
export function VisitTimeline({ visits = [], loading = false, showPerson = true }) {
  const router = useRouter()
  const open = (v) => router.push(`/sales/visits/${v.id}`)

  const columns = [
    ...(showPerson
      ? [
          {
            key: 'user',
            header: 'Sales person',
            render: (v) => <span className="font-medium text-ink">{v.user?.name}</span>,
          },
        ]
      : []),
    {
      key: 'building',
      header: 'Building',
      render: (v) => <span className={showPerson ? undefined : 'font-medium text-ink'}>{v.building?.buildingName ?? '—'}</span>,
    },
    {
      key: 'in',
      header: 'Check-in',
      render: (v) => (
        <span className="whitespace-nowrap tabular-nums">
          {fmtDay(v.visitedAt)} · {fmtTime(v.visitedAt)}
        </span>
      ),
    },
    {
      key: 'out',
      header: 'Check-out',
      render: (v) =>
        v.checkOutAt ? (
          <span className="whitespace-nowrap tabular-nums">{fmtTime(v.checkOutAt)}</span>
        ) : (
          <LiveTag />
        ),
    },
    {
      key: 'duration',
      header: 'Time',
      render: (v) => {
        const dur = duration(v.visitedAt, v.checkOutAt)
        return dur ? <span className="tabular-nums">{dur}</span> : <span className="text-faint">—</span>
      },
    },
    { key: 'work', header: 'Work', render: (v) => <Work visit={v} /> },
  ]

  const renderCard = (v) => (
    <button
      type="button"
      onClick={() => open(v)}
      className="w-full rounded-card border border-line bg-card p-3 text-left transition-transform active:scale-[0.99]"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate font-medium text-ink">
          {showPerson ? v.user?.name : v.building?.buildingName}
        </span>
        {v.checkOutAt ? (
          <span className="shrink-0 text-xs tabular-nums text-muted">
            {duration(v.visitedAt, v.checkOutAt)}
          </span>
        ) : (
          <LiveTag />
        )}
      </div>
      {showPerson && <p className="mt-0.5 truncate text-sm text-muted">{v.building?.buildingName}</p>}
      <p className="mt-0.5 text-xs tabular-nums text-muted">
        {fmtDay(v.visitedAt)} · {fmtTime(v.visitedAt)}
        {v.checkOutAt ? ` → ${fmtTime(v.checkOutAt)}` : ''}
      </p>
      <div className="mt-2">
        <Work visit={v} />
      </div>
    </button>
  )

  const emptyState = (
    <p className="rounded-card border border-dashed border-line bg-card px-4 py-8 text-center text-sm text-muted">
      No visits in this period.
    </p>
  )

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-muted">Field visits</p>
      <DataTable
        columns={columns}
        rows={visits}
        keyField="id"
        loading={loading}
        onRowClick={open}
        renderCard={renderCard}
        emptyState={emptyState}
      />
    </div>
  )
}
