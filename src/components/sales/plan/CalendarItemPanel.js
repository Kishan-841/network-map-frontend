'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { TASK_STATUS, windowLabel, dayLabel } from '@/lib/visit-task-status'
import { todayIst } from '@/lib/calendar-grid'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { VisitDetailBody } from '@/components/sales/VisitDetailBody'
import { IconEdit, IconTrash } from '@/components/ui/icons'

/**
 * Everything about one calendar entry, from the planner's detailed calendar.
 * A planned task shows its window, building and status; a visited task — and
 * an off-plan visit — also loads the whole visit (check-in/out, location,
 * selfie, activities, leads, went-with). An unvisited task can be edited
 * (moved, once its day has passed) or deleted from here.
 */
export function CalendarItemPanel({ item, editable = false, onClose, onEdit, onDelete }) {
  const visitId = item.visitId
  // The loaded visit, tagged with the id it answers — so a different entry
  // never shows the previous entry's visit while it loads.
  const [loaded, setLoaded] = useState(null)

  useEffect(() => {
    if (!visitId) return undefined
    let alive = true
    apiClient
      .get(`/sales/visits/${visitId}`)
      .then((res) => alive && setLoaded({ id: visitId, visit: res.data.data, error: null }))
      .catch((err) => alive && setLoaded({ id: visitId, visit: null, error: getApiErrorMessage(err, 'Could not load this visit') }))
    return () => {
      alive = false
    }
  }, [visitId])

  const visitState = visitId && loaded?.id === visitId ? loaded : null
  const task = item.kind === 'task' ? item.task : null
  const st = TASK_STATUS[item.status] ?? TASK_STATUS.UPCOMING
  const day = task ? task.taskDate : item.visit?.day
  const building = task?.building ?? visitState?.visit?.building ?? { buildingName: item.name }
  const canChange = editable && task && !task.visit
  const isPast = task && task.taskDate < todayIst()

  return (
    <Modal open onClose={onClose} title={item.kind === 'offplan' ? 'Off-plan visit' : 'Planned visit'} wide>
      <div className="mb-4 rounded-card border border-line bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {day ? dayLabel(day, { weekday: 'long', year: 'numeric' }) : ''}
            </p>
            <p className="mt-1 text-base font-bold text-ink">{building.buildingName}</p>
            {building.formattedAddress && <p className="text-sm font-normal text-muted">{building.formattedAddress}</p>}
            {task && <p className="mt-1 text-sm font-medium text-ink">Planned: {windowLabel(task)}</p>}
            {task?.visit?.viaCompanion && (
              <p className="mt-1 text-sm font-normal text-muted">Visited together with {task.visit.byName}</p>
            )}
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${st.chip}`}>
            {item.kind === 'offplan' ? 'Not on the plan' : st.label}
          </span>
        </div>

        {task && !task.visit && (
          <p className="mt-3 text-sm font-normal text-muted">
            {task.status === 'OVERDUE'
              ? 'No visit was recorded at this building in the planned time.'
              : 'Not visited yet.'}
          </p>
        )}

        {canChange && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" className="h-10 min-h-10" onClick={() => onEdit(task)}>
              <IconEdit className="h-4 w-4" aria-hidden="true" /> {isPast ? 'Move' : 'Edit'}
            </Button>
            <Button variant="dangerGhost" className="h-10 min-h-10" onClick={() => onDelete(task)}>
              <IconTrash className="h-4 w-4" aria-hidden="true" /> Delete
            </Button>
          </div>
        )}
      </div>

      {visitId && !visitState && <p className="text-sm font-normal text-muted">Loading the visit…</p>}
      {visitState?.error && (
        <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{visitState.error}</p>
      )}
      {visitState?.visit && (
        <>
          <VisitDetailBody visit={visitState.visit} />
          <Link
            href={`/sales/visits/${visitId}`}
            className="inline-flex text-sm font-semibold text-fiber underline-offset-2 hover:underline"
          >
            Open the full visit page →
          </Link>
        </>
      )}
    </Modal>
  )
}
