import { describe, it, expect } from 'vitest'
import { compareSemver, isSemver, sortReleases } from '../app-releases'

describe('app releases helpers', () => {
  it('validates and compares versions numerically', () => {
    expect(isSemver('1.10.0')).toBe(true)
    expect(isSemver('1.2')).toBe(false)
    expect(compareSemver('1.10.0', '1.9.0')).toBe(1)
  })
  it('sorts releases highest version first', () => {
    expect(sortReleases([{ version: '1.9.0' }, { version: '1.10.0' }, { version: '1.2.0' }]).map((r) => r.version)).toEqual(['1.10.0', '1.9.0', '1.2.0'])
  })
})
