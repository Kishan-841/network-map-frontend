/** Building wings (spec 2026-10-14) — pure helpers for the map and the wing editor. */
export const WING_NAME_MAX = 40

export function wingSummary(building) {
  const wings = building?.wings ?? []
  // Map lists carry only details.wings; the older flat `wingCount` is read too.
  const total = building?.details?.wings ?? building?.wingCount ?? 0
  const live = wings.filter((w) => w.isLive).length
  const placed = wings.length
  const state = placed === 0 ? 'none' : live === placed ? 'all' : live === 0 ? 'off' : 'some'
  return { placed, total, live, complete: total > 0 && placed === total, state }
}

/** Buildings drawn amber: every wing placed, some (not all) of them live. */
export const countPartlyLive = (buildings = []) =>
  buildings.reduce((n, b) => {
    const { complete, state } = wingSummary(b)
    return complete && state === 'some' ? n + 1 : n
  }, 0)

/** Field errors for the wing form; `otherNames` are the names of the building's OTHER wings. */
export function wingFormErrors({ name, homePass }, otherNames = []) {
  const errors = {}
  const trimmed = String(name ?? '').trim()
  if (!trimmed) errors.name = 'Give the wing a name, e.g. A'
  else if (trimmed.length > WING_NAME_MAX) errors.name = `At most ${WING_NAME_MAX} characters`
  else if (otherNames.some((n) => n.toLowerCase() === trimmed.toLowerCase())) errors.name = `Another wing is already called "${trimmed}"`
  const hp = String(homePass ?? '').trim()
  if (hp === '' || !/^\d+$/.test(hp)) errors.homePass = 'A whole number, 0 or more'
  return errors
}
