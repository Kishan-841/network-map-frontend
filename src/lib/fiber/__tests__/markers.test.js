import { describe, it, expect } from 'vitest'
import { typedMarkerIcon, markerLabel, labelBadgeIcon } from '../markers.js'

describe('typedMarkerIcon', () => {
  it('returns the same cached object for the same args', () => {
    const a = typedMarkerIcon('POP', { selected: false, size: 18 })
    const b = typedMarkerIcon('POP', { selected: false, size: 18 })
    expect(a).toBe(b)
  })

  it('returns different URLs for different kinds', () => {
    const pop = typedMarkerIcon('POP')
    const closure = typedMarkerIcon('CLOSURE')
    const splitter = typedMarkerIcon('SPLITTER')
    const waypoint = typedMarkerIcon('WAYPOINT')
    const building = typedMarkerIcon('BUILDING')
    const snapRing = typedMarkerIcon('SNAP_RING')
    const urls = [pop.url, closure.url, splitter.url, waypoint.url, building.url, snapRing.url]
    expect(new Set(urls).size).toBe(urls.length)
  })

  it('draws BUILDING in its own colour', () => {
    expect(typedMarkerIcon('BUILDING').url).toContain('%2322c55e')
  })

  it('produces a data URI SVG', () => {
    const { url } = typedMarkerIcon('POP')
    expect(url.startsWith('data:image/svg+xml')).toBe(true)
  })

  it('selected icons are larger than unselected ones', () => {
    const unselected = typedMarkerIcon('CLOSURE', { selected: false, size: 18 })
    const selected = typedMarkerIcon('CLOSURE', { selected: true, size: 18 })
    expect(selected.size).toBeGreaterThan(unselected.size)
  })

  it('returns a centre anchor', () => {
    const icon = typedMarkerIcon('SPLITTER', { size: 20 })
    expect(icon.anchor).toEqual({ x: icon.size / 2, y: icon.size / 2 })
  })

  it('throws for an unknown kind', () => {
    expect(() => typedMarkerIcon('BOGUS')).toThrow('Unknown marker kind: BOGUS')
  })
})

describe('markerLabel', () => {
  it('returns the expected label object', () => {
    expect(markerLabel('JC-0001')).toEqual({
      text: 'JC-0001',
      color: '#ffffff',
      fontSize: '11px',
      fontWeight: '700',
      className: 'fiber-zone-label',
    })
  })
})

describe('labelBadgeIcon', () => {
  const svgOf = (icon) => decodeURIComponent(icon.url.replace('data:image/svg+xml;charset=UTF-8,', ''))

  it('returns the same cached object for the same text and tone', () => {
    expect(labelBadgeIcon('JC-0001')).toBe(labelBadgeIcon('JC-0001'))
    expect(labelBadgeIcon('JC-0001', { tone: 'light' })).toBe(labelBadgeIcon('JC-0001'))
  })

  it('grows wider with longer text', () => {
    const short = labelBadgeIcon('S1')
    const long = labelBadgeIcon('S12 \u00b7 1:16')
    expect(long.width).toBeGreaterThan(short.width)
  })

  it('never goes below the minimum width', () => {
    expect(labelBadgeIcon('A').width).toBe(28)
  })

  it('escapes XML-significant characters', () => {
    const svg = svgOf(labelBadgeIcon('R&D <hut>'))
    expect(svg).toContain('R&amp;D &lt;hut&gt;')
    expect(svg).not.toContain('R&D')
  })

  it('draws the dark tone differently from the light one', () => {
    const light = labelBadgeIcon('JC-0002')
    const dark = labelBadgeIcon('JC-0002', { tone: 'dark' })
    expect(dark.url).not.toBe(light.url)
    expect(dark.width).toBe(light.width)
    expect(svgOf(dark)).toContain('fill="#ffffff"') // white text
  })

  it('anchors below the image so the pointer floats above the symbol', () => {
    const icon = labelBadgeIcon('JC-0003')
    expect(icon.height).toBe(27)
    expect(icon.anchor).toEqual({ x: icon.width / 2, y: icon.height + 11 })
  })

  it('produces a data URI SVG', () => {
    expect(labelBadgeIcon('POP A').url.startsWith('data:image/svg+xml')).toBe(true)
  })
})
