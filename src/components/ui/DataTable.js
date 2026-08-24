'use client'

import { Pagination } from '@/components/ui/Pagination'

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

/**
 * Responsive data table (Design.md: cards on mobile, table on desktop).
 *
 * ≥lg: a gridded DaisyUI table from `columns` config — vertical + horizontal
 *      dividers, zebra rows, uppercase headers.
 * <lg: stacked cards via `renderCard(row)`.
 *
 * columns: [{ key, header, render?(row), className?, headerClassName? }]
 * Optional controls: pageSize/onPageSizeChange (Show-N selector),
 * pagination/onPageChange (footer pager).
 *
 * selection: { selectedIds: Set, onToggle(id), onToggleAll(ids, checked) }
 *   adds a leading checkbox column (and a checkbox beside each mobile card).
 *   The header box reflects THIS page only — selecting beyond the page is the
 *   caller's job, because only it knows the total behind the filter.
 */
export function DataTable({
  columns,
  rows,
  keyField = 'id',
  onRowClick,
  renderCard,
  loading = false,
  skeletonRows = 6,
  renderCardSkeleton,
  emptyState = null,
  pageSize,
  onPageSizeChange,
  pagination,
  onPageChange,
  selection,
}) {
  const showToolbar = Boolean(onPageSizeChange)
  const pageIds = rows?.map((row) => row[keyField]) ?? []
  const selectedOnPage = selection ? pageIds.filter((id) => selection.selectedIds.has(id)).length : 0
  const pageAllSelected = pageIds.length > 0 && selectedOnPage === pageIds.length
  const pageSomeSelected = selectedOnPage > 0

  const toolbar = showToolbar && (
    <div className="mb-3 flex items-center gap-2 text-sm text-muted">
      <span>Show</span>
      <select
        value={pageSize}
        onChange={(e) => onPageSizeChange(Number(e.target.value))}
        className="select select-sm rounded-btn border-line bg-card"
        aria-label="Rows per page"
      >
        {PAGE_SIZE_OPTIONS.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
      <span>entries</span>
    </div>
  )

  if (loading) {
    return (
      <>
        {toolbar}
        <div className="hidden overflow-hidden rounded-card border border-line bg-card shadow-soft lg:block">
          <div className="p-4">
            {Array.from({ length: skeletonRows }).map((_, i) => (
              <div key={i} className={`shimmer h-11 rounded bg-line/40 ${i > 0 ? 'mt-2' : ''}`} />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-4 lg:hidden">
          {Array.from({ length: 3 }).map((_, i) =>
            renderCardSkeleton ? (
              <div key={i}>{renderCardSkeleton()}</div>
            ) : (
              <div key={i} className="shimmer h-28 rounded-card bg-line/40" />
            ),
          )}
        </div>
      </>
    )
  }

  if (rows?.length === 0) return <>{toolbar}{emptyState}</>

  return (
    <>
      {toolbar}

      {/* Desktop: gridded table */}
      <div className="hidden overflow-hidden rounded-card border border-line bg-card shadow-soft lg:block">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr className="border-b border-line bg-base-200/60">
                {selection && (
                  <th className="w-12 px-5 py-3.5">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm"
                      aria-label="Select all rows on this page"
                      checked={pageAllSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = pageSomeSelected && !pageAllSelected
                      }}
                      onChange={(e) =>
                        selection.onToggleAll(
                          rows.map((row) => row[keyField]),
                          e.target.checked,
                        )
                      }
                    />
                  </th>
                )}
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={`border-l border-line/70 px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-muted first:border-l-0 ${column.headerClassName ?? ''}`}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows?.map((row) => (
                <tr
                  key={row[keyField]}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`border-b border-line/60 transition-colors duration-150 last:border-b-0 even:bg-base-200/40 hover:bg-primary/5 ${
                    onRowClick ? 'cursor-pointer' : ''
                  }`}
                >
                  {selection && (
                    <td className="w-12 px-5 py-4 align-middle" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        aria-label={`Select ${row.buildingName ?? row[keyField]}`}
                        checked={selection.selectedIds.has(row[keyField])}
                        onChange={() => selection.onToggle(row[keyField])}
                      />
                    </td>
                  )}
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`border-l border-line/50 px-5 py-4 align-middle text-sm first:border-l-0 ${column.className ?? ''}`}
                    >
                      {column.render ? column.render(row) : row[column.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile: stacked cards */}
      <div className="stagger flex flex-col gap-4 lg:hidden">
        {rows?.map((row) =>
          selection ? (
            <div key={row[keyField]} className="flex items-start gap-3">
              <input
                type="checkbox"
                className="checkbox checkbox-sm mt-4 shrink-0"
                aria-label={`Select ${row.buildingName ?? row[keyField]}`}
                checked={selection.selectedIds.has(row[keyField])}
                onChange={() => selection.onToggle(row[keyField])}
              />
              <div className="min-w-0 flex-1">{renderCard(row)}</div>
            </div>
          ) : (
            <div key={row[keyField]}>{renderCard(row)}</div>
          ),
        )}
      </div>

      {pagination && onPageChange && (
        <Pagination pagination={pagination} onChange={onPageChange} />
      )}
    </>
  )
}
