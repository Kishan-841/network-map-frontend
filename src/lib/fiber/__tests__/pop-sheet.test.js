import { describe, it, expect } from 'vitest'
import { equipmentPayload, rackSummary, equipmentErrors, popFormErrors, isIpAddress } from '../pop-sheet'

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

  it('keeps a switch with only a model — no IP is not a reason to drop it', () => {
    const out = equipmentPayload({
      olts: [],
      devices: [{ kind: 'SWITCH', label: 'Core', model: 'CRS326', speed: '10G' }],
    })
    expect(out.devices).toEqual([
      { kind: 'SWITCH', label: 'Core', ipAddress: null, portCount: null, speed: '10G', model: 'CRS326' },
    ])
  })

  it('keeps a Mikrotik known only by name, and an FMS without a port count', () => {
    const out = equipmentPayload({
      olts: [],
      devices: [
        { kind: 'MIKROTIK', label: 'RB by the door' },
        { kind: 'FMS', label: 'FMS A' },
      ],
    })
    expect(out.devices).toEqual([
      { kind: 'MIKROTIK', label: 'RB by the door', ipAddress: null, portCount: null, speed: null, model: null },
      { kind: 'FMS', label: 'FMS A', ipAddress: null, portCount: null, speed: null, model: null },
    ])
  })

  it('never sends the literal string "undefined" for a missing IP', () => {
    const out = equipmentPayload({ olts: [], devices: [{ kind: 'SWITCH', model: 'X' }] })
    expect(out.devices[0].ipAddress).toBeNull()
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


describe('equipmentErrors', () => {
  it('flags a started OLT with no name, but ignores a blank row', () => {
    const { olts } = equipmentErrors({
      olts: [
        { ipAddress: '10.0.0.1', ponPortCount: 8 },
        { name: '', ponPortCount: 8, ipAddress: '' },
      ],
    })
    expect(olts[0].name).toMatch(/name/i)
    expect(olts[1]).toEqual({})
  })

  it('flags two OLTs sharing a name, a bad port count and a bad IP', () => {
    const { olts, count } = equipmentErrors({
      olts: [
        { name: 'OLT-1', ponPortCount: 8 },
        { name: 'olt-1', ponPortCount: 8 },
        { name: 'OLT-2', ponPortCount: 999 },
        { name: 'OLT-3', ponPortCount: 8, ipAddress: 'nope' },
      ],
    })
    expect(olts[1].name).toMatch(/already/i)
    expect(olts[2].ponPortCount).toBeTruthy()
    expect(olts[3].ipAddress).toBeTruthy()
    expect(count).toBe(3)
  })

  it('flags a switch with a malformed IP, but a model-only switch is fine', () => {
    const { devices } = equipmentErrors({
      devices: [
        { kind: 'SWITCH', ipAddress: 'somewhere' },
        { kind: 'SWITCH', model: 'CRS326' },
        { kind: 'MIKROTIK', label: 'RB' },
        { kind: 'FMS', portCount: 12 },
      ],
    })
    expect(devices[0].ipAddress).toBeTruthy()
    expect(devices[1]).toEqual({})
    expect(devices[2]).toEqual({})
    expect(devices[3]).toEqual({})
  })

  it('accepts a valid IP with a :port or /cidr suffix', () => {
    expect(isIpAddress('10.0.0.1')).toBe(true)
    expect(isIpAddress('10.0.0.1:8080')).toBe(true)
    expect(isIpAddress('10.0.0.0/24')).toBe(true)
    expect(isIpAddress('not-an-ip')).toBe(false)
  })
})

describe('popFormErrors', () => {
  const good = { name: 'Wakad POP', zoneId: 'z1', latitude: '18.6', longitude: '73.7', olts: [], devices: [] }

  it('passes a complete form', () => {
    expect(popFormErrors(good).ok).toBe(true)
  })

  it('names each missing or invalid required field', () => {
    const { fields, ok } = popFormErrors({ name: '  ', zoneId: '', latitude: '', longitude: '999' })
    expect(ok).toBe(false)
    expect(fields.name).toBeTruthy()
    expect(fields.zoneId).toBeTruthy()
    expect(fields.latitude).toBeTruthy()
    expect(fields.longitude).toBeTruthy()
  })

  it('blocks the whole form when only the rack is wrong', () => {
    const out = popFormErrors({ ...good, devices: [{ kind: 'SWITCH', ipAddress: 'bad' }] })
    expect(out.ok).toBe(false)
    expect(out.equipment.devices[0].ipAddress).toBeTruthy()
  })
})
