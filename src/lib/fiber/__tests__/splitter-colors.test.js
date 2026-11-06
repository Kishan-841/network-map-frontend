import { describe, it, expect } from 'vitest'
import { POINT_COLORS, SPLITTER_TYPE_COLORS, splitterColor } from '../constants.js'
import { typedMarkerIcon } from '../markers.js'

const svgOf = (icon) => decodeURIComponent(icon.url.replace('data:image/svg+xml;charset=UTF-8,', ''))

describe('splitter type colours', () => {
  it('gives S1, S2 and S3 three different fixed colours', () => {
    const colors = ['S1', 'S2', 'S3'].map(splitterColor)
    expect(new Set(colors).size).toBe(3)
    expect(colors).toEqual([SPLITTER_TYPE_COLORS.S1, SPLITTER_TYPE_COLORS.S2, SPLITTER_TYPE_COLORS.S3])
  })

  it('keeps S1 the familiar splitter orange', () => {
    expect(SPLITTER_TYPE_COLORS.S1).toBe(POINT_COLORS.SPLITTER)
  })

  it('does not reuse a POP, closure or building colour', () => {
    for (const c of Object.values(SPLITTER_TYPE_COLORS)) {
      expect([POINT_COLORS.POP, POINT_COLORS.CLOSURE, POINT_COLORS.BUILDING]).not.toContain(c)
    }
  })

  it('falls back to the plain splitter colour when the type is unknown', () => {
    expect(splitterColor(null)).toBe(POINT_COLORS.SPLITTER)
    expect(splitterColor('S9')).toBe(POINT_COLORS.SPLITTER)
  })
})

describe('typedMarkerIcon colour override', () => {
  it('draws a splitter in the given colour and caches each colour apart', () => {
    const s2 = typedMarkerIcon('SPLITTER', { color: SPLITTER_TYPE_COLORS.S2 })
    const s3 = typedMarkerIcon('SPLITTER', { color: SPLITTER_TYPE_COLORS.S3 })
    expect(svgOf(s2)).toContain(`fill="${SPLITTER_TYPE_COLORS.S2}"`)
    expect(svgOf(s3)).toContain(`fill="${SPLITTER_TYPE_COLORS.S3}"`)
    expect(svgOf(typedMarkerIcon('SPLITTER'))).toContain(`fill="${POINT_COLORS.SPLITTER}"`)
  })
})
