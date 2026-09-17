'use client'

import Link from 'next/link'
import { IconClose, IconServer } from '@/components/ui/icons'

/**
 * A tapped POP, in the same slot as SelectedBuildingCard (the map page shows
 * one or the other). `pop` is a marker from `popMarkerData`. The edit link is
 * for whoever may manage POPs — everyone else just reads.
 */
export function PopCard({ pop, canEdit, onClose }) {
  if (!pop) return null
  return (
    <div className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 rounded-2xl border border-line bg-card p-4 shadow-xl lg:left-auto lg:right-6 lg:bottom-6 lg:w-96">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#7c3aed] text-white">
            <IconServer className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <p className="truncate font-bold">{pop.name}</p>
            <p className="text-sm font-normal text-muted">
              POP · {pop.oltCount} OLT{pop.oltCount === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <button onClick={onClose} aria-label="Close" className="-m-1 p-2 text-faint hover:text-ink">
          <IconClose className="h-5 w-5" />
        </button>
      </div>
      {pop.notes && <p className="mt-3 text-sm font-normal text-muted">{pop.notes}</p>}
      <p className="mt-2 font-mono text-[11px] text-faint">
        {pop.position.lat.toFixed(6)}, {pop.position.lng.toFixed(6)}
      </p>
      {canEdit && (
        <Link
          href="/admin/pops"
          className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-fiber hover:underline"
        >
          Edit in POPs
        </Link>
      )}
    </div>
  )
}
