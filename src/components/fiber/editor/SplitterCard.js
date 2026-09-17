'use client'

import { Button } from '@/components/ui/Button'
import { IconTrash } from '@/components/ui/icons'
import { FIBER_TYPE_LABELS, POINT_COLORS, RATIO_LABELS } from '@/lib/fiber/constants'
import BottomSheet from './BottomSheet'

function Row({ caption, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-faint">{caption}</span>
      <span className="min-w-0 truncate text-sm font-medium text-ink">{value}</span>
    </div>
  )
}

/**
 * A saved splitter tapped on the draft line (annotate + Pan mode). A bottom
 * sheet on a phone, the same small anchored card as ClosureCard's `edit` mode
 * and TargetCard from `lg` up: what it is, then Edit (the modal) or Remove
 * (the point stays as a plain bend).
 */
export default function SplitterCard({ point, saving, error, onEdit, onRemove, onCancel }) {
  const ref = point.ref ?? {}
  return (
    <BottomSheet className="gap-3">
      <p className="flex items-center gap-2 text-sm font-bold">
        <span
          className="h-2.5 w-2.5 shrink-0 rotate-45"
          style={{ backgroundColor: POINT_COLORS.SPLITTER }}
          aria-hidden="true"
        />
        {ref.code ?? 'Splitter'}
      </p>

      <div className="flex flex-col gap-1.5">
        <Row caption="Ratio" value={ref.splitter ?? RATIO_LABELS[ref.splitterRatio] ?? '—'} />
        <Row caption="Fiber type" value={FIBER_TYPE_LABELS[ref.splitterFiberType] ?? ref.splitterFiberType ?? '—'} />
        <Row caption="Splitter type" value={ref.splitterLocation ?? '—'} />
        <Row
          caption="Lat, long"
          value={`${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`}
        />
      </div>

      {error && <p className="rounded-btn bg-bad-tint px-3 py-2 text-sm font-normal text-bad">{error}</p>}

      <div className="flex gap-2">
        <Button type="button" variant="secondary" className="min-h-11 flex-1" disabled={saving} onClick={onCancel}>
          Close
        </Button>
        <Button type="button" className="min-h-11 flex-1" disabled={saving} onClick={onEdit}>
          Edit
        </Button>
      </div>

      <Button type="button" variant="danger" className="min-h-11" loading={saving} onClick={onRemove}>
        <IconTrash className="h-4 w-4" aria-hidden="true" />
        Remove splitter
      </Button>
    </BottomSheet>
  )
}
