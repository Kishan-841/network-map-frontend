/**
 * Turn the loaded POPs (each with its zone and OLTs) into a flat list of OLT
 * options for the "Assign OLT" dropdown. `GET /pops` is already scoped to what
 * the user may see, so a surveyor's options are only their zones' OLTs. When a
 * `zoneId` is given the list is narrowed to that zone (used to keep a bulk
 * assignment inside one zone).
 */
export function oltOptionsFromPops(pops, zoneId = null) {
  const options = []
  for (const pop of pops ?? []) {
    const zones = pop.zones ?? []
    const zoneIds = zones.map((z) => z.id)
    if (zoneId && !zoneIds.includes(zoneId)) continue
    for (const olt of pop.olts ?? []) {
      options.push({
        id: olt.id,
        name: olt.name,
        ponPortCount: olt.ponPortCount,
        zoneIds,
        zoneNames: zones.map((z) => z.name),
        zoneName: zones[0]?.name ?? null, // for the admin's dropdown label
        popName: pop.name,
      })
    }
  }
  return options.sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Turn a comma-separated PON string ("1, 2 ,3") into a clean, deduped,
 * ascending list of ports, each within 1..max. Mirrors the server's rule so
 * the form never sends what the API would reject. Returns { ports, error }.
 */
export function parsePonPorts(text, max) {
  const parts = String(text ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '')
  if (parts.length === 0) return { ports: [], error: 'Enter at least one PON port' }
  const ports = []
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return { ports: [], error: `“${part}” is not a port number` }
    const n = Number(part)
    if (n < 1 || (max && n > max)) {
      return { ports: [], error: `Each port must be between 1 and ${max ?? '?'}` }
    }
    if (!ports.includes(n)) ports.push(n)
  }
  ports.sort((a, b) => a - b)
  return { ports, error: null }
}

/**
 * The distinct zones of the selected buildings, read from the loaded rows.
 * One zone → a bulk OLT assignment is allowed for anyone; more than one → a
 * non-admin must split it. A row with no zone reads as its own "No zone" group.
 * (Rows off the current page are unknown here; the backend is authoritative.)
 */
export function zonesOfSelection(rows, ids) {
  const selected = ids instanceof Set ? ids : new Set(ids)
  const byZone = new Map()
  for (const row of rows ?? []) {
    if (!selected.has(row.id)) continue
    const zone = row.zone
    const key = zone?.id ?? '__none__'
    if (!byZone.has(key)) {
      byZone.set(key, zone?.id ? { id: zone.id, name: zone.name } : { id: null, name: 'No zone' })
    }
  }
  return [...byZone.values()]
}
