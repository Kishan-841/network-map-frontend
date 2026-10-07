'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { IconClock, IconLocate, IconChevronRight, IconEdit, IconTrash } from '@/components/ui/icons'
import { TASK_STATUS, windowLabel, visitedLabel } from '@/lib/visit-task-status'
import { todayIst } from '@/lib/calendar-grid'

/**
 * One planned visit: when, where, and how it stands. A visited task links to
 * its visit; today's unvisited task offers Check in (when `canCheckIn`) —
 * disabled while `checkInPending` (we don't yet know if a visit is open).
 * With `onEdit` (planner mode) an unvisited task offers Edit — "Move" once
 * its day has passed, since it can only go forward — and Delete; a visited
 * task is read-only.
 */
export function TaskCard({ task, canCheckIn = false, checkInPending = false, onCheckIn, onEdit, onDelete }) {
  const st = TASK_STATUS[task.status] ?? TASK_STATUS.UPCOMING
  const showCheckIn = canCheckIn && !task.visit && task.taskDate === todayIst()
  const editable = Boolean(onEdit) && !task.visit
  const isPast = task.taskDate < todayIst()

  return (
    <article className="rounded-card border border-line bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold tabular-nums text-muted">
            <IconClock className="h-3.5 w-3.5" aria-hidden="true" />
            {windowLabel(task)}
          </p>
          <p className="mt-1 truncate text-base font-bold text-ink">{task.building?.buildingName}</p>
          {task.building?.formattedAddress && (
            <p className="mt-0.5 line-clamp-2 text-sm font-normal text-muted">{task.building.formattedAddress}</p>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${st.chip}`}>{st.label}</span>
      </div>

      {/* A visit made WITH the team leader belongs to them — an executive can't
          open it, so on their own calendar it is plain text. Planners can. */}
      {task.visit && task.visit.viaCompanion && !onEdit && (
        <p className="mt-3 rounded-btn bg-paper px-3 py-2 text-sm font-medium text-ink">{visitedLabel(task.visit)}</p>
      )}
      {task.visit && !(task.visit.viaCompanion && !onEdit) && (
        <Link
          href={`/sales/visits/${task.visit.id}`}
          className="mt-3 flex items-center justify-between gap-2 rounded-btn bg-paper px-3 py-2 text-sm font-medium text-ink transition-colors hover:text-fiber"
        >
          {visitedLabel(task.visit)}
          <IconChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
        </Link>
      )}

      {showCheckIn && (
        <Button
          className="mt-3 h-10 min-h-10 w-full sm:w-auto"
          loading={checkInPending}
          onClick={() => onCheckIn?.(task.building)}
        >
          <IconLocate className="h-4 w-4" aria-hidden="true" />
          Check in
        </Button>
      )}

      {editable && (
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" className="h-10 min-h-10 flex-1 sm:flex-none" onClick={() => onEdit(task)}>
            <IconEdit className="h-4 w-4" aria-hidden="true" />
            {isPast ? 'Move' : 'Edit'}
          </Button>
          <Button variant="dangerGhost" className="h-10 min-h-10 flex-1 sm:flex-none" onClick={() => onDelete?.(task)}>
            <IconTrash className="h-4 w-4" aria-hidden="true" />
            Delete
          </Button>
        </div>
      )}
    </article>
  )
}
