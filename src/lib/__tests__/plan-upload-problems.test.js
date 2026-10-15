import { describe, it, expect } from 'vitest'
import { planProblems } from '../plan-upload-problems'

const row = (rowNumber, o = {}) => ({ rowNumber, employee: 'Raj', building: 'Tower', ...o })
const ok = { state: 'ok', errors: [], employee: { match: { id: 'u' } }, building: { match: { id: 'b' } } }

describe('planProblems', () => {
  it('lists every row that is not ready, in sheet order, with its reasons', () => {
    const rows = [row(2), row(5), row(9), row(100)]
    const items = {
      2: ok,
      5: { state: 'error', errors: ['Date "31-02-2026" is not a date'], employee: { match: { id: 'u' } }, building: { match: { id: 'b' } } },
      9: ok,
      100: { state: 'fix', errors: [], employee: { match: null }, building: { match: { id: 'b' } } },
    }
    expect(planProblems(rows, items)).toEqual([
      { rowNumber: 5, state: 'error', messages: ['Date "31-02-2026" is not a date'] },
      { rowNumber: 100, state: 'fix', messages: ['Employee "Raj" not found — pick a person'] },
    ])
  })

  it('names both a missing person and a missing building', () => {
    const items = { 3: { state: 'fix', errors: [], employee: { match: null }, building: { match: null } } }
    expect(planProblems([row(3, { employee: '', building: 'X' })], items)[0].messages).toEqual([
      'Employee "missing" not found — pick a person',
      'Building "X" not found — pick one',
    ])
  })

  it('skips rows not yet checked, swapped since, or with a pick waiting for a re-check', () => {
    const bad = { state: 'error', errors: ['bad'], employee: {}, building: {} }
    const rows = [row(1), row(2), row(3), row(4)]
    const items = { 2: bad, 3: bad, 4: bad }
    expect(planProblems(rows, items, { outdated: { 2: true }, pendingPick: { 3: true } }).map((p) => p.rowNumber)).toEqual([4])
  })

  it('never returns an empty reason', () => {
    expect(planProblems([row(7)], { 7: { state: 'error', errors: [], employee: {}, building: {} } })[0].messages).toEqual(['Cannot be saved'])
  })
})
