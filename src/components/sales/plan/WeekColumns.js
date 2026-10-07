'use client'

import { TASK_STATUS, windowLabel, dayLabel } from '@/lib/visit-task-status'
import { todayIst } from '@/lib/calendar-grid'
import { calendarItems } from '@/lib/plan-calendar-items'
import { IconPlus } from '@/components/ui/icons'
import { CalendarEntry } from './CalendarEntry'

/**
 * A week as seven columns (stacked on a phone), each day's tasks in time
 * order with a status dot. Tapping a day opens it in the Day view. With
 * `onAdd` (planner mode) each day from today on gets an Add button.
 *
 * `detailed` (the planner's Team plan) lists tasks AND off-plan visits as
 * clickable lines that open the details panel via `onOpenItem`.
 */
export function WeekColumns({ days, tasks, offPlan = [], onPickDay, onAdd, detailed = false, onOpenItem }) {
  const today = todayIst()
  const items = calendarItems(tasks, detailed ? offPlan : [])
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
      {days.map((day) => {
        const own = items.get(day) ?? []
        const planned = own.filter((i) => i.kind === 'task').length
        const isToday = day === today
        return (
          <div
            key={day}
            className={`flex min-w-0 flex-col rounded-card border bg-card transition-colors hover:border-fiber/50 md:min-h-40 ${
              isToday ? 'border-fiber ring-1 ring-fiber/30' : 'border-line'
            }`}
          >
            <div
              role="button"
              tabIndex={0}
              onClick={() => onPickDay(day)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onPickDay(day)
                }
              }}
              aria-label={`${dayLabel(day)}: ${planned} planned`}
              className="flex min-w-0 flex-1 cursor-pointer flex-col p-3 text-left"
            >
              <span className="flex items-center justify-between gap-2">
                <span className={`text-sm font-bold ${isToday ? 'text-fiber' : 'text-ink'}`}>{dayLabel(day)}</span>
                <span className="text-xs font-medium text-muted md:hidden">{own.length || '—'}</span>
              </span>
              {own.length > 0 &&
                (detailed ? (
                  <div className="mt-2 flex flex-col gap-1">
                    {own.map((i) => (
                      <CalendarEntry key={i.key} item={i} onOpen={onOpenItem} />
                    ))}
                  </div>
                ) : (
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {own.map(({ key, task: t }) => {
                      const st = TASK_STATUS[t.status] ?? TASK_STATUS.UPCOMING
                      return (
                        <li key={key} className="flex min-w-0 items-start gap-2 text-xs">
                          <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${st.dot}`} title={st.label} />
                          <span className="min-w-0">
                            <span className="block font-semibold tabular-nums text-muted">{windowLabel(t)}</span>
                            <span className="block truncate font-medium text-ink">{t.building?.buildingName}</span>
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                ))}
            </div>
            {onAdd && day >= today && (
              <button
                type="button"
                onClick={() => onAdd(day)}
                aria-label={`Add task on ${dayLabel(day)}`}
                className="mx-3 mb-3 inline-flex h-8 items-center justify-center gap-1 rounded-btn border border-line text-xs font-semibold text-fiber transition-colors hover:bg-paper"
              >
                <IconPlus className="h-3.5 w-3.5" aria-hidden="true" /> Add
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
