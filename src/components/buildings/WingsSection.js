'use client'

import { wingSummary } from '@/lib/building-wings'
import { Button } from '@/components/ui/Button'
import { IconPin } from '@/components/ui/icons'

/** A building's wings: count located, each wing's name / home pass / live, and the Locate button. */
export function WingsSection({ building, canEdit, onLocate, card = false }) {
  const { placed, total } = wingSummary(building)
  // No wing count yet: only shown to someone who can set it (in Locate wings).
  if (!total && !placed && !canEdit) return null
  return (
    <section className={`rounded-card bg-card shadow-soft ${card ? 'p-5' : 'mt-5 p-4'}`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className={card ? 'text-xs font-medium uppercase tracking-wide text-faint' : 'text-sm font-bold'}>
          Wings{' '}
          <span className={card ? 'font-medium normal-case tracking-normal text-muted' : 'font-normal text-muted'}>
            {card ? '· ' : ''}
            {total ? `${placed} of ${total} located` : 'not set yet'}
          </span>
        </h2>
        {canEdit && (
          <Button variant="secondary" onClick={onLocate}>
            <IconPin className="h-4 w-4" /> {total ? 'Locate wings' : 'Add wings'}
          </Button>
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
