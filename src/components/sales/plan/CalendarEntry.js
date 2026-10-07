'use client'

import { TASK_STATUS } from '@/lib/visit-task-status'

/**
 * One line in the planner's detailed calendar: status colour, time, building.
 * A planned task is filled in its status colour; an off-plan visit is dashed
 * so it never reads as part of the plan. Clicking opens the details panel.
 */
export function CalendarEntry({ item, onOpen }) {
  const st = TASK_STATUS[item.status] ?? TASK_STATUS.UPCOMING
  const what = item.kind === 'offplan' ? 'Off-plan visit' : st.label
  return (
    <button
      type="button"
      onClick={(e) => {
        // The day cell behind it opens the day — this line opens the item.
        e.stopPropagation()
        onOpen(item)
      }}
      title={`${item.time ? `${item.time} · ` : ''}${item.name} — ${what}`}
      aria-label={`${item.name}${item.time ? ` at ${item.time}` : ''}: ${what}`}
      className={`flex w-full min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-left text-[11px] font-medium leading-tight transition-opacity hover:opacity-80 ${st.chip}`}
    >
      {item.time && <span className="shrink-0 font-semibold tabular-nums">{item.time}</span>}
      <span className="min-w-0 truncate">{item.name}</span>
    </button>
  )
}
