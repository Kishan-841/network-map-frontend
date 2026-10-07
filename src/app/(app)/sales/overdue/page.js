'use client'

import { useEffect, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import { receivesVisitTasks } from '@/lib/roles'
import { dayLabel } from '@/lib/visit-task-status'
import { PageHeader } from '@/components/ui/PageHeader'
import { TaskCard } from '@/components/sales/plan/TaskCard'

/** Planned visits you missed in the last 30 days, newest first. Read-only. */
export default function OverduePage() {
  const role = useAuthStore((s) => s.user?.role)
  const allowed = receivesVisitTasks(role)
  const [state, setState] = useState(null) // null = loading; { tasks, error }

  useEffect(() => {
    if (!allowed) return undefined
    let alive = true
    apiClient
      .get('/sales/tasks/overdue')
      .then((res) => alive && setState({ tasks: res.data.data, error: null }))
      .catch((err) => alive && setState({ tasks: [], error: getApiErrorMessage(err, 'Could not load overdue visits') }))
    return () => {
      alive = false
    }
  }, [allowed])

  if (!allowed) {
    return <PageHeader title="Overdue" sub="Only sales executives and team leaders are given visits to make." />
  }

  // The API sends them newest first; keep that order while grouping by day.
  const groups = []
  for (const t of state?.tasks ?? []) {
    if (groups.at(-1)?.day !== t.taskDate) groups.push({ day: t.taskDate, tasks: [] })
    groups.at(-1).tasks.push(t)
  }

  return (
    <main className="mx-auto max-w-3xl">
      <PageHeader title="Overdue" sub="Planned visits you missed in the last 30 days" />
      {state?.error && (
        <p className="mb-4 rounded-btn bg-bad-tint px-4 py-3 text-sm font-medium text-bad">{state.error}</p>
      )}
      {state === null ? (
        <p className="py-8 text-center text-sm text-muted">Loading…</p>
      ) : groups.length === 0 ? (
        !state.error && (
          <div className="rounded-card border border-line bg-card px-4 py-8 text-center text-sm text-muted">
            Nothing overdue — well done
          </div>
        )
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((g) => (
            <section key={g.day}>
              <h2 className="mb-2 text-sm font-bold text-ink">
                {dayLabel(g.day, { weekday: 'long' })}
                <span className="ml-2 font-medium text-muted">{g.tasks.length} missed</span>
              </h2>
              <ul className="flex flex-col gap-3">
                {g.tasks.map((t) => (
                  <li key={t.id}>
                    <TaskCard task={t} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  )
}
