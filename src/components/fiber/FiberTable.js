'use client'

import { DataTable } from '@/components/ui/DataTable'
import { IconEdit, IconTrash } from '@/components/ui/icons'
import { coreColor } from '@/lib/fiber/constants'

const CoreDot = ({ coreCount }) => (
  <span
    className="h-2.5 w-2.5 shrink-0 rounded-full"
    style={{ backgroundColor: coreColor(coreCount) }}
  />
)

/** OLT feed, upstream splitter, or nothing — one line, no interactivity here. */
function feedLine(fiber) {
  if (fiber.olt) return `${fiber.olt.pop.name} · ${fiber.olt.name} · port ${fiber.ponPort}`
  if (fiber.fedBy) return `⤷ ${fiber.fedBy.splitter.closure.code} · out ${fiber.fedBy.portNo}`
  return '—'
}

function RowActions({ fiber, onEdit, onDelete }) {
  return (
    <div className="flex justify-end gap-1">
      <button
        type="button"
        aria-label="Edit"
        onClick={(e) => {
          e.stopPropagation()
          onEdit(fiber)
        }}
        className="flex h-9 w-9 min-h-11 items-center justify-center rounded-btn text-muted transition-colors hover:bg-paper hover:text-ink"
      >
        <IconEdit className="h-4 w-4" strokeWidth={1.8} />
      </button>
      <button
        type="button"
        aria-label="Delete"
        onClick={(e) => {
          e.stopPropagation()
          onDelete(fiber)
        }}
        className="flex h-9 w-9 min-h-11 items-center justify-center rounded-btn text-muted transition-colors hover:bg-bad-tint hover:text-bad"
      >
        <IconTrash className="h-4 w-4" strokeWidth={1.8} />
      </button>
    </div>
  )
}

/** Fiber list: gridded table ≥lg, stacked cards below. */
export default function FiberTable({ fibers, loading, canManage, onRowClick, onEdit, onDelete, emptyState }) {
  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (f) => (
        <span className="flex min-w-0 items-center gap-2">
          <CoreDot coreCount={f.coreCount} />
          <span className="truncate font-bold">{f.name}</span>
        </span>
      ),
    },
    { key: 'cores', header: 'Cores', render: (f) => `${f.coreCount} core` },
    { key: 'feed', header: 'Feed', render: feedLine, className: 'text-muted' },
    { key: 'closures', header: 'Closures', render: (f) => f.totals.closureCount },
    {
      key: 'laid',
      header: 'Laid',
      render: (f) => `${Math.round(f.totals.fiberLaidMeters)} m`,
      className: 'tabular-nums',
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: '',
            headerClassName: 'text-right',
            className: 'text-right',
            render: (f) => <RowActions fiber={f} onEdit={onEdit} onDelete={onDelete} />,
          },
        ]
      : []),
  ]

  const renderCard = (f) => (
    <div
      onClick={() => onRowClick(f)}
      className="cursor-pointer rounded-card bg-card p-4 shadow-soft transition-transform active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <CoreDot coreCount={f.coreCount} />
          <span className="truncate font-bold">{f.name}</span>
        </span>
      </div>
      <p className="mt-1 truncate text-sm font-normal text-muted">{feedLine(f)}</p>
      <p className="mt-1 text-sm font-normal text-muted">
        {Math.round(f.totals.fiberLaidMeters)} m laid · {f.totals.closureCount} closure
        {f.totals.closureCount === 1 ? '' : 's'}
      </p>
      {canManage && (
        <div className="mt-3 border-t border-line/60 pt-3">
          <RowActions fiber={f} onEdit={onEdit} onDelete={onDelete} />
        </div>
      )}
    </div>
  )

  return (
    <DataTable
      columns={columns}
      rows={fibers}
      loading={loading}
      keyField="id"
      onRowClick={onRowClick}
      renderCard={renderCard}
      emptyState={emptyState}
    />
  )
}
