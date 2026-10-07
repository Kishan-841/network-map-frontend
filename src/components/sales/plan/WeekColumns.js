'use client'

import { TASK_STATUS, windowLabel, dayLabel } from '@/lib/visit-task-status'
import { todayIst } from '@/lib/calendar-grid'

/**
 * A week as seven columns (stacked on a phone), each day's tasks in time
 * order with a status dot. Tapping a day opens it in the Day view.
 */
export function WeekColumns({ days, tasks, onPickDay }) {
  const today = todayIst()
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
      {days.map((day) => {
        const own = tasks.filter((t) => t.taskDate === day)
        const isToday = day === today
        return (
          <button
            key={day}
            type="button"
            onClick={() => onPickDay(day)}
            aria-label={`${dayLabel(day)}: ${own.length} planned`}
            className={`flex min-w-0 flex-col rounded-card border bg-card p-3 text-left transition-colors hover:border-fiber/50 md:min-h-40 ${
              isToday ? 'border-fiber ring-1 ring-fiber/30' : 'border-line'
            }`}
          >
            <span className="flex items-center justify-between gap-2">
              <span className={`text-sm font-bold ${isToday ? 'text-fiber' : 'text-ink'}`}>{dayLabel(day)}</span>
              <span className="text-xs font-medium text-muted md:hidden">{own.length || '—'}</span>
            </span>
            {own.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1.5">
                {own.map((t) => {
                  const st = TASK_STATUS[t.status] ?? TASK_STATUS.UPCOMING
                  return (
                    <li key={t.id} className="flex min-w-0 items-start gap-2 text-xs">
                      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${st.dot}`} title={st.label} />
                      <span className="min-w-0">
                        <span className="block font-semibold tabular-nums text-muted">{windowLabel(t)}</span>
                        <span className="block truncate font-medium text-ink">{t.building?.buildingName}</span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </button>
        )
      })}
    </div>
  )
}
