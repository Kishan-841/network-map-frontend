'use client'

import { useMemo, useState } from 'react'
import { filterRows, paginate } from '@/lib/client-table'

/**
 * Search + paging over an already-loaded list, for the fiber/closure/POP admin
 * tables. Give it the full rows, how to read a row's searchable text, and a
 * page size; get back the current page, the pager shape, and the search box's
 * state. Filtering runs on the query, then paging on the result — so a search
 * always starts from page 1 (the page number is derived, never stored stale).
 */
export function useClientTable(rows, { getSearchText, pageSize = 20 } = {}) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const filtered = useMemo(
    () => filterRows(rows ?? [], search, getSearchText),
    [rows, search, getSearchText],
  )
  const { pageRows, pagination } = paginate(filtered, page, pageSize)

  return {
    rows: pageRows,
    pagination,
    // The setter clamps nothing itself — `paginate` derives the real page each
    // render, so a stale number simply resolves to the last page.
    onPageChange: setPage,
    search,
    onSearchChange: (value) => {
      setSearch(value)
      setPage(1)
    },
  }
}
