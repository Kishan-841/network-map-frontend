'use client'

import { useState } from 'react'

/** A point's display name — the POP/closure/building it sits on, else its type. */
export const pointLabelOf = (points, id) => {
  const point = points.find((p) => p.id === id)
  return point?.label ?? point?.type ?? '—'
}

export const segmentLabel = (points, segment) =>
  `${pointLabelOf(points, segment.fromPointId)} → ${pointLabelOf(points, segment.toPointId)}`

/**
 * Laid metres for one segment. Local while being typed, committed on blur or
 * Enter and only when the number actually changed — the panel re-keys this
 * input on the saved value, so a refetch resets it without an effect.
 */
function LaidInput({ segment, disabled, onSave }) {
  const [value, setValue] = useState(segment.fiberLaidMeters ?? '')

  const commit = () => {
    const next = value === '' ? null : Number(value)
    if (next !== null && (!Number.isFinite(next) || next < 0)) return
    if (next === (segment.fiberLaidMeters ?? null)) return
    onSave(segment.id, next)
  }

  return (
    <input
      type="number"
      min={0}
      step={1}
      inputMode="decimal"
      disabled={disabled}
      value={value}
      aria-label="Laid metres"
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur()
        }
      }}
      className="h-11 w-20 rounded-btn border border-line bg-card px-2 text-right text-sm tabular-nums outline-none transition-shadow focus:border-fiber focus:ring-2 focus:ring-fiber/15 disabled:opacity-50"
    />
  )
}

/**
 * The fiber's segments — a table on desktop, stacked rows on a phone (Design.md
 * never puts a real table on mobile). Editing laid metres is the only write;
 * the panel owns the PATCH and passes it in as `onSaveLaid`.
 */
export default function SegmentList({ segments, points, readOnly = false, busy = false, onSaveLaid }) {
  if (segments.length === 0) {
    return (
      <p className="rounded-btn border border-dashed border-line px-4 py-3 text-sm font-normal text-muted">
        No segments — this fiber is an untyped path with no closure or building points on it yet.
      </p>
    )
  }

  const laidCell = (segment) =>
    readOnly ? (
      <span className="text-sm tabular-nums text-ink">
        {segment.fiberLaidMeters == null ? '—' : Math.round(segment.fiberLaidMeters)}
      </span>
    ) : (
      <LaidInput
        key={`${segment.id}:${segment.fiberLaidMeters ?? ''}`}
        segment={segment}
        disabled={busy}
        onSave={onSaveLaid}
      />
    )

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
                Map <span className="tabular-nums text-muted">{Math.round(segment.mapMeters)} m</span>
              </span>
              <span className="flex items-center gap-2 text-xs font-normal text-faint">
                Laid
                {laidCell(segment)}
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
                Map m
              </th>
              <th className="border-b border-line px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-faint">
                Laid m
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
                <td className="border-b border-line px-3 py-2 text-right">{laidCell(segment)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
