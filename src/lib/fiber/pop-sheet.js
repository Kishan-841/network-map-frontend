/**
 * The survey sheet's fixed lists, mirroring `pop.schemas.js` on the API.
 * Kept here rather than fetched: they are a purchasing decision, not data, and
 * a form that cannot render its own options until a request lands is worse.
 */
import { parseLatitude, parseLongitude } from './coords'

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


// A typo-catcher that MUST agree with the API's own loose check
// (`pop.schemas.js`): IPv4 with an optional /cidr or :port. If the two drift,
// the form either blocks something the server would take or waves through
// something it rejects — and the user learns about it only from a raw 400.
const IP_RE = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?(:\d{1,5})?$/
export const isIpAddress = (v) => IP_RE.test(String(v ?? '').trim())

const filled = (v) => v != null && String(v).trim() !== ''
// A row the user has actually started. A blank one (an "Add" click, then a
// change of mind) is dropped on save, so it carries no error — only a started
// row that cannot be stored is flagged.
const oltStarted = (o) => filled(o.name) || filled(o.ipAddress) || filled(o.model)
const deviceStarted = (d) =>
  filled(d.label) || filled(d.ipAddress) || filled(d.model) || filled(d.speed) || d.portCount != null

/**
 * Every problem in the rack the API would reject, found before it is sent, so
 * nothing the user typed is dropped in silence and nothing wrong slips through.
 * Returns an error map per row, indexed like the input arrays (`{}` where a row
 * is fine), and a total `count`.
 */
export function equipmentErrors({ olts = [], devices = [] } = {}) {
  const seen = new Set()
  const oltRows = olts.map((olt) => {
    const e = {}
    if (!oltStarted(olt)) return e
    const name = String(olt.name ?? '').trim()
    if (!name) e.name = 'Add a name to keep this OLT'
    else {
      const key = name.toLowerCase()
      if (seen.has(key)) e.name = 'Another OLT already has this name'
      seen.add(key)
    }
    const ports = Number(olt.ponPortCount)
    if (!Number.isInteger(ports) || ports < 1 || ports > 256) e.ponPortCount = 'PON ports must be 1–256'
    if (filled(olt.ipAddress) && !isIpAddress(olt.ipAddress)) e.ipAddress = 'Must look like 10.0.0.1'
    return e
  })
  const deviceRows = devices.map((device) => {
    const e = {}
    if (!deviceStarted(device)) return e
    if (device.kind !== 'FMS' && filled(device.ipAddress) && !isIpAddress(device.ipAddress)) {
      e.ipAddress = 'Must look like 10.0.0.1'
    }
    if (device.kind === 'FMS' && device.portCount != null && !FMS_PORT_COUNTS.includes(Number(device.portCount))) {
      e.portCount = 'Ports must be 12, 24, 48 or 96'
    }
    return e
  })
  const count = [...oltRows, ...deviceRows].reduce((n, e) => n + Object.keys(e).length, 0)
  return { olts: oltRows, devices: deviceRows, count }
}

/**
 * The whole POP form's errors — the required fields and the rack together.
 * `ok` is the one thing the Save button asks: may this be submitted?
 */
export function popFormErrors(form) {
  const fields = {}
  if (!String(form?.name ?? '').trim()) fields.name = 'Give the POP a name'
  if (!form?.zoneId) fields.zoneId = 'Choose the zone this POP sits in'
  if (parseLatitude(form?.latitude) === null) fields.latitude = 'Enter a latitude between −90 and 90'
  if (parseLongitude(form?.longitude) === null) fields.longitude = 'Enter a longitude between −180 and 180'
  const equipment = equipmentErrors({ olts: form?.olts ?? [], devices: form?.devices ?? [] })
  return { fields, equipment, ok: Object.keys(fields).length === 0 && equipment.count === 0 }
}
