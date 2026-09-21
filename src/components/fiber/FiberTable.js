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
/** Read-only text; a null value reads faint. Editing happens in the drawer. */
const textCell = (value, placeholder) =>
  value ? <span className="truncate">{value}</span> : <span className="text-faint">{placeholder}</span>

/** Fiber list: gridded table ≥lg, stacked cards below. Zone and operator are
 *  read-only here — they are changed in the detail drawer, not the table. */
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
    { key: 'zone', header: 'Zone', render: (f) => textCell(f.zone?.name, 'No zone') },
    { key: 'operator', header: 'Operator', render: (f) => textCell(f.operator?.name, 'No operator') },
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
      className="flex items-center gap-2 rounded-card border-l-4 bg-card p-3 shadow-soft"
      style={{ borderLeftColor: coreColor(f.coreCount) }}
    >
      <button
        type="button"
        onClick={() => onRowClick(f)}
        className="min-w-0 flex-1 text-left transition-transform active:scale-[0.99]"
      >
        <span className="flex min-w-0 items-center gap-2">
          <CoreDot coreCount={f.coreCount} />
          <span className="truncate font-bold">{f.name}</span>
        </span>
        <span className="mt-0.5 block truncate text-sm font-normal text-muted">
          {f.coreCount} core · {f.zone?.name ?? 'No zone'} · {f.operator?.name ?? 'No operator'}
        </span>
      </button>
      {canManage && <RowActions fiber={f} onEdit={onEdit} onDelete={onDelete} />}
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
