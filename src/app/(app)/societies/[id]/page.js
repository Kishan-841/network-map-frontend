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
import { ApprovalNotice } from '@/components/societies/ApprovalNotice'
import { ApproveModal, RejectModal } from '@/components/societies/ApprovalModals'
import { invalidatePendingSocietyCount } from '@/hooks/usePendingSocietyCount'
import { IconEdit, IconPin, IconPlus, IconDoc, IconOkCircle, IconClose } from '@/components/ui/icons'
import {
  SOCIETY_OFFER_OPTIONS,
  PAYMENT_TYPE_OPTIONS,
  istDate,
  personMetText,
  canDecideApproval,
  canChangeSocietyStatus,
  peCanEdit,
} from '@/lib/society'

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
    <section className="mb-4 min-w-0 rounded-card border border-line bg-card p-4">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{title}</p>
      {children}
    </section>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
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

/**
 * One society: where it is, who was met, what was agreed, its photos, and the
 * full history of visits and edits, newest first. The executive (their own)
 * and the admin (anyone's) add visit updates; the executive edits details.
 */
export default function SocietyPage() {
  const { id } = useParams()
  const role = useAuthStore((s) => s.user?.role)
  const isPE = isPermissionExecutive(role)

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

  const approval = b?.approval ?? null
  const canDecide = canDecideApproval(role, approval)

  const photos = b?.photos ?? []

  return (
    <main className="mx-auto max-w-3xl">
      <PageHeader
        title={b?.buildingName ?? 'Society'}
        backHref="/societies"
        backLabel="Society permissions"
      />
      <Toast key={toast} message={toast} onDone={() => setToast(null)} />

      {!current && <p className="text-sm font-normal text-muted">Loading…</p>}
      {current?.notFound && (
        <div className="rounded-card border border-line bg-card p-6 text-center">
          <p className="font-medium text-ink">Society not found</p>
          <p className="mt-1 text-sm font-normal text-muted">It does not exist, or it is not one of yours.</p>
        </div>
      )}
      {current?.error && <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{current.error}</p>}

      {b && (
        <>
          <ApprovalNotice approval={approval} zone={b.zone} buildingId={isPE ? null : b.id} />

          <section className="mb-4 min-w-0 rounded-card border border-line bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 break-words text-sm font-normal text-ink">{b.formattedAddress}</p>
              <StatusChip status={b.permission?.permissionStatus} approval={approval} className="shrink-0" />
            </div>
            <a
              href={mapHref(b.latitude, b.longitude)}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-fiber underline-offset-2 hover:underline"
            >
              <IconPin className="h-4 w-4" aria-hidden="true" />
              Open in Google Maps
            </a>
            <p className="mt-2 text-xs font-normal text-faint">
              Added by {b.createdBy?.name ?? '—'} on {istDate(b.createdAt)}
              {b.zone?.name ? ` · ${b.zone.name}` : ''}
            </p>
            {canDecide && (
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button type="button" variant="success" onClick={() => setDeciding('approve')} className="sm:flex-1">
                  <IconOkCircle className="h-4 w-4" aria-hidden="true" />
                  Approve
                </Button>
                <Button type="button" variant="dangerGhost" onClick={() => setDeciding('reject')} className="sm:flex-1">
                  <IconClose className="h-4 w-4" aria-hidden="true" />
                  Reject
                </Button>
              </div>
            )}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant={canDecide ? 'secondary' : 'primary'}
                onClick={() => setVisitOpen(true)}
                className="sm:flex-1"
              >
                <IconPlus className="h-4 w-4" aria-hidden="true" />
                Add visit update
              </Button>
              {isPE && peCanEdit(role, approval) && (
                <Link
                  href={`/societies/add?edit=${b.id}`}
                  className="btn btn-outline h-12 min-h-12 gap-2 rounded-btn text-[15px] font-medium normal-case sm:flex-1"
                >
                  <IconEdit className="h-4 w-4" aria-hidden="true" />
                  Edit details
                </Link>
              )}
            </div>
          </section>

          <Section title="Person met">
            {b.contact ? (
              <>
                <p className="text-sm font-medium text-ink">{personMetText(b.contact)}</p>
                {b.contact.contactPhone && (
                  <a href={`tel:${b.contact.contactPhone}`} className="text-sm font-normal text-fiber">
                    {b.contact.contactPhone}
                  </a>
                )}
                {b.contact.contactEmail && <p className="break-all text-sm font-normal text-muted">{b.contact.contactEmail}</p>}
              </>
            ) : (
              <p className="text-sm font-normal text-muted">Nobody recorded.</p>
            )}
          </Section>

          <Section title="Permission details">
            <PermissionDetails permission={b.permission} />
          </Section>

          {(b.details?.wings != null || b.details?.floors != null || b.details?.homePass != null) && (
            <Section title="Building">
              {b.details.wings != null && <Row label="Wings">{b.details.wings}</Row>}
              {b.details.floors != null && <Row label="Floors">{b.details.floors}</Row>}
              {b.details.homePass != null && <Row label="Home pass">{b.details.homePass}</Row>}
            </Section>
          )}

          <Section title="Photos">
            {photos.length === 0 ? (
              <p className="text-sm font-normal text-muted">No photos.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map((p) => (
                  <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="block min-w-0">
                    {isPdf(p.url) ? (
                      <span className="flex aspect-square items-center justify-center rounded-btn border border-line bg-paper text-muted">
                        <IconDoc className="h-8 w-8" aria-hidden="true" />
                      </span>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.url} alt={PHOTO_LABEL[p.type] ?? 'Photo'} className="aspect-square w-full rounded-btn border border-line bg-paper object-cover" />
                    )}
                    <span className="mt-1 block truncate text-xs font-medium text-muted">{PHOTO_LABEL[p.type] ?? p.type}</span>
                  </a>
                ))}
              </div>
            )}
          </Section>

          <Section title="History">
            <SocietyHistory visits={b.visits} zone={b.zone} />
          </Section>

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
