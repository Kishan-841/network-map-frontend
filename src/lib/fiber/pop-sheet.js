/**
 * The survey sheet's fixed lists, mirroring `pop.schemas.js` on the API.
 * Kept here rather than fetched: they are a purchasing decision, not data, and
 * a form that cannot render its own options until a request lands is worse.
 */
export const RACK_SIZES = ['3U', '4U', '7U', '12U', '16U', '20U', '22U', '27U', '30U', '32U', '35U', '40U']
// 0 counts: a UPS with no batteries left in it is worth recording.
export const UPS_BATTERY_COUNTS = [0, 1, 2, 4]
export const FMS_PORT_COUNTS = [12, 24, 48, 96]
export const SWITCH_SPEEDS = ['1G', '10G']
export const OLT_TYPES = ['GPON', 'EPON']

export const RACK_CONDITION_LABELS = { OK: 'OK', DAMAGED: 'Damaged' }

/** A one-line summary of what is in a rack, for a table cell. */
export function rackSummary(pop) {
  const bits = [
    pop?.rackSize,
    pop?.rackCondition ? RACK_CONDITION_LABELS[pop.rackCondition] ?? pop.rackCondition : null,
    pop?.upsBatteryCount ? `${pop.upsBatteryCount} battery` : null,
  ].filter(Boolean)
  return bits.length > 0 ? bits.join(' · ') : null
}

/**
 * Form rows → what the API takes. Blank rows are dropped rather than rejected:
 * pressing "Add Switch" and changing your mind should not block the save.
 */
export function equipmentPayload({ olts, devices }) {
  return {
    olts: olts
      .filter((olt) => String(olt.name ?? '').trim())
      .map((olt) => ({
        ...(olt.id && { id: olt.id }),
        name: String(olt.name).trim(),
        ponPortCount: Number(olt.ponPortCount) || 1,
        ipAddress: String(olt.ipAddress ?? '').trim() || null,
        type: olt.type || null,
        model: String(olt.model ?? '').trim() || null,
      })),
    devices: devices
      // Keep a device the moment it carries anything at all — a name, an IP, a
      // model, a speed or a port count. No single field is required: a switch
      // known only by its model is real kit, and dropping it silently is how a
      // survey loses data. Only a wholly blank row (an "Add" click, then a
      // change of mind) falls away.
      .filter((device) => {
        const has = (v) => String(v ?? '').trim() !== ''
        return (
          has(device.label) ||
          has(device.ipAddress) ||
          has(device.model) ||
          has(device.speed) ||
          device.portCount != null
        )
      })
      .map((device) => ({
        ...(device.id && { id: device.id }),
        kind: device.kind,
        label: String(device.label ?? '').trim() || null,
        // An FMS has no address; a switch/Mikrotik may simply not have one yet.
        // `?? ''` guards the empty case — String(undefined) would send "undefined".
        ipAddress: device.kind === 'FMS' ? null : String(device.ipAddress ?? '').trim() || null,
        portCount: device.kind === 'FMS' && device.portCount != null ? Number(device.portCount) : null,
        // Speed is a switch's business; the model is anyone's.
        speed: device.kind === 'SWITCH' ? device.speed || null : null,
        model: device.kind === 'FMS' ? null : String(device.model ?? '').trim() || null,
      })),
  }
}
