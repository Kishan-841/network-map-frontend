import { materialRows, unitText } from '@/lib/society-materials'

/**
 * A material request, read-only: grouped like the catalogue, only the items
 * asked for, each with its unit. Used on the society page and in the
 * Buildings drawer. `compact` tightens it for the drawer; `columns` lays the
 * groups out in two columns from the sm breakpoint (the society page).
 */
export function MaterialList({ materials, compact = false, columns = false, empty = 'No materials asked for.' }) {
  const groups = materialRows(materials)
  if (groups.length === 0) return <p className="text-sm font-normal text-muted">{empty}</p>
  const layout = columns ? 'grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2' : `flex flex-col ${compact ? 'gap-2' : 'gap-3'}`
  return (
    <div className={layout}>
      {groups.map((g) => (
        <div key={g.key} className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-faint">{g.label}</p>
          <ul className="mt-0.5 divide-y divide-line/60">
            {g.items.map((item) => (
              <li key={item.key} className="flex items-baseline justify-between gap-3 py-1">
                <span className="min-w-0 break-words text-sm font-normal text-ink">{item.label}</span>
                <span className="shrink-0 text-sm font-medium tabular-nums text-ink">
                  {item.qty.toLocaleString('en-IN')} <span className="font-normal text-muted">{unitText(item.unit)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
