// Editor "Edit another fibre": which fibres to offer for a search.

const byName = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

/**
 * Fibres matching `query` by name or zone (case-insensitive), the one being
 * edited left out, sorted by name with numbers in number order, capped at
 * `limit`. The returned array carries `total` — how many matched before the
 * cap — so the sheet can say "type to narrow".
 */
export function fiberChoices(fibers, query, excludeId, limit = 50) {
  const q = query.trim().toLowerCase()
  const matched = fibers
    .filter((fiber) => fiber.id !== excludeId)
    .filter((fiber) => !q || `${fiber.name ?? ''} ${fiber.zone?.name ?? ''}`.toLowerCase().includes(q))
    .sort((a, b) => byName.compare(a.name ?? '', b.name ?? ''))
  const out = matched.slice(0, limit)
  out.total = matched.length
  return out
}
