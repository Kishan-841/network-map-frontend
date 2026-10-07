'use client'

import Link from 'next/link'
import { IconChevronRight } from '@/components/ui/icons'
import { istTime } from '@/lib/visit-task-status'
import { TaskCard } from './TaskCard'

/** One day's tasks in time order, then the visits that matched no task. */
export function DayList({ tasks, offPlan = [], canCheckIn = false, onCheckIn }) {
  return (
    <div>
      {tasks.length === 0 ? (
        <div className="rounded-card border border-line bg-card px-4 py-8 text-center text-sm text-muted">
          Nothing planned
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {tasks.map((t) => (
            <li key={t.id}>
              <TaskCard task={t} canCheckIn={canCheckIn} onCheckIn={onCheckIn} />
            </li>
          ))}
        </ul>
      )}

      {offPlan.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-bold text-ink">Off-plan visits</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card">
            {offPlan.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/sales/visits/${v.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-paper"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-semibold tabular-nums text-muted">{istTime(v.visitedAt)}</span>
                    <span className="mx-1.5 text-faint">·</span>
                    <span className="font-medium text-ink">{v.buildingName ?? 'Building'}</span>
                  </span>
                  <IconChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
