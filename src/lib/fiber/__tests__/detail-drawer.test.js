import { describe, it, expect } from 'vitest'
import { openEntry, pushEntry, backEntry } from '../detail-stack'
import { shown, formatWhen, coordText, mapsUrl, addedBy, NOT_RECORDED } from '../detail-format'

const pop = { kind: 'pop', id: 'p1' }
const fiber = { kind: 'fiber', id: 'f1' }
const closure = { kind: 'closure', id: 'c1' }

describe('detail drawer history', () => {
  it('a fresh click starts a new history', () => {
    expect(openEntry([closure, fiber], pop)).toEqual([pop])
  })

  it('a link inside the drawer goes one step deeper, and Back returns', () => {
    const stack = pushEntry(pushEntry([closure], fiber), pop)
    expect(stack).toEqual([closure, fiber, pop])
    expect(backEntry(stack)).toEqual([closure, fiber])
  })

  it('following a link back to something already open unwinds instead of looping', () => {
    expect(pushEntry([closure, fiber], closure)).toEqual([closure])
  })

  it('ignores opening what is already on top, and anything malformed', () => {
    const stack = [fiber]
    expect(pushEntry(stack, fiber)).toBe(stack)
    expect(openEntry(stack, { kind: 'zone', id: 'z1' })).toBe(stack)
    expect(pushEntry(stack, { kind: 'pop' })).toBe(stack)
  })
})

describe('detail drawer formatting', () => {
  it('shows a blank answer as not recorded, but keeps a real zero', () => {
    expect(shown(null)).toBe(NOT_RECORDED)
    expect(shown('  ')).toBe(NOT_RECORDED)
    expect(shown(0)).toBe(0)
    expect(shown('12U')).toBe('12U')
  })

  it('formats a date in India time and survives a bad one', () => {
    expect(formatWhen('2026-09-19T12:02:00Z')).toMatch(/19 Sept? 2026/)
    expect(formatWhen('2026-09-19T12:02:00Z')).toMatch(/5:32/)
    expect(formatWhen('nonsense')).toBe(NOT_RECORDED)
  })

  it('writes coordinates to six places and links them to Maps', () => {
    expect(coordText(18.5204, 73.8567)).toBe('18.520400, 73.856700')
    expect(mapsUrl(18.5, 73.8)).toContain('query=18.5,73.8')
    expect(mapsUrl(null, 73.8)).toBeNull()
    expect(coordText(undefined, 1)).toBe(NOT_RECORDED)
  })

  it('names who added a record, or says why it cannot', () => {
    expect(addedBy({ createdBy: { name: 'Asha' } })).toBe('Asha')
    expect(addedBy({ createdBy: null })).toMatch(/Unknown/)
  })
})
