'use client'

import { wingSummary } from '@/lib/building-wings'
import { Button } from '@/components/ui/Button'
import { IconPin } from '@/components/ui/icons'

/** A building's wings: count located, each wing's name / home pass / live, and the Locate button. */
export function WingsSection({ building, canEdit, onLocate }) {
  const { placed, total } = wingSummary(building)
  if (!total && !placed) return null
  return (
    <section className="mt-5 rounded-card bg-card p-4 shadow-soft">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold">Wings <span className="font-normal text-muted">{placed} of {total} located</span></h2>
        {canEdit && total > 0 && (
          <Button variant="secondary" onClick={onLocate}><IconPin className="h-4 w-4" /> Locate wings</Button>
        )}
      </div>
      {placed > 0 && (
        <ul className="divide-y divide-line text-sm">
          {building.wings.map((w) => (
            <li key={w.id} className="flex items-center justify-between py-2">
              <span className="font-medium text-ink">{w.name}</span>
              <span className="text-muted">{w.homePass} home pass · <span className={w.isLive ? 'text-ok' : 'text-bad'}>{w.isLive ? 'Live' : 'Not live'}</span></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
