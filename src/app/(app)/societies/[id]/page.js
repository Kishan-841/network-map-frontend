'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import { isPermissionExecutive } from '@/lib/roles'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Toast } from '@/components/ui/Toast'
import { StatusChip } from '@/components/societies/StatusChip'
import { VisitUpdateModal } from '@/components/societies/VisitUpdateModal'
import { SocietyHistory } from '@/components/societies/SocietyHistory'
import { ApproveModal, RejectModal } from '@/components/societies/ApprovalModals'
import { SurveyActions, SurveySection, useSocietySurvey } from '@/components/societies/SurveySection'
import { invalidatePendingSocietyCount } from '@/hooks/usePendingSocietyCount'
import { IconEdit, IconPin, IconPlus, IconDoc, IconOkCircle, IconClose, IconChevronDown } from '@/components/ui/icons'
import {
  SOCIETY_OFFER_OPTIONS,
  PAYMENT_TYPE_OPTIONS,
  istDate,
  personMetText,
  canDecideApproval,
  canChangeSocietyStatus,
  peCanEdit,
  isApprovedSociety,
} from '@/lib/society'
import { hasDraft, sessionStore, surveyDraftKey, societyProgress, PROGRESS_STEPS } from '@/lib/society-survey'
import { statusStrip } from '@/lib/society-page'

const mapHref = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`
const optionLabel = (options, v) => options.find((o) => o.value === v)?.label ?? v
const PHOTO_LABEL = {
  ENTRANCE: 'Building photo',
  PERMISSION_LETTER: 'Permission letter',
  ADDITIONAL: 'Photo',
  SELFIE: 'Selfie',
  CONTACT_PERSON: 'Person met',
}
// A signed URL carries a query string — test the path, not the whole URL.
const isPdf = (url) => /\.pdf$/i.test(String(url ?? '').split('?')[0])
const rupees = (v) => `₹${Number(v).toLocaleString('en-IN')}`

function Section({ title, children }) {
  return (
    <section className="min-w-0 rounded-card border border-line bg-card p-4">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{title}</p>
      {children}
    </section>
  )
}

/** One part of the executive's details in the side column (hairline between parts). */
function Part({ title, children }) {
  return (
    <div className="min-w-0 py-3 first:pt-0 last:pb-0">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">{title}</p>
      {children}
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="shrink-0 text-sm font-normal text-muted">{label}</span>
      <span className="min-w-0 break-words text-right text-sm font-medium text-ink">{children}</span>
    </div>
  )
}

function PermissionDetails({ permission }) {
  if (!permission) return <p className="text-sm font-normal text-muted">Nothing recorded yet.</p>
  const p = permission
  return (
    <>
      <Row label="Society offers">{p.societyOffer ? optionLabel(SOCIETY_OFFER_OPTIONS, p.societyOffer) : 'Not recorded'}</Row>
      {p.societyOffer === 'PAYMENT' && (
        <>
          <Row label="Payment">{p.paymentType ? optionLabel(PAYMENT_TYPE_OPTIONS, p.paymentType) : '—'}</Row>
          <Row label="Amount">{p.amountPaid != null ? rupees(p.amountPaid) : '—'}</Row>
        </>
      )}
      {p.societyOffer === 'DEMO' && <Row label="Demo connections">{p.demoCount ?? '—'}</Row>}
      {p.permissionDate && <Row label="Permission date">{istDate(p.permissionDate)}</Row>}
      {p.renewalDate && <Row label="Renewal date">{istDate(p.renewalDate)}</Row>}
      {p.ownerName && <Row label="Owner">{p.ownerName}{p.ownerMobile ? ` · ${p.ownerMobile}` : ''}</Row>}
      <Row label="Permission letter">
        {p.documentUrl ? (
          <a href={p.documentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-fiber underline-offset-2 hover:underline">
            <IconDoc className="h-4 w-4" aria-hidden="true" />
            Open
          </a>
        ) : (
          'Not uploaded'
        )}
      </Row>
    </>
  )
}

const ALERT_TONE = {
  muted: 'border-line bg-paper text-ink',
  warn: 'border-warn/30 bg-warn-tint text-warn',
  bad: 'border-bad/30 bg-bad-tint text-bad',
}

/** Something the reader must not miss: waiting for approval, a rejection and its reason. */
function StripAlert({ alert }) {
  return (
    <div role="status" className={`min-w-0 rounded-btn border px-3 py-2 ${ALERT_TONE[alert.tone] ?? ALERT_TONE.muted}`}>
      <p className="break-words text-sm">
        <span className="font-semibold">{alert.title}</span>
        {alert.detail && <span className="font-normal"> · {alert.detail}</span>}
      </p>
      {alert.reason && (
        <p className="mt-1 whitespace-pre-wrap break-words text-sm font-normal text-ink">
          <span className="font-medium text-muted">{alert.reasonLabel}: </span>
          {alert.reason}
        </p>
      )}
    </div>
  )
}

/**
 * The one status card at the top: where the society is in the flow (chip +
 * five-step bar), the facts on one wrapped line, where it is, anything that
 * needs attention, and the actions open to this viewer.
 */
function StatusStrip({ building: b, survey, liveSince, buildingsHref, actions, note }) {
  const approval = b.approval
  const p = societyProgress({ approval, survey, isLive: b.isLive })
  const bad = p.className.includes('text-bad')
  const { facts, alerts } = statusStrip({
    approval,
    zone: b.zone,
    survey,
    isLive: b.isLive,
    liveSince,
    createdBy: b.createdBy,
    createdAt: b.createdAt,
  })
  return (
    <section className="min-w-0 rounded-card border border-line bg-card p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {approval?.status ? (
          <span
            className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${p.className}`}
          >
            {p.label}
          </span>
        ) : (
          <StatusChip status={b.permission?.permissionStatus} approval={approval} />
        )}
        {approval?.status && (
          <span className="text-xs font-normal text-muted">
            Step {p.step} of {PROGRESS_STEPS}
          </span>
        )}
      </div>
      {approval?.status && (
        <div className="mt-2 flex gap-1" aria-hidden="true">
          {Array.from({ length: PROGRESS_STEPS }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i < p.step ? (bad && i === p.step - 1 ? 'bg-bad' : 'bg-ok') : 'bg-line'}`}
            />
          ))}
        </div>
      )}
      {facts.length > 0 && (
        <p className="mt-2 break-words text-sm font-normal text-muted">
          {facts.join(' · ')}
          {buildingsHref && (
            <>
              {' · '}
              <Link href={buildingsHref} className="font-medium text-fiber underline-offset-2 hover:underline">
                Open in Buildings
              </Link>
            </>
          )}
        </p>
      )}
      <p className="mt-1 break-words text-sm font-normal text-ink">
        {b.formattedAddress}{' '}
        <a
          href={mapHref(b.latitude, b.longitude)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-fiber underline-offset-2 hover:underline"
        >
          <IconPin className="h-4 w-4" aria-hidden="true" />
          Open in Google Maps
        </a>
      </p>
      {alerts.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {alerts.map((a) => (
            <StripAlert key={a.title} alert={a} />
          ))}
        </div>
      )}
      {actions && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap [&>*]:whitespace-nowrap">{actions}</div>
      )}
      {note && <p className="mt-2 text-sm font-normal text-muted">{note}</p>}
    </section>
  )
}

/**
 * What the executive recorded — person met, permission, building facts,
 * photos. A narrow side column from lg (sticky while it fits the screen);
 * on a phone it folds under one "Society details" row, closed at first.
 */
function SocietyDetails({ building: b }) {
  const [open, setOpen] = useState(false)
  const photos = b.photos ?? []
  const summary = [
    b.contact ? personMetText(b.contact) : null,
    photos.length ? `${photos.length} ${photos.length === 1 ? 'photo' : 'photos'}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <aside className="min-w-0 rounded-card border border-line bg-card lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="society-details"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-2 text-left lg:hidden"
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-ink">Society details</span>
          {summary && <span className="block truncate text-xs font-normal text-muted">{summary}</span>}
        </span>
        <IconChevronDown
          className={`h-5 w-5 shrink-0 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      <div
        id="society-details"
        className={`${open ? 'block border-t border-line' : 'hidden'} divide-y divide-line px-4 py-3 lg:block lg:border-t-0 lg:py-4`}
      >
        <Part title="Person met">
          {b.contact ? (
            <>
              <p className="text-sm font-medium text-ink">{personMetText(b.contact)}</p>
              {b.contact.contactPhone && (
                <a href={`tel:${b.contact.contactPhone}`} className="text-sm font-normal text-fiber">
                  {b.contact.contactPhone}
                </a>
              )}
              {b.contact.contactEmail && (
                <p className="break-all text-sm font-normal text-muted">{b.contact.contactEmail}</p>
              )}
            </>
          ) : (
            <p className="text-sm font-normal text-muted">Nobody recorded.</p>
          )}
        </Part>

        <Part title="Permission details">
          <PermissionDetails permission={b.permission} />
        </Part>

        {(b.details?.wings != null || b.details?.floors != null || b.details?.homePass != null) && (
          <Part title="Building">
            {b.details.wings != null && <Row label="Wings">{b.details.wings}</Row>}
            {b.details.floors != null && <Row label="Floors">{b.details.floors}</Row>}
            {b.details.homePass != null && <Row label="Home pass">{b.details.homePass}</Row>}
          </Part>
        )}

        <Part title="Photos">
          {photos.length === 0 ? (
            <p className="text-sm font-normal text-muted">No photos.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {photos.map((p) => (
                <a
                  key={p.id}
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  title={PHOTO_LABEL[p.type] ?? p.type}
                  className="block w-[68px] min-w-0"
                >
                  {isPdf(p.url) ? (
                    <span className="flex h-[68px] w-[68px] items-center justify-center rounded-btn border border-line bg-paper text-muted">
                      <IconDoc className="h-6 w-6" aria-hidden="true" />
                    </span>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.url}
                      alt={PHOTO_LABEL[p.type] ?? 'Photo'}
                      className="h-[68px] w-[68px] rounded-btn border border-line bg-paper object-cover"
                    />
                  )}
                  <span className="mt-0.5 block truncate text-[11px] font-medium text-muted">
                    {PHOTO_LABEL[p.type] ?? p.type}
                  </span>
                </a>
              ))}
            </div>
          )}
        </Part>
      </div>
    </aside>
  )
}

/**
 * One society: where it stands (one status strip with the actions), the site
 * survey once approved, the history of visits and edits (newest first), and —
 * in a side column from lg, folded on a phone — what the executive recorded.
 * The executive (their own) and the admin (anyone's) add visit updates; the
 * executive edits details.
 */
export default function SocietyPage() {
  const { id } = useParams()
  const role = useAuthStore((s) => s.user?.role)
  const isPE = isPermissionExecutive(role)
  // Phase 3: the zone's surveyor reads the society and fills the site survey;
  // visit updates stay the executive's and the admin's.
  const isSurveyor = role === 'SURVEYOR'
  const userId = useAuthStore((s) => s.user?.id)

  // Unsaved survey edits are kept on this device (sessionStorage); still,
  // leaving by the Back link asks first.
  function confirmLeave(e) {
    if (!hasDraft(sessionStore(), surveyDraftKey(id, userId))) return
    if (!window.confirm('Leave without saving? Your survey edits will be kept on this device.')) e.preventDefault()
  }

  const [tick, setTick] = useState(0)
  // { id, data } or { id, error, notFound }. Kept across a reload so the page
  // does not blank while it refetches after a visit update.
  const [result, setResult] = useState(null)
  const [visitOpen, setVisitOpen] = useState(false)
  // 'approve' | 'reject' | null — the admin's decision modal.
  const [deciding, setDeciding] = useState(null)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    let alive = true
    apiClient
      .get(`/permission-buildings/${id}`)
      .then((res) => alive && setResult({ id, data: res.data.data }))
      .catch((err) => {
        if (!alive) return
        const notFound = err.response?.status === 404
        const error = notFound ? null : getApiErrorMessage(err, 'Could not load this society')
        // A failed refresh (e.g. right after a saved visit update) keeps what is
        // already on screen and just shows the error above it.
        setResult((prev) =>
          !notFound && prev?.id === id && prev.data ? { ...prev, error } : { id, notFound, error },
        )
      })
    return () => {
      alive = false
    }
  }, [id, tick])

  const current = result?.id === id ? result : null
  const b = current?.data

  function onSaved() {
    setVisitOpen(false)
    setToast('Visit update saved')
    setTick((t) => t + 1)
    // A visit that sets Accepted sends it for approval; one that moves off
    // Accepted withdraws it — either way the admin's count may change.
    invalidatePendingSocietyCount()
  }

  function onDecided(message) {
    setDeciding(null)
    setToast(message)
    setTick((t) => t + 1)
    invalidatePendingSocietyCount()
  }

  function onSurveyChanged(message) {
    setToast(message)
    setTick((t) => t + 1)
    invalidatePendingSocietyCount()
  }

  // The survey is shared by the status strip (stage, facts, decisions) and
  // the survey card; it loads only once the society is approved.
  const sv = useSocietySurvey(b, role, onSurveyChanged)

  const approval = b?.approval ?? null
  const canDecide = canDecideApproval(role, approval)
  const approved = isApprovedSociety(approval)
  // Until the survey itself has loaded, the society read's summary stands in.
  const stripSurvey = sv.loaded && !sv.loaded.error ? sv.survey : (b?.survey ?? null)

  const showVisit = !isSurveyor
  const showEdit = isPE && peCanEdit(role, approval)
  const hasActions = canDecide || showVisit || showEdit || sv.canDecide || sv.canLive

  return (
    <main className="mx-auto max-w-6xl">
      <PageHeader
        title={b?.buildingName ?? 'Society'}
        backHref="/societies"
        backLabel={isSurveyor ? 'Society surveys' : 'Society permissions'}
        onBackClick={confirmLeave}
      />
      <Toast key={toast} message={toast} onDone={() => setToast(null)} />

      {!current && <p className="text-sm font-normal text-muted">Loading…</p>}
      {current?.notFound && (
        <div className="rounded-card border border-line bg-card p-6 text-center">
          <p className="font-medium text-ink">Society not found</p>
          <p className="mt-1 text-sm font-normal text-muted">It does not exist, or it is not one of yours.</p>
        </div>
      )}
      {current?.error && (
        <p className="mb-4 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{current.error}</p>
      )}

      {b && (
        <>
          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
            {/* On a phone this column dissolves (contents) so the details can sit
                between the status strip and the survey; from lg it is a column. */}
            <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-4">
              <div className="order-1 min-w-0">
                <StatusStrip
                  building={b}
                  survey={stripSurvey}
                  liveSince={sv.liveSince}
                  buildingsHref={approved && !isPE ? `/buildings/${b.id}` : null}
                  note={
                    sv.editingBlocksDecisions ? 'Save or cancel your survey edits to approve, reject or mark live.' : null
                  }
                  actions={
                    hasActions ? (
                      <>
                        {canDecide && (
                          <>
                            <Button
                              type="button"
                              variant="success"
                              onClick={() => setDeciding('approve')}
                              className="sm:flex-1"
                            >
                              <IconOkCircle className="h-4 w-4" aria-hidden="true" />
                              Approve
                            </Button>
                            <Button
                              type="button"
                              variant="dangerGhost"
                              onClick={() => setDeciding('reject')}
                              className="sm:flex-1"
                            >
                              <IconClose className="h-4 w-4" aria-hidden="true" />
                              Reject
                            </Button>
                          </>
                        )}
                        <SurveyActions sv={sv} />
                        {showVisit && (
                          <Button
                            type="button"
                            variant={canDecide || sv.canDecide || sv.canLive ? 'secondary' : 'primary'}
                            onClick={() => setVisitOpen(true)}
                            className="sm:flex-1"
                          >
                            <IconPlus className="h-4 w-4" aria-hidden="true" />
                            Add visit update
                          </Button>
                        )}
                        {showEdit && (
                          <Link
                            href={`/societies/add?edit=${b.id}`}
                            className="btn btn-outline h-12 min-h-12 gap-2 rounded-btn text-[15px] font-medium normal-case sm:flex-1"
                          >
                            <IconEdit className="h-4 w-4" aria-hidden="true" />
                            Edit details
                          </Link>
                        )}
                      </>
                    ) : null
                  }
                />
              </div>

              {approved && (
                <div className="order-3 min-w-0">
                  <SurveySection sv={sv} />
                </div>
              )}

              <div className="order-4 min-w-0">
                <Section title={`History${b.visits?.length ? ` · ${b.visits.length}` : ''}`}>
                  <SocietyHistory visits={b.visits} zone={b.zone} />
                </Section>
              </div>
            </div>

            <div className="order-2 min-w-0 lg:order-none lg:sticky lg:top-6">
              <SocietyDetails building={b} />
            </div>
          </div>

          {visitOpen && (
            <VisitUpdateModal
              buildingId={b.id}
              currentStatus={b.permission?.permissionStatus ?? ''}
              canChangeStatus={canChangeSocietyStatus(approval)}
              onClose={() => setVisitOpen(false)}
              onSaved={onSaved}
            />
          )}
          {deciding === 'approve' && (
            <ApproveModal
              buildingId={b.id}
              buildingName={b.buildingName}
              zoneId={b.zone?.id ?? b.zoneId}
              onClose={() => setDeciding(null)}
              onDone={onDecided}
            />
          )}
          {deciding === 'reject' && (
            <RejectModal
              buildingId={b.id}
              buildingName={b.buildingName}
              onClose={() => setDeciding(null)}
              onDone={onDecided}
            />
          )}
        </>
      )}
    </main>
  )
}
