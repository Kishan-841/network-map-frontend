/**
 * Client-side search and paging for the small, already-loaded lists (fibers,
 * closures, POPs). These sets are in the tens-to-low-hundreds and the map
 * fetches them whole anyway, so filtering in the browser is instant and needs
 * no endpoint of its own. A list that ever grew to thousands would move to
 * server-side paging, one page at a time.
 */

/**
 * Rows whose text contains every word typed, ignoring case, surrounding space
 * and word order. `getText(row)` returns the searchable string(s) for a row —
 * a string or an array of them (nullish parts are skipped).
 */
export function filterRows(rows, query, getText) {
  const words = String(query ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return rows
  return rows.filter((row) => {
    const hay = []
      .concat(getText(row) ?? [])
      .filter((part) => part != null)
      .join(' ')
      .toLowerCase()
    return words.every((word) => hay.includes(word))
  })
}

/**
 * One page of rows, plus the shape `Pagination` reads. `page` is clamped into
 * range, so a page that no longer exists (the list shrank under a filter)
 * falls back to the last real page rather than showing nothing.
 */
export function paginate(rows, page, pageSize) {
  const total = rows.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(Math.max(1, page), totalPages)
  const start = (current - 1) * pageSize
  return {
    pageRows: rows.slice(start, start + pageSize),
    pagination: { page: current, totalPages, total },
  }
}
