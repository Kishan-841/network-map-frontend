import { describe, it, expect } from 'vitest'
import { DEFAULT_CENTRE, parseLatitude, parseLongitude } from '../coords'

describe('parsing a typed coordinate', () => {
  it('reads a real number', () => {
    expect(parseLatitude('18.5204')).toBe(18.5204)
    expect(parseLongitude('73.8567')).toBe(73.8567)
    expect(parseLatitude(-33.9)).toBe(-33.9)
  })

  it('treats an empty field as nothing, NOT as zero', () => {
    // Number('') is 0, so a blank box used to read as a valid coordinate and
    // the map opened in the Gulf of Guinea.
    expect(parseLatitude('')).toBeNull()
    expect(parseLatitude('   ')).toBeNull()
    expect(parseLatitude(null)).toBeNull()
    expect(parseLatitude(undefined)).toBeNull()
  })

  it('still accepts a deliberate zero', () => {
    expect(parseLatitude('0')).toBe(0)
    expect(parseLongitude('0.0')).toBe(0)
  })

  it('refuses what is not a coordinate', () => {
    expect(parseLatitude('north')).toBeNull()
    expect(parseLatitude('91')).toBeNull()
    expect(parseLatitude('-91')).toBeNull()
    expect(parseLongitude('181')).toBeNull()
    expect(parseLongitude('-181')).toBeNull()
  })

  it('starts a blank map on Pune, where the network is', () => {
    expect(DEFAULT_CENTRE.latitude).toBeCloseTo(18.5204, 3)
    expect(DEFAULT_CENTRE.longitude).toBeCloseTo(73.8567, 3)
  })
})
