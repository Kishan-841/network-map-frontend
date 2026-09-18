import { describe, it, expect } from 'vitest'
import { focusPoints } from '../focus-target'

describe('focusPoints', () => {
  it('reads a single point', () => {
    expect(focusPoints({ latitude: 18.5, longitude: 73.8 })).toEqual([{ lat: 18.5, lng: 73.8 }])
  })

  it('reads the Maps spelling too', () => {
    expect(focusPoints({ lat: 18.5, lng: 73.8 })).toEqual([{ lat: 18.5, lng: 73.8 }])
  })

  it('reads a whole line, so a fiber can be framed rather than centred', () => {
    const line = [
      { latitude: 18.5, longitude: 73.8 },
      { latitude: 18.6, longitude: 73.9 },
    ]
    expect(focusPoints(line)).toHaveLength(2)
  })

  it('drops points that are not real coordinates rather than framing the ocean', () => {
    const line = [
      { latitude: 18.5, longitude: 73.8 },
      { latitude: null, longitude: 73.9 },
      { latitude: 'x', longitude: 73.9 },
    ]
    expect(focusPoints(line)).toEqual([{ lat: 18.5, lng: 73.8 }])
  })

  it('is empty for nothing usable, so the caller can do nothing', () => {
    expect(focusPoints(null)).toEqual([])
    expect(focusPoints([])).toEqual([])
    expect(focusPoints({})).toEqual([])
    expect(focusPoints({ latitude: 0, longitude: 0 })).toEqual([{ lat: 0, lng: 0 }])
  })
})
