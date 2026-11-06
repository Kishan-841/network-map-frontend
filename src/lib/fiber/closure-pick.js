// Finding a closure by what a person types: its code ("JC-0012", "jc12",
// "12") or the building it sits on. Used by the Splitters page's
// "New splitter" picker, which can face ~2,000 closures — too many for a
// plain <select>.

const squash = (text) => String(text ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
// "JC-0012" → "12", so typing the number alone finds it.
const numberPart = (code) => squash(code).replace(/^[a-z]+/, '').replace(/^0+(?=\d)/, '')

/**
 * Closures matching `query`, best first: codes whose number (or whole code)
 * starts with it, then codes containing it, then building-name matches.
 * Original order breaks ties. At most `limit` rows.
 */
export function matchClosures(closures, query, limit = 8) {
  const q = squash(query)
  const words = String(query ?? '').trim().toLowerCase()
  if (!q) return []
  const ranked = []
  closures.forEach((closure, index) => {
    const code = squash(closure.code)
    const number = numberPart(closure.code)
    let rank = null
    if (number.startsWith(q) || code.startsWith(q)) rank = 0
    else if (code.includes(q) || number.includes(q)) rank = 1
    else if (closure.building?.buildingName?.toLowerCase().includes(words)) rank = 2
    if (rank !== null) ranked.push({ closure, rank, index })
  })
  return ranked
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, limit)
    .map((r) => r.closure)
}
