'use client'

import { useEffect, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { useOpenVisit } from '@/hooks/useSales'
import { invalidateOverdueCount } from '@/hooks/useOverdueCount'
import { monthGrid, weekDays, shiftMonth, todayIst, plusDays } from '@/lib/calendar-grid'
import { dayLabel } from '@/lib/visit-task-status'
import { CheckInModal } from '@/components/sales/CheckInModal'
import { OpenVisitCard } from '@/components/sales/OpenVisitCard'
import { Toast } from '@/components/ui/Toast'
import { IconChevronLeft, IconChevronRight } from '@/components/ui/icons'
import { DayList } from './DayList'
import { WeekColumns } from './WeekColumns'
import { MonthGrid } from './MonthGrid'
import { DaySummary } from './DaySummary'
import { TaskEditModal } from './TaskEditModal'

const VIEWS = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
]

const monthTitle = (ym) =>
  new Date(`${ym}-01T00:00:00Z`).toLocaleDateString('en-IN', { timeZone: 'UTC', month: 'long', year: 'numeric' })

/**
 * One person's visit plan as a Month / Week / Day calendar (spec 2026-10-07
 * §3). `userId` omitted = the signed-in person. With `canCheckIn`, today's
 * unvisited tasks open the usual check-in flow, and the open visit (if any)
 * shows above the calendar so it can be checked out of here.
 *
 * Fetches its own data for the visible range, so a team-plan screen can show
 * someone else's calendar by passing their id.
 *
 * `editable` = planner mode (Team plan): the Day view leads with a one-line
 * summary, unvisited tasks get Edit / Delete, and days from today on get Add
 * task — all through TaskEditModal, whose Person list is `assignees`.
 */
export function PlanCalendar({ userId, canCheckIn = false, editable = false, assignees = [] }) {
  const [view, setView] = useState('day')
  const [day, setDay] = useState(todayIst)
  const [tick, setTick] = useState(0)
  // The last response, tagged with the range it answers — "loading" is simply
  // "the data on hand is for some other range". A same-range refetch (after a
  // check-in) keeps showing the previous data until the new data lands.
  const [data, setData] = useState(null)
  const [checkInFor, setCheckInFor] = useState(null)
  const [notice, setNotice] = useState(null)
  const [toast, setToast] = useState(null)
  const [editing, setEditing] = useState(null) // { task, day, deleting } while the edit modal is open
  const { visit: openVisit, loading: openLoading, refresh: refreshOpen } = useOpenVisit(canCheckIn)

  const month = day.slice(0, 7)
  const grid = view === 'month' ? monthGrid(month) : null
  const week = view === 'week' ? weekDays(day) : null
  const from = grid ? grid[0][0] : week ? week[0] : day
  const to = grid ? grid.at(-1).at(-1) : week ? week[6] : day
  const rangeKey = `${userId ?? ''}|${from}|${to}`

  useEffect(() => {
    let alive = true
    apiClient
      .get('/sales/tasks', { params: { from, to, ...(userId ? { userId } : {}) } })
      .then((res) => alive && setData({ rangeKey, tasks: res.data.data.tasks, offPlan: res.data.data.offPlan, error: null }))
      .catch((err) =>
        alive && setData({ rangeKey, tasks: [], offPlan: [], error: getApiErrorMessage(err, 'Could not load the plan') }),
      )
    return () => {
      alive = false
    }
  }, [rangeKey, tick, from, to, userId])

  const loading = data?.rangeKey !== rangeKey
  const tasks = loading ? [] : data.tasks
  const offPlan = loading ? [] : data.offPlan

  function step(n) {
    setNotice(null)
    if (view === 'month') setDay(`${shiftMonth(month, n)}-01`)
    else setDay(plusDays(day, view === 'week' ? 7 * n : n))
  }
  function pickDay(d) {
    setDay(d)
    setView('day')
  }
  function onCheckIn(building) {
    // Until we know whether a visit is open, a check-in could start a second one.
    if (openLoading) return
    if (openVisit) setNotice('Check out of your current building first')
    else setCheckInFor(building)
  }
  const refetch = () => {
    setTick((t) => t + 1)
    invalidateOverdueCount()
  }

  const title =
    view === 'month'
      ? monthTitle(month)
      : view === 'week'
        ? `${dayLabel(week[0], { weekday: undefined })} – ${dayLabel(week[6], { weekday: undefined, year: 'numeric' })}`
        : dayLabel(day, { weekday: 'long', year: 'numeric' })

  const arrow =
    'inline-flex h-10 w-10 items-center justify-center rounded-btn border border-line text-ink transition-colors hover:bg-paper'

  return (
    <div>
      {canCheckIn && openVisit && (
        <OpenVisitCard
          visit={openVisit}
          onChanged={() => {
            setNotice(null)
            refreshOpen()
            refetch()
          }}
        />
      )}

      {/* View switch + navigation. Wraps on a phone rather than scrolling sideways. */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Calendar view" className="inline-flex rounded-btn border border-line bg-card p-1">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={view === v.id}
              onClick={() => setView(v.id)}
              className={`h-8 rounded-[10px] px-4 text-sm font-medium transition-colors ${
                view === v.id ? 'bg-fiber text-on-fiber' : 'text-muted hover:text-ink'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className={arrow} onClick={() => step(-1)} aria-label={`Previous ${view}`}>
            <IconChevronLeft className="h-4.5 w-4.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setNotice(null)
              setDay(todayIst())
            }}
            className="h-10 rounded-btn border border-line px-4 text-sm font-medium text-ink transition-colors hover:bg-paper"
          >
            Today
          </button>
          <button type="button" className={arrow} onClick={() => step(1)} aria-label={`Next ${view}`}>
            <IconChevronRight className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

      <h2 className="mb-3 text-lg font-bold text-ink">{title}</h2>

      {notice && (
        <p className="mb-4 rounded-btn bg-warn-tint px-4 py-3 text-sm font-medium text-warn">
          {notice} — it is shown at the top of this page.
        </p>
      )}
      {!loading && data.error && (
        <p className="mb-4 rounded-btn bg-bad-tint px-4 py-3 text-sm font-medium text-bad">{data.error}</p>
      )}

      {loading ? (
        <p className="py-8 text-center text-sm text-muted">Loading…</p>
      ) : view === 'month' ? (
        <MonthGrid grid={grid} month={month} tasks={tasks} onPickDay={pickDay} />
      ) : view === 'week' ? (
        <WeekColumns
          days={week}
          tasks={tasks}
          onPickDay={pickDay}
          onAdd={editable ? (d) => setEditing({ task: null, day: d }) : undefined}
        />
      ) : (
        <>
          {editable && <DaySummary tasks={tasks} offPlan={offPlan} />}
          <DayList
            tasks={tasks}
            offPlan={offPlan}
            canCheckIn={canCheckIn}
            checkInPending={canCheckIn && openLoading}
            onCheckIn={onCheckIn}
            onEdit={editable ? (task) => setEditing({ task, day }) : undefined}
            onDelete={editable ? (task) => setEditing({ task, day, deleting: true }) : undefined}
            onAdd={editable && day >= todayIst() ? () => setEditing({ task: null, day }) : undefined}
          />
        </>
      )}

      {view !== 'day' && !loading && offPlan.length > 0 && (
        <p className="mt-3 text-sm text-muted">
          {offPlan.length} off-plan visit{offPlan.length === 1 ? '' : 's'} — open a day to see them.
        </p>
      )}

      {toast && <Toast key={toast} message={toast} onDone={() => setToast(null)} />}

      {editing && (
        <TaskEditModal
          task={editing.task}
          day={editing.day}
          userId={userId}
          assignees={assignees}
          startDeleting={Boolean(editing.deleting)}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null)
            setToast(message)
            refetch()
          }}
        />
      )}

      {checkInFor && (
        <CheckInModal
          building={checkInFor}
          onClose={() => setCheckInFor(null)}
          onDone={() => {
            setToast(`Checked in to ${checkInFor.buildingName}`)
            setCheckInFor(null)
            refreshOpen()
            refetch()
          }}
        />
      )}
    </div>
  )
}

