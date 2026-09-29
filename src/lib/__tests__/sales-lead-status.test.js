import { describe, it, expect } from 'vitest'
import { LEAD_STATUSES, leadStatusLabel } from '../sales-lead-status'

describe('sales-lead-status', () => {
  it('has the four lead statuses in order', () => {
    expect(LEAD_STATUSES.map((s) => s.value)).toEqual(['NOT_CONTACTED', 'FOLLOW_UP', 'COMPLETED', 'NOT_INTERESTED'])
  })
  it('labels a status in the sales person’s words', () => {
    expect(leadStatusLabel('NOT_CONTACTED')).toBe('New')
    expect(leadStatusLabel('FOLLOW_UP')).toBe('Follow-up')
    expect(leadStatusLabel('COMPLETED')).toBe('Completed')
    expect(leadStatusLabel('NOT_INTERESTED')).toBe('Not interested')
  })
  it('reads an unknown value straight back', () => {
    expect(leadStatusLabel('WEIRD')).toBe('WEIRD')
    expect(leadStatusLabel(null)).toBe('')
  })
})
