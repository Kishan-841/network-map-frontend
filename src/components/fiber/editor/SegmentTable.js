'use client'

/**
 * Segment table for the fiber save panel. Pure render component — the panel
 * derives `rows` from `deriveSegments(draftPoints)` and owns the `laid`
 * array; this just draws it and reports edits back via `onChangeLaid`.
 */
export default function SegmentTable({ rows, laid, onChangeLaid, warning }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-btn border border-dashed border-line px-4 py-3 text-sm font-normal text-muted">
        No segments yet — add a POP, closure or building point to get segment lengths
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {warning && (
        <p className="rounded-btn bg-bad-tint px-3 py-2 text-xs font-medium text-bad">{warning}</p>
      )}
      <div className="overflow-x-auto rounded-card border border-line">
        <table className="w-full min-w-[380px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="border-b border-line px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-faint">
                Segment
              </th>
              <th className="border-b border-line px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-faint">
                Map m
              </th>
              <th className="border-b border-line px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-faint">
                Laid m
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={`${row.fromIndex}-${row.toIndex}`}>
                <td className="border-b border-line px-3 py-2 text-ink">
                  <span>{row.fromLabel}</span>
                  <span className="mx-1 text-faint">→</span>
                  <span>{row.toLabel}</span>
                </td>
                <td className="border-b border-line px-3 py-2 text-right text-muted">
                  {Math.round(row.mapMeters)}
                </td>
                <td className="border-b border-line px-3 py-2 text-right">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={laid[i] ?? ''}
                    onChange={(e) =>
                      onChangeLaid(i, e.target.value === '' ? null : Number(e.target.value))
                    }
                    className="h-9 w-24 rounded-btn border border-line bg-card px-2 text-right text-sm outline-none transition-shadow focus:border-fiber focus:ring-2 focus:ring-fiber/15"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
