/**
 * A zone manager's "My team" page, the parts that decide what a save sends.
 *
 * The danger: the API keeps a surveyor's zones OUTSIDE the manager's own and
 * replaces the rest with what is sent. If the manager's zone list has not
 * loaded (or failed to), "the zones I can see" looks empty — and a save would
 * wipe every zone the manager gave that surveyor. So nothing about zones is
 * edited until the list is really there.
 */

/** 'loading' | 'error' | 'none' (loaded, the admin gave no zones) | 'ready'. */
export function managerZonesStatus({ zones, error }) {
  if (error) return 'error'
  if (!Array.isArray(zones)) return 'loading'
  return zones.length > 0 ? 'ready' : 'none'
}

/** Add surveyor needs zones to give. */
export const mayAddSurveyor = (status) => status === 'ready'

/**
 * Edit is safe once the list is known — 'none' included: a manager with no
 * zones can still fix a name, and sends no zones of theirs to drop.
 */
export const mayEditTeam = (status) => status === 'ready' || status === 'none'

/**
 * The zone ids a manager's save sends: the picked ones the manager can see
 * (the API refuses others with a 400 and keeps them itself). `undefined` —
 * omit zoneIds from the request — while the manager's list is not loaded.
 */
export function managerZoneIdsToSend(pickedIds, zones) {
  if (!Array.isArray(zones)) return undefined
  const mine = new Set(zones.map((zone) => zone.id))
  return (pickedIds ?? []).filter((id) => mine.has(id))
}

/** How many of a surveyor's zones lie outside the manager's (0 while unknown). */
export function hiddenZoneCount(pickedIds, zones) {
  if (!Array.isArray(zones)) return 0
  const mine = new Set(zones.map((zone) => zone.id))
  return (pickedIds ?? []).filter((id) => !mine.has(id)).length
}
