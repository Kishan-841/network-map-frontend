'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/Button'
import { IconOkCircle, IconClose } from '@/components/ui/icons'
import { MaterialList } from '@/components/societies/MaterialList'
import { SurveyEditor } from '@/components/societies/SurveyEditor'
import { ApproveMaterialsModal, RejectMaterialsModal, MarkLiveModal } from '@/components/societies/SurveyModals'
import {
  canDecideSurvey,
  canMarkLive,
  canSubmitSurvey,
  linkMethodLabel,
  surveyEditMode,
  surveyNotice,
  surveyDraftKey,
  surveyRemarkField,
  surveyToForm,
} from '@/lib/society-survey'

const TONE = {
  muted: 'border-line bg-paper text-ink',
  warn: 'border-warn/30 bg-warn-tint text-warn',
  bad: 'border-bad/30 bg-bad-tint text-bad',
  ok: 'border-ok/30 bg-ok-tint text-ok',
}

/** GET …/survey answers the survey or null (possibly wrapped as { survey }). */
const unwrap = (data) => (data && typeof data === 'object' && 'survey' in data ? data.survey : (data ?? null))

const yesNo = (v) => (v ? 'Yes' : 'No')

function Line({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="shrink-0 text-sm font-normal text-muted">{label}</span>
      <span className="min-w-0 break-words text-right text-sm font-medium text-ink">{children}</span>
    </div>
  )
}

const Sub = ({ children }) => <p className="mb-1 mt-4 text-xs font-medium uppercase tracking-wide text-faint">{children}</p>

/** The saved survey, read-only (the surveyor after approval, the executive). */
function SurveyReadOnly({ survey }) {
  if (!survey) return <p className="text-sm font-normal text-muted">The zone’s surveyor has not started the survey.</p>
  const c = survey.checks ?? {}
  const wings = survey.wings ?? []
  const links = survey.links ?? []
  return (
    <div className="min-w-0">
      <Sub>Checks</Sub>
      <Line label="Building name is right">
        {yesNo(c.nameOk ?? true)}
        {c.nameOk === false && c.nameCorrection ? ` — ${c.nameCorrection}` : ''}
      </Line>
      <Line label="Wings match">{yesNo(c.wingsOk ?? true)}</Line>
      <Line label="Home pass matches">{yesNo(c.homePassOk ?? true)}</Line>
      {c.note && <p className="mt-1 whitespace-pre-wrap break-words rounded-btn bg-paper px-3 py-2 text-sm font-normal text-ink">{c.note}</p>}

      <Sub>Wings ({wings.length})</Sub>
      {wings.length === 0 ? (
        <p className="text-sm font-normal text-muted">None.</p>
      ) : (
        <ul className="divide-y divide-line/60">
          {wings.map((w) => (
            <li key={w.name} className="flex flex-wrap items-baseline justify-between gap-x-3 py-1.5 text-sm">
              <span className="font-medium text-ink">Wing {w.name}</span>
              <span className="font-normal tabular-nums text-muted">
                {w.floors} floors × {w.flatsPerFloor} flats · {w.shafts} {w.shafts === 1 ? 'shaft' : 'shafts'} ·{' '}
                <span className="font-medium text-ink">{w.homePass} home pass</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <Sub>Links ({links.length})</Sub>
      {links.length === 0 ? (
        <p className="text-sm font-normal text-muted">None.</p>
      ) : (
        <ul className="divide-y divide-line/60">
          {links.map((l, i) => (
            <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-3 py-1.5 text-sm">
              <span className="font-medium text-ink">
                {l.from} → {l.to}
              </span>
              <span className="font-normal text-muted">
                {linkMethodLabel(l.method)}
                {l.meters != null ? ` · ${l.meters} m` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Sub>Materials</Sub>
      <MaterialList materials={survey.materials} />
    </div>
  )
}

/**
 * Site survey & materials on an approved society. The zone's surveyor fills
 * it in and sends it; the admin approves or rejects the material request;
 * after approval the surveyor marks the building live. `onChanged(message)`
 * lets the page reload the society (history, live flag) and show a toast.
 */
export function SurveySection({ building, role, onChanged }) {
  const id = building.id
  const [tick, setTick] = useState(0)
  const [result, setResult] = useState(null) // { key, survey } | { key, error }
  const [modal, setModal] = useState(null) // 'approve' | 'reject' | 'live'
  // ADMIN on a waiting or approved survey: read-only until "Edit survey", so
  // a decision (which reloads the survey) can never wipe edits in progress.
  const [editing, setEditing] = useState(false)
  // A submit that failed after its save: shown here, where it survives the reload.
  const [submitError, setSubmitError] = useState(null)
  const userId = useAuthStore((s) => s.user?.id)
  const key = `${id}|${tick}`

  useEffect(() => {
    let alive = true
    apiClient
      .get(`/permission-buildings/${id}/survey`)
      .then((res) => alive && setResult({ key, survey: unwrap(res.data.data) }))
      .catch((err) => alive && setResult({ key, error: getApiErrorMessage(err, 'Could not load the survey') }))
    return () => {
      alive = false
    }
  }, [id, key])

  // Keep the last survey on screen while a refresh loads.
  const loaded = result && result.key.startsWith(`${id}|`) ? result : null
  const survey = loaded?.survey ?? null
  const isLive = Boolean(building.isLive)
  const liveSince = (building.visits ?? []).find((v) => v.kind === 'MARKED_LIVE')?.createdAt ?? null

  function done(message, error = null) {
    setModal(null)
    setEditing(false)
    setSubmitError(error)
    setTick((t) => t + 1)
    onChanged(message)
  }

  const initial = useMemo(() => surveyToForm(survey), [survey])
  const mode = surveyEditMode(role, survey, isLive)
  const adminGate = role === 'ADMIN' && (survey?.status === 'SUBMITTED' || survey?.status === 'APPROVED')
  const editorOpen = mode !== 'read' && (!adminGate || editing)
  const showEditor = loaded && !loaded.error && editorOpen
  // No decision or Mark live while the admin has the editor open.
  const decisionsShown = !(adminGate && editing)
  const notice = surveyNotice(survey, isLive, liveSince)

  return (
    <section className="mb-4 min-w-0 rounded-card border border-line bg-card p-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">Site survey &amp; materials</p>

      {!loaded && <p className="text-sm font-normal text-muted">Loading…</p>}
      {loaded?.error && <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{loaded.error}</p>}

      {loaded && !loaded.error && (
        <>
          <div role="status" className={`mb-4 min-w-0 rounded-card border px-4 py-3 ${TONE[notice.tone]}`}>
            <p className="text-sm font-semibold">{notice.title}</p>
            {notice.detail && <p className="mt-0.5 break-words text-sm font-normal">{notice.detail}</p>}
            {notice.reason && (
              <p className="mt-2 whitespace-pre-wrap break-words rounded-btn bg-card px-3 py-2 text-sm font-normal text-ink">
                <span className="font-medium text-muted">{notice.reasonLabel ?? 'Reason'}: </span>
                {notice.reason}
              </p>
            )}
            {decisionsShown && canDecideSurvey(role, survey) && (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Button type="button" variant="success" onClick={() => setModal('approve')} className="sm:flex-1">
                  <IconOkCircle className="h-4 w-4" aria-hidden="true" />
                  Approve materials
                </Button>
                <Button type="button" variant="dangerGhost" onClick={() => setModal('reject')} className="sm:flex-1">
                  <IconClose className="h-4 w-4" aria-hidden="true" />
                  Reject
                </Button>
              </div>
            )}
            {decisionsShown && canMarkLive(role, survey, isLive) && (
              <Button type="button" variant="success" onClick={() => setModal('live')} className="mt-3 w-full sm:w-auto">
                <IconOkCircle className="h-4 w-4" aria-hidden="true" />
                Mark live
              </Button>
            )}
            {adminGate && editing && (
              <p className="mt-2 text-sm font-normal">Save or cancel your edits to approve, reject or mark live.</p>
            )}
          </div>

          {submitError && (
            <p role="alert" className="mb-4 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">
              Saved, but not sent for approval: {submitError}
            </p>
          )}

          {showEditor ? (
            <SurveyEditor
              key={`${survey?.updatedAt ?? 'new'}|${mode}`}
              buildingId={id}
              initial={initial}
              draftKey={surveyDraftKey(id, userId)}
              basedOn={survey?.updatedAt ?? 'new'}
              onCancel={adminGate ? () => setEditing(false) : undefined}
              remarkField={surveyRemarkField(role, survey)}
              canSubmit={canSubmitSurvey(role, survey)}
              expected={building.details}
              onSaved={done}
            />
          ) : (
            <>
              <SurveyReadOnly survey={survey} />
              {adminGate && mode !== 'read' && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setSubmitError(null)
                    setEditing(true)
                  }}
                  className="mt-4 w-full sm:w-auto"
                >
                  {survey?.status === 'APPROVED' ? 'Edit survey (logged)' : 'Edit survey'}
                </Button>
              )}
            </>
          )}
        </>
      )}

      {modal === 'approve' && (
        <ApproveMaterialsModal buildingId={id} buildingName={building.buildingName} onClose={() => setModal(null)} onDone={done} />
      )}
      {modal === 'reject' && (
        <RejectMaterialsModal buildingId={id} buildingName={building.buildingName} onClose={() => setModal(null)} onDone={done} />
      )}
      {modal === 'live' && (
        <MarkLiveModal buildingId={id} buildingName={building.buildingName} onClose={() => setModal(null)} onDone={done} />
      )}
    </section>
  )
}
