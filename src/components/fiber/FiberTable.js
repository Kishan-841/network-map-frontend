'use client'

import { DataTable } from '@/components/ui/DataTable'
import { IconEdit, IconTrash } from '@/components/ui/icons'
import { coreColor } from '@/lib/fiber/constants'

/**
 * Zone and operator, changeable without opening the editor — they are one
 * choice each, and walking a surveyor through the drawing tool to correct a
 * dropdown is a poor trade. Saves on change; puts the old value back if the
 * server refuses (a surveyor may only use a zone they are assigned to).
 */
function InlineSelect({ value, options, disabled, busy, label, placeholder, onChange }) {
  if (disabled) {
    return (
      <span className="truncate text-muted">
        {options.find((o) => o.id === value)?.name ?? '—'}
      </span>
    )
  }
  return (
    <select
      value={value ?? ''}
      disabled={busy}
      aria-label={label}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        e.stopPropagation()
        onChange(e.target.value || null)
      }}
      className="min-h-11 w-full max-w-[180px] truncate rounded-btn border border-line bg-card px-2 text-sm font-normal outline-none transition-colors hover:border-fiber/50 focus:border-fiber focus:ring-2 focus:ring-fiber/15 disabled:opacity-50"
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.name}
        </option>
      ))}
    </select>
  )
}

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
export default function FiberTable({
  fibers,
  loading,
  canManage,
  zones = [],
  operators = [],
  busyId,
  onFieldChange,
  onRowClick,
  onEdit,
  onDelete,
  emptyState,
}) {
  const zoneCell = (f) => (
    <InlineSelect
      value={f.zoneId}
      options={zones}
      disabled={!canManage || !onFieldChange}
      busy={busyId === f.id}
      label={`Zone for ${f.name}`}
      placeholder="No zone"
      onChange={(zoneId) => onFieldChange(f, { zoneId })}
    />
  )
  const operatorCell = (f) => (
    <InlineSelect
      value={f.operatorId}
      options={operators}
      disabled={!canManage || !onFieldChange}
      busy={busyId === f.id}
      label={`Operator for ${f.name}`}
      placeholder="No operator"
      onChange={(operatorId) => onFieldChange(f, { operatorId })}
    />
  )

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
    { key: 'zone', header: 'Zone', render: zoneCell },
    { key: 'operator', header: 'Operator', render: operatorCell },
    { key: 'closures', header: 'Closures', render: (f) => f.totals.closureCount },
    { key: 'splitters', header: 'Splitters', render: (f) => f.totals.splitterCount ?? 0 },
    {
      key: 'length',
      header: 'Length',
      render: (f) => `${Math.round(f.totals.mapMeters || f.totals.pathMeters)} m`,
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
      <p className="mt-1 text-sm font-normal text-muted">
        {Math.round(f.totals.mapMeters || f.totals.pathMeters)} m · {f.totals.closureCount} closure
        {f.totals.closureCount === 1 ? '' : 's'} · {f.totals.splitterCount ?? 0} splitter
        {f.totals.splitterCount === 1 ? '' : 's'}
      </p>
      <div
        className="mt-3 flex flex-col gap-2 border-t border-line/60 pt-3"
        onClick={(e) => e.stopPropagation()}
      >
        {zoneCell(f)}
        {operatorCell(f)}
      </div>
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
