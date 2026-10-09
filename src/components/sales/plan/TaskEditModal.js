'use client'

import { useEffect, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { ROLE_LABELS } from '@/lib/roles'
import { todayIst } from '@/lib/calendar-grid'
import { dayLabel } from '@/lib/visit-task-status'
import { seriesChoices, seriesResultText, handoverText } from '@/lib/visit-plan-sheet'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { IconTrash, IconSearch } from '@/components/ui/icons'

/** The counts of a series PATCH ({ changed, … }) or DELETE ({ removed, … }) answer. */
const seriesCounts = (res) => {
  const d = res?.data?.data ?? {}
  return {
    changed: d.changed ?? d.removed ?? 0,
    skipped: d.skipped ?? 0,
    released: d.released ?? 0,
    outOfScope: d.outOfScope ?? 0,
  }
}

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/**
 * "This visit only" / "This and the N later repeats" as two radio cards — a
 * consequential choice, so never a <select> a stray scroll could change.
 */
function SeriesChoice({ choices, value, onChange, disabled }) {
  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="mb-1.5 text-sm font-medium text-ink">Apply to</legend>
      {choices.map((c) => {
        const on = value === c.value
        return (
          <label
            key={c.value}
            className={`flex cursor-pointer items-center gap-3 rounded-btn border px-4 py-3 text-sm transition-colors ${
              on ? 'border-fiber bg-fiber-tint font-semibold text-ink' : 'border-line bg-card text-ink hover:bg-paper'
            }`}
          >
            <input
              type="radio"
              name="series-scope"
              className="radio radio-sm radio-primary"
              value={c.value}
              checked={on}
              onChange={() => onChange(c.value)}
            />
            {c.label}
          </label>
        )
      })}
    </fieldset>
  )
}

/**
 * Add one visit-plan task, or edit / move / reassign / delete an unvisited one
 * (spec 2026-10-07 §4). `task` null = a new task for `userId` on `day`.
 *
 * Every day here is today or later — the API refuses a task in the past — so
 * a missed task from an earlier day opens as "Move" with the date blank, and
 * can only be moved forward or deleted. `startDeleting` opens straight on the
 * delete confirmation (the card's Delete button). The API's own message is
 * shown on any refusal (409 visited / duplicate, 400 zones / window).
 *
 * A task from a repeating sheet row with later unvisited repeats
 * (`seriesLaterCount` > 0) asks whether Save / Delete applies to this visit
 * only or to it and every later unvisited repeat (spec 2026-10-09 §2) — the
 * server changes them all or none, skips visited ones, and says how many.
 */
export function TaskEditModal({ task = null, day, userId, assignees = [], startDeleting = false, onClose, onSaved }) {
  const today = todayIst()
  const isPast = Boolean(task) && task.taskDate < today
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? userId ?? '')
  const [building, setBuilding] = useState(task?.building ?? null)
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null) // { q, rows, error } — the answer for one search text
  const [taskDate, setTaskDate] = useState(task ? (isPast ? '' : task.taskDate) : day && day >= today ? day : today)
  const [anyTime, setAnyTime] = useState(task ? !task.startTime : true)
  const [startTime, setStartTime] = useState(task?.startTime ?? '')
  const [endTime, setEndTime] = useState(task?.endTime ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [confirming, setConfirming] = useState(startDeleting)
  const choices = seriesChoices(task?.seriesLaterCount)
  const [scope, setScope] = useState('ONE')
  const following = choices.length > 0 && scope === 'FOLLOWING'

  const text = q.trim()
  useEffect(() => {
    if (text.length < 2) return undefined
    let alive = true
    const timer = setTimeout(() => {
      apiClient
        .get('/sales/tasks/buildings', { params: { q: text } })
        .then((res) => alive && setResults({ q: text, rows: res.data.data, error: null }))
        .catch((err) => alive && setResults({ q: text, rows: [], error: getApiErrorMessage(err, 'Search failed') }))
    }, 250)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [text])
  const answered = text.length >= 2 && results?.q === text
  const searching = text.length >= 2 && !answered

  // The person may be missing from the list (e.g. moved off the team) — keep them selectable.
  const people =
    task && !assignees.some((a) => a.id === task.assigneeId) && task.assignee
      ? [{ id: task.assigneeId, name: task.assignee.name, role: task.assignee.role }, ...assignees]
      : assignees

  function validate() {
    if (!assigneeId) return 'Pick a person'
    if (!building) return 'Pick a building'
    if (!taskDate) return isPast ? 'Pick the day to move it to — today or later' : 'Pick a day'
    if (taskDate < today) return 'Pick today or a later day'
    if (!anyTime) {
      if (!startTime || !endTime) return 'Give both a start and an end time, or choose Any time'
      if (toMinutes(endTime) <= toMinutes(startTime)) return 'End time must be after start time'
    }
    return null
  }

  async function save() {
    const problem = validate()
    if (problem) return setError(problem)
    const fields = {
      assigneeId,
      buildingId: building.id,
      taskDate,
      startTime: anyTime ? null : startTime,
      endTime: anyTime ? null : endTime,
    }
    let body = fields
    if (task) {
      body = {}
      if (fields.assigneeId !== task.assigneeId) body.assigneeId = fields.assigneeId
      if (fields.buildingId !== task.buildingId) body.buildingId = fields.buildingId
      if (fields.taskDate !== task.taskDate) body.taskDate = fields.taskDate
      if (fields.startTime !== (task.startTime ?? null) || fields.endTime !== (task.endTime ?? null)) {
        body.startTime = fields.startTime
        body.endTime = fields.endTime
      }
      if (!Object.keys(body).length) return onClose()
    }
    setSaving(true)
    setError(null)
    try {
      if (task && following) {
        const res = await apiClient.patch(`/sales/tasks/${task.id}`, { ...body, scope: 'FOLLOWING' })
        return onSaved(seriesResultText('Changed', seriesCounts(res)))
      }
      const res = task ? await apiClient.patch(`/sales/tasks/${task.id}`, body) : await apiClient.post('/sales/tasks', body)
      const moved = task && body.taskDate ? ` to ${dayLabel(body.taskDate)}` : ''
      onSaved(
        task
          ? `Task ${body.taskDate ? 'moved' : 'saved'}${moved}${handoverText(res?.data?.data?.released ?? 0)}`
          : `Task added for ${dayLabel(taskDate)}`,
      )
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save the task'))
      setSaving(false)
    }
  }

  // A delete always starts on "This visit only", whatever Save was set to.
  function openDelete() {
    setScope('ONE')
    setConfirming(true)
  }

  async function remove() {
    setSaving(true)
    setError(null)
    try {
      if (following) {
        const res = await apiClient.delete(`/sales/tasks/${task.id}`, { params: { scope: 'FOLLOWING' } })
        return onSaved(seriesResultText('Deleted', seriesCounts(res)))
      }
      await apiClient.delete(`/sales/tasks/${task.id}`)
      onSaved('Task deleted')
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not delete the task'))
      setSaving(false)
      setConfirming(false)
    }
  }

  const title = !task ? 'Add task' : confirming ? 'Delete task' : isPast ? 'Move task' : 'Edit task'

  const footer = confirming ? (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button variant="secondary" onClick={() => (startDeleting ? onClose() : setConfirming(false))} disabled={saving}>
        Keep it
      </Button>
      <Button variant="danger" onClick={remove} loading={saving}>
        <IconTrash className="h-4 w-4" aria-hidden="true" /> {following ? 'Delete visits' : 'Delete task'}
      </Button>
    </div>
  ) : (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
      {task && (
        <Button variant="dangerGhost" onClick={openDelete} disabled={saving} className="sm:mr-auto">
          <IconTrash className="h-4 w-4" aria-hidden="true" /> Delete
        </Button>
      )}
      <Button variant="secondary" onClick={onClose} disabled={saving} className={task ? '' : 'sm:ml-auto'}>
        Cancel
      </Button>
      <Button onClick={save} loading={saving}>
        {task ? (isPast ? 'Move' : 'Save') : 'Add task'}
      </Button>
    </div>
  )

  return (
    <Modal open onClose={onClose} title={title} footer={footer} dismissable={false}>
      {confirming ? (
        <div className="text-sm text-ink">
          <p>
            Delete <span className="font-semibold">{task.building?.buildingName}</span> on {dayLabel(task.taskDate)} for{' '}
            {task.assignee?.name ?? 'this person'}?
          </p>
          {choices.length > 0 && (
            <div className="mt-4">
              <SeriesChoice choices={choices} value={scope} onChange={setScope} disabled={saving} />
            </div>
          )}
          {error && <p className="mt-3 text-sm font-medium text-bad">{error}</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {isPast && (
            <p className="rounded-btn bg-warn-tint px-4 py-3 text-sm font-medium text-warn">
              {dayLabel(task.taskDate)} has passed. Pick today or a later day to move it, or delete it.
            </p>
          )}

          <Select id="task-person" label="Person" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            {!assigneeId && <option value="">Pick a person</option>}
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.role ? ` · ${ROLE_LABELS[p.role] ?? p.role}` : ''}
              </option>
            ))}
          </Select>

          {building ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">Building</span>
              <div className="flex items-start justify-between gap-3 rounded-btn border border-line bg-paper px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-ink">{building.buildingName}</span>
                  {building.formattedAddress && (
                    <span className="mt-0.5 block line-clamp-2 text-sm text-muted">{building.formattedAddress}</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setBuilding(null)}
                  className="shrink-0 text-sm font-semibold text-fiber hover:underline"
                >
                  Change
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Input
                id="task-building"
                label="Building"
                placeholder="Type 2 or more letters of the name or address"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoComplete="off"
              />
              {searching && <p className="text-sm text-muted">Searching…</p>}
              {answered && results.error && <p className="text-sm font-medium text-bad">{results.error}</p>}
              {answered && !results.error && results.rows.length === 0 && (
                <p className="text-sm text-muted">No building you can plan matches “{text}”.</p>
              )}
              {answered && results.rows.length > 0 && (
                <ul className="max-h-56 divide-y divide-line overflow-y-auto rounded-btn border border-line bg-card" aria-label="Buildings found">
                  {results.rows.map((b) => (
                    <li key={b.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setBuilding(b)
                          setQ('')
                        }}
                        className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-paper"
                      >
                        <IconSearch className="mt-0.5 h-4 w-4 shrink-0 text-faint" aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-ink">{b.buildingName}</span>
                          {b.formattedAddress && (
                            <span className="block truncate text-xs text-muted">{b.formattedAddress}</span>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <Input
            id="task-date"
            type="date"
            label="Day"
            min={today}
            value={taskDate}
            onChange={(e) => setTaskDate(e.target.value)}
          />

          <div className="flex flex-col gap-3">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-ink">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={anyTime}
                onChange={(e) => setAnyTime(e.target.checked)}
              />
              Any time that day
            </label>
            {!anyTime && (
              <div className="grid grid-cols-2 gap-3">
                <Input id="task-start" type="time" label="Start" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                <Input id="task-end" type="time" label="End" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            )}
          </div>

          {choices.length > 0 && <SeriesChoice choices={choices} value={scope} onChange={setScope} disabled={saving} />}

          {error && <p className="text-sm font-medium text-bad">{error}</p>}
        </div>
      )}
    </Modal>
  )
}
