import { describe, it, expect } from 'vitest'
import { distanceLabel, feedPatch, placementLabel, splitterPlaceBody, splitterPlaceError, splitterWhere } from '../splitter-place'

describe('placementLabel', () => {
  it('names where in the building, with the floor number for a floor', () => {
    expect(placementLabel({ placement: 'TERRACE' })).toBe('Terrace')
    expect(placementLabel({ placement: 'FLOOR', floorNumber: 3 })).toBe('Floor 3')
    expect(placementLabel({ placement: 'GROUND' })).toBe('Ground')
    expect(placementLabel({ placement: 'BASEMENT' })).toBe('Basement')
    expect(placementLabel({ placement: null })).toBeNull()
  })
})

describe('splitterPlaceError', () => {
  it('needs a whole floor number from 1 to 200 for Floor only', () => {
    expect(splitterPlaceError({ placement: 'FLOOR', floorNumber: '' })).toBe('Which floor?')
    expect(splitterPlaceError({ placement: 'FLOOR', floorNumber: '0' })).toBe('Floor must be from 1 to 200')
    expect(splitterPlaceError({ placement: 'FLOOR', floorNumber: '2.5' })).toBe('Floor must be from 1 to 200')
    expect(splitterPlaceError({ placement: 'FLOOR', floorNumber: '201' })).toBe('Floor must be from 1 to 200')
    expect(splitterPlaceError({ placement: 'FLOOR', floorNumber: '7' })).toBeNull()
    expect(splitterPlaceError({ placement: 'TERRACE', floorNumber: '' })).toBeNull()
    expect(splitterPlaceError({ placement: '', floorNumber: '' })).toBeNull()
  })
})

describe('splitterPlaceBody', () => {
  it('sends the floor only with Floor, a trimmed note, and nulls for blanks', () => {
    expect(splitterPlaceBody({ wingId: 'w1', placement: 'FLOOR', floorNumber: '7', note: '  by the lift ' }))
      .toEqual({ wingId: 'w1', placement: 'FLOOR', floorNumber: 7, note: 'by the lift' })
    expect(splitterPlaceBody({ wingId: '', placement: 'GROUND', floorNumber: '7', note: '   ' }))
      .toEqual({ wingId: null, placement: 'GROUND', floorNumber: null, note: null })
    expect(splitterPlaceBody({ wingId: '', placement: '', floorNumber: '', note: '' }))
      .toEqual({ wingId: null, placement: null, floorNumber: null, note: null })
  })
})

describe('splitterWhere', () => {
  it('says where a splitter is: building (wing, place), closure, or line', () => {
    expect(splitterWhere({ building: { buildingName: 'Sai Heights' }, wing: { name: 'B' }, placement: 'FLOOR', floorNumber: 3 }))
      .toBe('Sai Heights · Wing B · Floor 3')
    expect(splitterWhere({ building: { buildingName: 'Sai Heights' } })).toBe('Sai Heights')
    expect(splitterWhere({ closure: { code: 'JC-0012' } })).toBe('Closure JC-0012')
    expect(splitterWhere({ onFiber: { name: 'FIB-22' } })).toBe('On FIB-22')
    expect(splitterWhere({})).toBe('—')
  })
})

describe('distanceLabel', () => {
  it('reads metres, or km past 1000', () => {
    expect(distanceLabel(35)).toBe('35 m')
    expect(distanceLabel(1250)).toBe('1.3 km')
    expect(distanceLabel(null)).toBeNull()
  })
})

describe('feedPatch', () => {
  it('always sends the feed when adding', () => {
    expect(feedPatch({ adding: true, before: null, chosen: 'f1' })).toEqual({ inputFiberId: 'f1' })
    expect(feedPatch({ adding: true, before: null, chosen: null })).toEqual({ inputFiberId: null })
  })
  it('sends it on an edit only when it changed — a feed the form could not see is never wiped', () => {
    expect(feedPatch({ adding: false, before: null, chosen: null })).toEqual({})
    expect(feedPatch({ adding: false, before: 'f1', chosen: 'f1' })).toEqual({})
    expect(feedPatch({ adding: false, before: 'f1', chosen: null })).toEqual({ inputFiberId: null })
    expect(feedPatch({ adding: false, before: null, chosen: 'f2' })).toEqual({ inputFiberId: 'f2' })
  })
})
