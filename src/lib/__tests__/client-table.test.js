import { describe, it, expect } from 'vitest'
import { filterRows, paginate } from '../client-table'

const rows = [
  { name: 'Wakad POP-1', zone: 'Wakad West' },
  { name: 'Baner Server', zone: 'Baner' },
  { name: 'Hinjewadi 100G', zone: 'Hinjewadi Phase 1' },
]
const text = (r) => [r.name, r.zone]

describe('filterRows', () => {
  it('returns everything for a blank query', () => {
    expect(filterRows(rows, '', text)).toHaveLength(3)
    expect(filterRows(rows, '   ', text)).toHaveLength(3)
  })

  it('matches case-insensitively across the searchable fields', () => {
    expect(filterRows(rows, 'baner', text).map((r) => r.name)).toEqual(['Baner Server'])
    expect(filterRows(rows, 'WAKAD', text)).toHaveLength(1) // matches name or zone
  })

  it('requires every word, in any order, ignoring extra spaces', () => {
    expect(filterRows(rows, 'pop wakad', text).map((r) => r.name)).toEqual(['Wakad POP-1'])
    expect(filterRows(rows, '  100g   hinjewadi ', text)).toHaveLength(1)
  })

  it('skips nullish parts without throwing', () => {
    expect(filterRows([{ name: 'X', zone: null }], 'x', text)).toHaveLength(1)
  })
})

describe('paginate', () => {
  const list = Array.from({ length: 45 }, (_, i) => i + 1)

  it('cuts the requested page and reports the shape Pagination reads', () => {
    const { pageRows, pagination } = paginate(list, 2, 20)
    expect(pageRows).toEqual(Array.from({ length: 20 }, (_, i) => i + 21))
    expect(pagination).toEqual({ page: 2, totalPages: 3, total: 45 })
  })

  it('clamps a page past the end back to the last real page', () => {
    expect(paginate(list, 99, 20).pagination.page).toBe(3)
    expect(paginate(list, 0, 20).pagination.page).toBe(1)
  })

  it('is always at least one page, even when empty', () => {
    expect(paginate([], 1, 20)).toEqual({ pageRows: [], pagination: { page: 1, totalPages: 1, total: 0 } })
  })
})
