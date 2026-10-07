'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import { canPlanVisits, ROLE_LABELS } from '@/lib/roles'
import { downloadCsvTemplate } from '@/lib/spreadsheet'
import { PLAN_TEMPLATE_CSV, fmtDay } from '@/lib/visit-plan-sheet'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Toast } from '@/components/ui/Toast'
import { UploadPlanModal } from '@/components/sales/plan/UploadPlanModal'
import { PlanCalendar } from '@/components/sales/plan/PlanCalendar'
import { Select } from '@/components/ui/Input'
import { IconUpload, IconDownload, IconCalendar } from '@/components/ui/icons'

const fmtWhen = (iso) =>
  new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  })

/**
 * Team plan: a team leader, sales manager or admin uploads a sheet of which
 * building each person visits on which day (spec 2026-10-07 §2), and sees the
 * uploads made so far. Above the uploads, the planner picks one person and
 * reviews their plan day by day — live status, off-plan visits, a one-line
 * summary — and adds, edits, moves or deletes single tasks (§3–§4).
 */
export default function TeamPlanPage() {
  const role = useAuthStore((s) => s.user?.role)
  const allowed = canPlanVisits(role)
  const [uploads, setUploads] = useState(null) // null = loading
  const [error, setError] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState(null)
  const [team, setTeam] = useState(null) // { people, error } — null = loading
  const [picked, setPicked] = useState('')
  const [planVersion, setPlanVersion] = useState(0) // bumps after an upload so the calendar refetches

  const load = useCallback(() => {
    apiClient
      .get('/sales/tasks/uploads')
      .then((res) => {
        setUploads(res.data.data)
        setError(null)
      })
      .catch((err) => {
        setUploads([])
        setError(getApiErrorMessage(err, 'Could not load the uploads'))
      })
  }, [])
  useEffect(() => {
    if (allowed) load()
  }, [allowed, load])
  useEffect(() => {
    if (!allowed) return undefined
    let alive = true
    apiClient
      .get('/sales/tasks/assignees')
      .then((res) => alive && setTeam({ people: res.data.data, error: null }))
      .catch((err) => alive && setTeam({ people: [], error: getApiErrorMessage(err, 'Could not load your team') }))
    return () => {
      alive = false
    }
  }, [allowed])
  // Default to the first person until the planner picks one.
  const personId = picked || team?.people[0]?.id || ''

  if (!allowed) {
    return <PageHeader title="Team plan" sub="Only team leaders, sales managers and admins plan visits." />
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Team plan" sub="Plan your team's visits" />

      <section className="mb-8" aria-label="Person's plan">
        {team === null ? (
          <p className="text-sm text-muted">Loading your team…</p>
        ) : team.error ? (
          <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-medium text-bad">{team.error}</p>
        ) : team.people.length === 0 ? (
          <div className="rounded-card border border-line bg-card px-4 py-8 text-center text-sm text-muted">
            Nobody on your team is given visits yet.
          </div>
        ) : (
          <>
            <div className="mb-4 sm:max-w-sm">
              <Select id="plan-person" label="Person" value={personId} onChange={(e) => setPicked(e.target.value)}>
                {team.people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {ROLE_LABELS[p.role] ?? p.role}
                  </option>
                ))}
              </Select>
            </div>
            <PlanCalendar key={planVersion} userId={personId} editable assignees={team.people} />
          </>
        )}
      </section>

      <h2 className="mb-3 text-base font-bold">Upload a plan</h2>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <Button onClick={() => setUploading(true)} className="sm:flex-none">
          <IconUpload className="h-4.5 w-4.5" /> Upload sheet
        </Button>
        <Button
          variant="secondary"
          onClick={() => downloadCsvTemplate('visit-plan-template.csv', PLAN_TEMPLATE_CSV)}
          className="sm:flex-none"
        >
          <IconDownload className="h-4.5 w-4.5" /> Download template
        </Button>
      </div>

      {toast && <Toast key={toast} message={toast} onDone={() => setToast(null)} />}
      {error && <p className="mb-4 rounded-btn bg-bad-tint px-4 py-3 text-sm font-medium text-bad">{error}</p>}

      <h2 className="mb-3 text-base font-bold">Uploads</h2>
      {uploads === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : uploads.length === 0 ? (
        <div className="rounded-card border border-line bg-card px-4 py-8 text-center text-sm text-muted">
          No plan uploaded yet. Download the template, fill it in, and upload it.
        </div>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Uploads">
          {uploads.map((u) => (
            <li key={u.id} className="flex items-start gap-3 rounded-card border border-line bg-card p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paper text-fiber">
                <IconCalendar className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">
                  {fmtDay(u.fromDate)}
                  {u.toDate && u.toDate !== u.fromDate ? ` – ${fmtDay(u.toDate)}` : ''} · {u.assigneeCount}{' '}
                  {u.assigneeCount === 1 ? 'person' : 'people'}
                </p>
                <p className="mt-0.5 truncate text-sm text-muted">
                  {fmtWhen(u.createdAt)} by {u.uploadedBy?.name ?? 'someone'}
                  {u.fileName ? ` · ${u.fileName}` : ''}
                </p>
                <p className="mt-1.5 text-sm text-ink">
                  {u.created} created · {u.replaced} replaced · {u.assigned} assigned
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {uploading && (
        <UploadPlanModal
          onClose={() => setUploading(false)}
          onSaved={(message) => {
            setUploading(false)
            setToast(message)
            load()
            setPlanVersion((v) => v + 1)
          }}
        />
      )}
    </div>
  )
}
