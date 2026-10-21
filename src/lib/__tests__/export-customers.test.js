import { describe, it, expect } from 'vitest'
import { isTruncated } from '../export-customers'

describe('isTruncated', () => {
  it('reads the lowercased header', () => {
    expect(isTruncated({ 'x-truncated': 'true' })).toBe(true)
    expect(isTruncated({ 'x-truncated': 'false' })).toBe(false)
    expect(isTruncated({})).toBe(false)
    expect(isTruncated(undefined)).toBe(false)
  })
})
