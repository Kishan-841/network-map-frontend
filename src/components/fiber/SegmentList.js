'use client'

/** A point's display name — the POP/closure/building it sits on, else its type. */
export const pointLabelOf = (points, id) => {
  const point = points.find((p) => p.id === id)
  return point?.label ?? point?.type ?? '—'
}

export const segmentLabel = (points, segment) =>
  `${pointLabelOf(points, segment.fromPointId)} → ${pointLabelOf(points, segment.toPointId)}`

/**
 * The fiber's segments — a table on desktop, stacked rows on a phone (Design.md
 * never puts a real table on mobile). Read-only: the drawn line is the only
 * source of length, so there is nothing here to edit.
 */
export default function SegmentList({ segments, points }) {
  if (segments.length === 0) {
    return (
      <p className="rounded-btn border border-dashed border-line px-4 py-3 text-sm font-normal text-muted">
        No closures on this fiber yet — the length above is the whole line.
      </p>
    )
  }

  return (
    <>
      {/* Phone: one stacked card per segment */}
      <ul className="flex flex-col gap-2 lg:hidden">
        {segments.map((segment) => (
          <li key={segment.id} className="rounded-btn border border-line p-3">
            <p className="flex items-center text-sm font-medium text-ink">
              <span className="min-w-0 truncate">{segmentLabel(points, segment)}</span>
            </p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-xs font-normal text-faint">
                Length <span className="tabular-nums text-muted">{Math.round(segment.mapMeters)} m</span>
              </span>
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop: a compact table */}
      <div className="hidden overflow-x-auto rounded-card border border-line lg:block">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="border-b border-line px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-faint">
                Segment
              </th>
              <th className="border-b border-line px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-faint">
                Length m
              </th>
            </tr>
          </thead>
          <tbody>
            {segments.map((segment) => (
              <tr key={segment.id}>
                <td className="border-b border-line px-3 py-2 text-ink">
                  <span className="flex items-center">
                    <span className="min-w-0 truncate">{segmentLabel(points, segment)}</span>
                  </span>
                </td>
                <td className="border-b border-line px-3 py-2 text-right tabular-nums text-muted">
                  {Math.round(segment.mapMeters)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
