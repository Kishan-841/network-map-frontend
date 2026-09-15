import { describe, expect, it } from 'vitest'
import { nearestPointOnPath } from '../line-hit.js'

// A right-angle path: (0,0) → (100,0) → (100,100).
const PATH = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
]

describe('nearestPointOnPath', () => {
  it('projects a click near the middle of a segment onto that segment', () => {
    const hit = nearestPointOnPath(PATH, { x: 50, y: 6 })
    expect(hit).toEqual({ index: 0, x: 50, y: 0, distance: 6 })
  })

  it('reports the second segment for a click beside it', () => {
    const hit = nearestPointOnPath(PATH, { x: 104, y: 70 })
    expect(hit.index).toBe(1)
    expect(hit.x).toBe(100)
    expect(hit.y).toBe(70)
  })

  it('returns null beyond maxPx', () => {
    expect(nearestPointOnPath(PATH, { x: 50, y: 40 })).toBeNull()
    expect(nearestPointOnPath(PATH, { x: 50, y: 13 })).toBeNull()
    expect(nearestPointOnPath(PATH, { x: 50, y: 40 }, 50)).not.toBeNull()
  })

  it('gives a click exactly on a shared vertex to the segment before it', () => {
    const hit = nearestPointOnPath(PATH, { x: 100, y: 0 })
    expect(hit).toEqual({ index: 0, x: 100, y: 0, distance: 0 })
  })

  it('has nothing to project onto without at least two points', () => {
    expect(nearestPointOnPath([], { x: 0, y: 0 })).toBeNull()
    expect(nearestPointOnPath([{ x: 0, y: 0 }], { x: 0, y: 0 })).toBeNull()
    expect(nearestPointOnPath(null, { x: 0, y: 0 })).toBeNull()
  })

  it('handles a zero-length segment without dividing by zero', () => {
    const hit = nearestPointOnPath([{ x: 10, y: 10 }, { x: 10, y: 10 }], { x: 12, y: 10 })
    expect(hit).toEqual({ index: 0, x: 10, y: 10, distance: 2 })
  })
})
