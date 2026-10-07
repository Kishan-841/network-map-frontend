'use client'

import { TASK_STATUS, dayLabel } from '@/lib/visit-task-status'
import { todayIst } from '@/lib/calendar-grid'
import { calendarItems } from '@/lib/plan-calendar-items'
import { CalendarEntry } from './CalendarEntry'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_DOTS = 4
const MAX_LINES = 3

/**
 * A month as a Mon–Sun grid. Days of the neighbouring months are dimmed,
 * today is ringed; tapping a day opens it in the Day view.
 *
 * Plain (an executive's own calendar): per day a count and status dots.
 * `detailed` (the planner's Team plan): from `sm` up each day lists its tasks
 * AND off-plan visits — time, building, status colour — up to three lines,
 * then "+N more"; a line opens the details panel via `onOpenItem`. On a phone
 * the cells stay dots (names don't fit) and the day opens the full list.
 */
export function MonthGrid({ grid, month, tasks, offPlan = [], onPickDay, detailed = false, onOpenItem }) {
  const today = todayIst()
  const items = calendarItems(tasks, detailed ? offPlan : [])

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
          const own = items.get(day) ?? []
          const planned = own.filter((i) => i.kind === 'task').length
          const inMonth = day.startsWith(month)
          const isToday = day === today
          const more = own.length - MAX_LINES
          return (
            <div
              key={day}
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
              className={`flex min-h-14 min-w-0 cursor-pointer flex-col items-center gap-1 rounded-btn p-1 transition-colors hover:bg-paper sm:items-stretch sm:p-1.5 ${
                detailed ? 'sm:min-h-28' : 'sm:min-h-20'
              } ${inMonth ? '' : 'opacity-40'} ${isToday ? 'ring-2 ring-fiber' : ''}`}
            >
              <span className={`text-sm font-semibold tabular-nums sm:px-0.5 ${isToday ? 'text-fiber' : 'text-ink'}`}>
                {Number(day.slice(8))}
              </span>

              {own.length > 0 && (
                <>
                  {/* Dots: always on a phone; on larger screens only in the plain calendar. */}
                  <span className={`flex flex-wrap justify-center gap-0.5 ${detailed ? 'sm:hidden' : ''}`}>
                    {own.slice(0, MAX_DOTS).map((i) => {
                      const st = TASK_STATUS[i.status] ?? TASK_STATUS.UPCOMING
                      return <span key={i.key} className={`h-1.5 w-1.5 rounded-full ${st.dot}`} title={st.label} />
                    })}
                  </span>
                  {!detailed && <span className="hidden text-xs font-medium text-muted sm:block">{planned} planned</span>}

                  {detailed && (
                    <div className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                      {own.slice(0, MAX_LINES).map((i) => (
                        <CalendarEntry key={i.key} item={i} onOpen={onOpenItem} />
                      ))}
                      {more > 0 && (
                        <span className="px-1.5 text-[11px] font-semibold text-fiber">+{more} more</span>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
