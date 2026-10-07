'use client'

import { TASK_STATUS, dayLabel } from '@/lib/visit-task-status'
import { todayIst } from '@/lib/calendar-grid'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_DOTS = 4

/**
 * A month as a Mon–Sun grid: per day the task count (from `sm` up) and up to
 * four status dots. Days of the neighbouring months are dimmed, today is
 * ringed; tapping a day opens it in the Day view.
 */
export function MonthGrid({ grid, month, tasks, onPickDay }) {
  const today = todayIst()
  const byDay = new Map()
  for (const t of tasks) {
    if (!byDay.has(t.taskDate)) byDay.set(t.taskDate, [])
    byDay.get(t.taskDate).push(t)
  }

  return (
    <div className="rounded-card border border-line bg-card p-2 sm:p-3">
      <div className="grid grid-cols-7 gap-1 pb-1">
        {WEEKDAYS.map((w) => (
          <span key={w} className="text-center text-[11px] font-semibold uppercase tracking-wide text-muted">
            {w.slice(0, 1)}
            <span className="hidden sm:inline">{w.slice(1)}</span>
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {grid.flat().map((day) => {
          const own = byDay.get(day) ?? []
          const inMonth = day.startsWith(month)
          const isToday = day === today
          return (
            <button
              key={day}
              type="button"
              onClick={() => onPickDay(day)}
              aria-label={`${dayLabel(day)}: ${own.length} planned`}
              className={`flex min-h-14 min-w-0 flex-col items-center gap-1 rounded-btn p-1 transition-colors hover:bg-paper sm:min-h-20 sm:items-start sm:p-2 ${
                inMonth ? '' : 'opacity-40'
              } ${isToday ? 'ring-2 ring-fiber' : ''}`}
            >
              <span className={`text-sm font-semibold tabular-nums ${isToday ? 'text-fiber' : 'text-ink'}`}>
                {Number(day.slice(8))}
              </span>
              {own.length > 0 && (
                <>
                  <span className="hidden text-xs font-medium text-muted sm:block">{own.length} planned</span>
                  <span className="flex flex-wrap justify-center gap-0.5">
                    {own.slice(0, MAX_DOTS).map((t) => {
                      const st = TASK_STATUS[t.status] ?? TASK_STATUS.UPCOMING
                      return <span key={t.id} className={`h-1.5 w-1.5 rounded-full ${st.dot}`} title={st.label} />
                    })}
                  </span>
                </>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
