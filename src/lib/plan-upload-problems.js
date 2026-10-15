/**
 * The rows of an uploaded visit plan that need the planner, in sheet order —
 * listed together at the top of the preview so nobody scrolls a long sheet
 * hunting for row 5 and row 100.
 *
 * `rows` are the sheet rows, `items` the latest preview answer per rowNumber.
 * A row is skipped while its last check no longer applies (`outdated`: dates
 * swapped since) or it carries a pick not yet re-checked (`pendingPick`).
 */
export function planProblems(rows, items, { outdated = {}, pendingPick = {} } = {}) {
  const out = []
  for (const row of rows ?? []) {
    const item = items?.[row.rowNumber]
    if (!item || item.state === 'ok' || outdated[row.rowNumber] || pendingPick[row.rowNumber]) continue
    const messages = [...(item.errors ?? [])]
    if (item.state === 'fix') {
      if (!item.employee?.match) messages.push(`Employee "${row.employee || 'missing'}" not found — pick a person`)
      if (!item.building?.match) messages.push(`Building "${row.building || 'missing'}" not found — pick one`)
    }
    if (!messages.length) messages.push(item.state === 'error' ? 'Cannot be saved' : 'Needs a pick')
    out.push({ rowNumber: row.rowNumber, state: item.state, messages })
  }
  return out
}
