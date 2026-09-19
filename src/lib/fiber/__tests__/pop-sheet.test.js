import { describe, it, expect } from 'vitest'
import { equipmentPayload, rackSummary } from '../pop-sheet'

describe('rackSummary', () => {
  it('reads the rack in one line', () => {
    expect(rackSummary({ rackSize: '22U', rackCondition: 'OK', upsBatteryCount: 2 })).toBe(
      '22U · OK · 2 battery',
    )
  })

  it('says only what is recorded', () => {
    expect(rackSummary({ rackSize: '16U' })).toBe('16U')
    expect(rackSummary({ rackCondition: 'DAMAGED' })).toBe('Damaged')
  })

  it('is null when the sheet is empty, so the table can show a dash', () => {
    expect(rackSummary({})).toBeNull()
    expect(rackSummary(null)).toBeNull()
  })
})

describe('equipmentPayload', () => {
  it('keeps the id of a row that came from the server, so it is updated not replaced', () => {
    const out = equipmentPayload({
      olts: [{ id: 'olt1', name: 'OLT-1', ponPortCount: '8', ipAddress: ' 10.0.1.1 ' }],
      devices: [{ id: 'd1', kind: 'SWITCH', label: ' SW ', ipAddress: '10.0.0.1' }],
    })
    expect(out.olts[0]).toEqual({
      id: 'olt1',
      name: 'OLT-1',
      ponPortCount: 8,
      ipAddress: '10.0.1.1',
      type: null,
      model: null,
    })
    expect(out.devices[0]).toEqual({
      id: 'd1',
      kind: 'SWITCH',
      label: 'SW',
      ipAddress: '10.0.0.1',
      portCount: null,
      speed: null,
      model: null,
    })
  })

  it('drops a row somebody added and left blank rather than failing the save', () => {
    const out = equipmentPayload({
      olts: [{ name: '   ', ponPortCount: 8 }],
      devices: [
        { kind: 'SWITCH', label: '', ipAddress: '' },
        { kind: 'FMS', portCount: 24 },
      ],
    })
    expect(out.olts).toEqual([])
    expect(out.devices).toEqual([
      { kind: 'FMS', label: null, ipAddress: null, portCount: 24, speed: null, model: null },
    ])
  })
})

describe('equipmentPayload, the make and model', () => {
  it('carries a switch speed and model, and an OLT type', async () => {
    const { equipmentPayload } = await import('../pop-sheet')
    const out = equipmentPayload({
      olts: [{ name: 'OLT-G', ponPortCount: 16, type: 'GPON', model: ' C320 ' }],
      devices: [{ kind: 'SWITCH', ipAddress: '10.0.0.1', speed: '10G', model: 'CRS326' }],
    })
    expect(out.olts[0]).toMatchObject({ type: 'GPON', model: 'C320' })
    expect(out.devices[0]).toMatchObject({ speed: '10G', model: 'CRS326' })
  })

  it('does not put a speed on a mikrotik or an FMS — that is a switch\'s business', async () => {
    const { equipmentPayload } = await import('../pop-sheet')
    const out = equipmentPayload({
      olts: [],
      devices: [
        { kind: 'MIKROTIK', ipAddress: '10.0.0.2', speed: '10G', model: 'RB4011' },
        { kind: 'FMS', portCount: 24, model: 'nope' },
      ],
    })
    expect(out.devices[0]).toMatchObject({ speed: null, model: 'RB4011' })
    expect(out.devices[1]).toMatchObject({ speed: null, model: null })
  })
})

