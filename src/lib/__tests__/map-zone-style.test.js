import { describe, expect, it } from 'vitest'
import { IMAGERY_ZONE_COLORS, isImageryLayer, zoneLabel, zoneLook } from '../map-zone-style'
import { ZONE_COLORS } from '../constants'

describe('isImageryLayer', () => {
  it('is true for satellite and hybrid only', () => {
    expect(isImageryLayer('satellite')).toBe(true)
    expect(isImageryLayer('hybrid')).toBe(true)
    expect(isImageryLayer('roadmap')).toBe(false)
    expect(isImageryLayer(undefined)).toBe(false)
  })
})

describe('zoneLook', () => {
  it('uses the plain-map palette and colours the name on roadmap', () => {
    const look = zoneLook('roadmap', 1)
    expect(look.color).toBe(ZONE_COLORS[1])
    expect(look.labelColor).toBe(ZONE_COLORS[1])
    expect(look.labelClass).toBeUndefined()
  })

  it('on imagery uses a soft colour, a barely-there fill and a white shadowed name', () => {
    const look = zoneLook('hybrid', 0)
    expect(look.color).toBe(IMAGERY_ZONE_COLORS[0])
    expect(look.fillOpacity).toBeLessThanOrEqual(0.1)
    expect(look.labelColor).toBe('#ffffff')
    expect(look.labelClass).toBe('zone-name-soft')
    expect(zoneLook('satellite', 0)).toEqual(look)
  })

  it('has no loud extras: no dark outline, thin dots', () => {
    for (const layer of ['roadmap', 'hybrid']) {
      const look = zoneLook(layer, 0)
      expect(look).not.toHaveProperty('halo')
      expect(look.dotScale).toBeLessThanOrEqual(2)
    }
  })

  it('uses only cool hues (blue-violet-magenta), the opposite of tan, brown and green imagery', () => {
    const hue = (hex) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      const max = Math.max(r, g, b)
      const d = max - Math.min(r, g, b)
      const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
      return (h * 60 + 360) % 360
    }
    for (const color of IMAGERY_ZONE_COLORS) {
      expect(hue(color)).toBeGreaterThanOrEqual(190)
      expect(hue(color)).toBeLessThanOrEqual(310)
    }
  })

  it('cycles the imagery palette', () => {
    expect(zoneLook('hybrid', IMAGERY_ZONE_COLORS.length).color).toBe(IMAGERY_ZONE_COLORS[0])
  })
})

describe('zoneLabel', () => {
  it('is the upper-cased name in the look colour, with the shadow class on imagery', () => {
    expect(zoneLabel('Pimple Saudagar', zoneLook('hybrid', 0))).toEqual({
      text: 'PIMPLE SAUDAGAR',
      color: '#ffffff',
      fontSize: '11px',
      fontWeight: '600',
      className: 'zone-name-soft',
    })
    expect(zoneLabel('a', zoneLook('roadmap', 0))).not.toHaveProperty('className')
  })
})
