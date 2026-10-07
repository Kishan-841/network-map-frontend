'use client'

import { ROLE_LABELS } from '@/lib/roles'
import { leadStatusBadge, leadStatusLabel } from '@/lib/sales-lead-status'

const ACTIVITY_LABEL = { DESK: 'Desk', UMBRELLA: 'Umbrella', LIFT: 'Leafleting' }
// Visits happen in India — show India time whatever the viewer's device says.
const fmtDateTime = (iso) =>
  new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const mapHref = (lat, lng) => (lat != null && lng != null ? `https://www.google.com/maps?q=${lat},${lng}` : null)

function duration(inIso, outIso) {
  if (!outIso) return null
  const mins = Math.max(0, Math.round((new Date(outIso) - new Date(inIso)) / 60000))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h ? `${h}h ${m}m` : `${m}m`
}

function Section({ title, children }) {
  return (
    <section className="mb-4 rounded-card border border-line bg-card p-4">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{title}</p>
      {children}
    </section>
  )
}

function Point({ label, at, lat, lng }) {
  const href = mapHref(lat, lng)
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-sm font-medium text-ink">{label}</span>
      <span className="text-right text-sm font-normal text-muted">
        {at ? fmtDateTime(at) : '—'}
        {href && (
          <>
            {' · '}
            <a href={href} target="_blank" rel="noreferrer" className="text-fiber underline-offset-2 hover:underline">
              map
            </a>
          </>
        )}
      </span>
    </div>
  )
}

/**
 * Every detail of one field visit — who, where, went-with, check-in/out with
 * map links, time spent, selfie, activities, leads. Shared by the visit page
 * and the Team plan calendar's details panel.
 */
export function VisitDetailBody({ visit }) {
  const acts = [...new Set((visit.activities ?? []).map((a) => ACTIVITY_LABEL[a.type] ?? a.type))]
  const dur = duration(visit.visitedAt, visit.checkOutAt)
  return (
    <>
      <Section title="Who & where">
        <p className="text-sm font-normal text-ink">
          {visit.user?.name}{' '}
          <span className="text-muted">· {ROLE_LABELS[visit.user?.role] ?? visit.user?.role}</span>
        </p>
        <p className="mt-1 text-sm font-medium text-ink">{visit.building?.buildingName}</p>
        <p className="text-sm font-normal text-muted">{visit.building?.formattedAddress}</p>
      </Section>

      {(visit.wentSolo || (visit.companions?.length ?? 0) > 0) && (
        <Section title="Went with">
          {visit.wentSolo ? (
            <p className="text-sm font-normal text-muted">Went solo</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {visit.companions.map((c) => (
                <span key={c.user.id} className="rounded-full bg-paper px-2.5 py-1 text-sm font-medium text-ink">
                  {c.user.name}
                </span>
              ))}
            </div>
          )}
        </Section>
      )}

      <Section title="Timing & location">
        <Point label="Checked in" at={visit.visitedAt} lat={visit.checkInLat} lng={visit.checkInLng} />
        <Point label="Checked out" at={visit.checkOutAt} lat={visit.checkOutLat} lng={visit.checkOutLng} />
        <div className="mt-2 border-t border-line pt-2 text-sm font-normal text-muted">
          {visit.checkOutAt ? `Time spent: ${dur}` : 'Still checked in'}
        </div>
      </Section>

      {visit.selfieUrl && (
        <Section title="Selfie">
          <a href={visit.selfieUrl} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={visit.selfieUrl}
              alt="Check-in selfie"
              className="max-h-72 rounded-card bg-paper object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          </a>
        </Section>
      )}

      <Section title="Activities">
        {acts.length ? (
          <div className="flex flex-wrap gap-1.5">
            {acts.map((a) => (
              <span key={a} className="rounded-full bg-paper px-2.5 py-1 text-sm font-medium text-muted">
                {a}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm font-normal text-muted">No activities logged.</p>
        )}
      </Section>

      <Section title={`Inquiries (${visit.inquiries?.length ?? 0})`}>
        {visit.inquiries?.length ? (
          <ul className="flex flex-col gap-2">
            {visit.inquiries.map((i) => (
              <li key={i.id} className="rounded-btn bg-paper px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-ink">{i.customerName}</p>
                  {i.status && (
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${leadStatusBadge(i.status)}`}>
                      {leadStatusLabel(i.status)}
                    </span>
                  )}
                </div>
                <p className="text-sm font-normal text-muted">
                  {i.phone}
                  {i.email ? ` · ${i.email}` : ''} · {fmtDateTime(i.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm font-normal text-muted">No inquiries raised in this visit.</p>
        )}
      </Section>
    </>
  )
}
