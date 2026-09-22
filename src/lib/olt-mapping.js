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
    const popZoneId = pop.zone?.id ?? pop.zoneId ?? null
    if (zoneId && popZoneId !== zoneId) continue
    for (const olt of pop.olts ?? []) {
      options.push({
        id: olt.id,
        name: olt.name,
        ponPortCount: olt.ponPortCount,
        zoneId: popZoneId,
        zoneName: pop.zone?.name ?? null,
        popName: pop.name,
      })
    }
  }
  return options.sort((a, b) => a.name.localeCompare(b.name))
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
