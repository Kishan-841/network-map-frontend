'use client'

import { daySummary } from '@/lib/visit-task-status'

/** One line of counts for a day: planned, visited, overdue, due, upcoming, off-plan. */
export function DaySummary({ tasks, offPlan }) {
  return (
    <p className="mb-3 rounded-btn bg-paper px-4 py-2.5 text-sm font-medium text-ink" aria-label="Day summary">
      {daySummary(tasks, offPlan)}
    </p>
  )
}
