import { describe, expect, it } from 'vitest'
import { coordinateCardPlacement, CARD_GAP } from '../map-coordinate-card'

const card = { width: 240, height: 56 }
const map = { width: 800, height: 600 }

describe('coordinateCardPlacement', () => {
  it('centres the card above the point', () => {
    expect(coordinateCardPlacement({ x: 400, y: 300 }, map, card)).toEqual({
      left: 280,
      top: 300 - CARD_GAP - 56,
    })
  })

  it('drops below the point when there is no room above', () => {
    const { top } = coordinateCardPlacement({ x: 400, y: 20 }, map, card)
    expect(top).toBe(20 + CARD_GAP)
  })

  it('never runs off the left or right edge', () => {
    expect(coordinateCardPlacement({ x: 5, y: 300 }, map, card).left).toBe(8)
    expect(coordinateCardPlacement({ x: 795, y: 300 }, map, card).left).toBe(800 - 240 - 8)
  })

  it('stays inside a map narrower than the card', () => {
    const narrow = { width: 200, height: 600 }
    expect(coordinateCardPlacement({ x: 100, y: 300 }, narrow, card).left).toBe(8)
  })
})
