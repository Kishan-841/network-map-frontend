'use client'

import { useEffect, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { fmtDay } from '@/lib/visit-plan-sheet'
import { IconTrash } from '@/components/ui/icons'

const STATUS = {
  VISITED: { label: 'Visited', cls: 'bg-ok-tint text-ok' },
  MISSED: { label: 'Missed', cls: 'bg-bad-tint text-bad' },
  UPCOMING: { label: 'Upcoming', cls: 'bg-paper text-muted' },
}

/**
 * One upload's tasks, opened from the Uploads list: day, time, person,
 * building and status. ADMIN gets Delete on every task without a visit
 * (a two-tap confirm in the row); a visited task can't be deleted.
 */
export function UploadTasks({ uploadId, canDelete, onChanged }) {
  const [tasks, setTasks] = useState(null) // null = loading
  const [error, setError] = useState(null)
  const [confirming, setConfirming] = useState(null) // task id whose Delete asks "sure?"
  const [deleting, setDeleting] = useState(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let alive = true
    apiClient
      .get(`/sales/tasks/uploads/${uploadId}/tasks`)
      .then((res) => {
        if (!alive) return
        setTasks(res.data.data)
        setError(null)
      })
      .catch((err) => {
        if (!alive) return
        setTasks([])
        setError(getApiErrorMessage(err, 'Could not load the visits'))
      })
    return () => {
      alive = false
    }
  }, [uploadId, version])

  async function remove(id) {
    setDeleting(id)
    setError(null)
    try {
      await apiClient.delete(`/sales/tasks/${id}`)
      setConfirming(null)
      setVersion((v) => v + 1)
      onChanged?.('Visit deleted')
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not delete the visit'))
    } finally {
      setDeleting(null)
    }
  }

  if (tasks === null) return <p className="py-3 text-sm text-muted">Loading visits…</p>

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-medium text-bad">{error}</p>}
      {tasks.length === 0 ? (
        <p className="py-3 text-sm text-muted">No visits left in this upload.</p>
      ) : (
        <ul className="divide-y divide-line rounded-btn border border-line" aria-label="Visits in this upload">
          {tasks.map((t) => {
            const st = STATUS[t.status] ?? STATUS.UPCOMING
            const asking = confirming === t.id
            return (
              <li key={t.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{t.building?.buildingName ?? 'Building'}</p>
                  <p className="truncate text-xs text-muted">
                    {fmtDay(t.taskDate)} · {t.startTime && t.endTime ? `${t.startTime}–${t.endTime}` : 'Any time'} ·{' '}
                    {t.assignee?.name ?? 'Someone'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
                  {canDelete && t.status !== 'VISITED' && (asking ? (
                    <>
                      <button
                        type="button"
                        onClick={() => remove(t.id)}
                        disabled={deleting === t.id}
                        className="rounded-btn bg-bad px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {deleting === t.id ? 'Deleting…' : 'Delete'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirming(null)}
                        disabled={deleting === t.id}
                        className="rounded-btn px-2 py-1 text-xs font-semibold text-muted hover:bg-paper"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirming(t.id)}
                      aria-label={`Delete visit to ${t.building?.buildingName ?? 'building'} on ${fmtDay(t.taskDate)}`}
                      className="rounded-btn p-1.5 text-bad hover:bg-bad-tint"
                    >
                      <IconTrash className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
