'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import { canManagePartners } from '@/lib/roles'
import { useRateCard } from '@/hooks/useRateCard'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Toast } from '@/components/ui/Toast'
import { EditLeadModal, BILLING_PERIODS } from '@/components/leads/EditLeadModal'
import { CallLeadModal, CALL_OUTCOMES } from '@/components/leads/CallLeadModal'
import { IconEdit, IconPhone, IconUser, IconBuildings, IconRupee, IconClock } from '@/components/ui/icons'
import { leadStatusClass, STAFF_LEAD_STATUS_LABEL as STATUS_LABEL } from '@/lib/lead-status'

const PARTNER_TYPE = { AGENT: 'Agent', SOCIETY_REPRESENTATIVE: 'Society rep', RETAIL_SHOP: 'Retail shop', DSA: 'DSA' }
const when = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata',
})
const fmt = (iso) => (iso ? when.format(new Date(iso)) : '—')
const rupees = (n) => `₹${(n ?? 0).toLocaleString('en-IN')}`
const minutes = (s) => (s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`)
const outcome = (v) => CALL_OUTCOMES.find((o) => o.value === v) ?? { label: v, tone: 'bg-paper text-muted' }
const period = (v) => BILLING_PERIODS.find((p) => p.value === v)?.label ?? v

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${leadStatusClass(status)}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

/** A titled card with label/value rows; rows with no value are left out. */
function Section({ icon: Icon, title, rows, children }) {
  const shown = (rows ?? []).filter(([, v]) => v !== null && v !== undefined && v !== '')
  return (
    <section className="rounded-card bg-card p-4 shadow-soft sm:p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-paper text-fiber">
          <Icon className="h-4 w-4" />
        </span>
        {title}
      </h2>
      {shown.length > 0 && (
        <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[9rem_1fr]">
          {shown.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-xs font-medium text-faint sm:pt-0.5">{label}</dt>
              <dd className="min-w-0 break-words">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {children}
    </section>
  )
}

/**
 * One partner lead in full: the customer, who referred them, the building,
 * what it earned, every status change (who, when, note) and every call.
 * Staff who run the partner network update it here like on the list.
 */
export default function LeadDetailPage() {
  const { id } = useParams()
  const role = useAuthStore((s) => s.user?.role)
  const canUpdate = canManagePartners(role)
  const { rates, fixedAmountByType, problem: rateCardProblem } = useRateCard()
  const [lead, setLead] = useState(null)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(false)
  const [calling, setCalling] = useState(false)
  const [toast, setToast] = useState(null)

  const load = useCallback(
    () =>
      apiClient
        .get(`/leads/${id}`)
        .then((res) => {
          setLead(res.data.data)
          setError(null)
        })
        .catch((err) => setError(getApiErrorMessage(err, 'Could not load this lead'))),
    [id],
  )
  useEffect(() => {
    load()
  }, [load])

  async function save({ status, note, plan }) {
    try {
      await apiClient.patch(`/leads/${id}/status`, { status, ...(note && { note }), ...(plan && { plan }) })
    } catch (err) {
      // The modal stays open and shows this.
      throw new Error(getApiErrorMessage(err, 'Could not update that lead'))
    }
    setEditing(false)
    setToast('Lead updated')
    await load()
  }

  if (!lead) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-6 lg:px-8">
        <PageHeader title="Lead" backHref="/leads" backLabel="Leads" />
        {error ? (
          <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>
        ) : (
          <p className="text-sm text-muted">Loading…</p>
        )}
      </main>
    )
  }

  // Newest first reads like a log; the API keeps them oldest first.
  const events = [...lead.events].reverse()

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 lg:px-8">
      <PageHeader
        title={lead.customerName}
        sub={`Received ${fmt(lead.createdAt)}`}
        backHref="/leads"
        backLabel="Leads"
      />
      {toast && <Toast key={toast} message={toast} onDone={() => setToast(null)} />}
      {error && <p className="mb-4 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>}

      <div className="mb-6 flex flex-col gap-3 rounded-card bg-card p-4 shadow-soft sm:flex-row sm:items-center sm:p-5">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-faint">Status</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <StatusBadge status={lead.status} />
            {lead.earning && (
              <span className="text-sm tabular-nums text-muted">
                {rupees(lead.earning.amount)} · {lead.earning.status === 'PAID' ? 'paid' : 'awaiting payment'}
              </span>
            )}
            {lead.nextCallAt && <span className="text-sm text-warn">Call back {fmt(lead.nextCallAt)}</span>}
          </div>
        </div>
        {canUpdate && (
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1 sm:flex-none" onClick={() => setCalling(true)}>
              <IconPhone className="h-4 w-4" /> Call
            </Button>
            <Button className="flex-1 sm:flex-none" onClick={() => setEditing(true)}>
              <IconEdit className="h-4 w-4" /> Update
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section
          icon={IconUser}
          title="Customer"
          rows={[
            ['Name', lead.customerName],
            ['Mobile', <a key="m" href={`tel:${lead.customerMobile}`} className="text-primary hover:underline">{lead.customerMobile}</a>],
            ['Email', lead.customerEmail],
            ['Address', lead.address],
            ['Wants', lead.requirementMbps ? `${lead.requirementMbps} Mbps` : null],
            ['Partner’s note', lead.note],
          ]}
        />
        <Section
          icon={IconUser}
          title="Referred by"
          rows={[
            ['Partner', lead.partner?.name],
            ['Type', PARTNER_TYPE[lead.partner?.type] ?? lead.partner?.type],
            ['Mobile', lead.partner?.mobile],
            ['Partner manager', lead.employee?.name],
          ]}
        />
        <Section
          icon={IconBuildings}
          title="Building"
          rows={[
            ['Building', lead.building?.buildingName ?? 'Not matched to a building'],
            ['Address', lead.building?.formattedAddress],
            ['Searched for', lead.searchedPlaceName],
          ]}
        />
        <Section
          icon={IconRupee}
          title="Earning"
          rows={
            lead.earning
              ? [
                  ['Amount', rupees(lead.earning.amount)],
                  ['Plan', `${lead.earning.speedMbps} Mbps · ${period(lead.earning.billingPeriod)}`],
                  ['Status', lead.earning.status === 'PAID' ? 'Paid' : 'Awaiting payment'],
                  ['Earned', fmt(lead.earning.earnedAt)],
                ]
              : [['Amount', lead.status === 'CONVERTED' ? 'No plan recorded yet — use Update status' : 'Paid once the lead converts']]
          }
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section icon={IconClock} title="Status history">
          {events.length === 0 ? (
            <p className="text-sm text-muted">No changes yet.</p>
          ) : (
            <ol className="flex flex-col gap-3" aria-label="Status history">
              {events.map((e) => (
                <li key={e.id} className="border-l-2 border-line pl-3">
                  <div className="flex flex-wrap items-center gap-1.5 text-sm">
                    {e.fromStatus && e.fromStatus !== e.toStatus && (
                      <>
                        <StatusBadge status={e.fromStatus} />
                        <span className="text-faint">→</span>
                      </>
                    )}
                    <StatusBadge status={e.toStatus} />
                    {e.fromStatus === e.toStatus && <span className="text-xs text-muted">Note added</span>}
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {fmt(e.createdAt)} · {e.by?.name ?? (e.byUserId ? 'Someone' : 'System')}
                  </p>
                  {e.note && <p className="mt-1 whitespace-pre-wrap text-sm">{e.note}</p>}
                </li>
              ))}
            </ol>
          )}
        </Section>

        <Section icon={IconPhone} title={`Calls${lead.calls.length ? ` (${lead.calls.length})` : ''}`}>
          {lead.calls.length === 0 ? (
            <p className="text-sm text-muted">No calls logged yet.</p>
          ) : (
            <ul className="flex flex-col gap-3" aria-label="Calls">
              {lead.calls.map((c) => {
                const o = outcome(c.outcome)
                return (
                  <li key={c.id} className="border-l-2 border-line pl-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${o.tone}`}>{o.label}</span>
                    <p className="mt-1 text-xs text-muted">
                      {fmt(c.endedAt)} · {minutes(c.durationSeconds)} · {c.by?.name ?? 'Someone'}
                    </p>
                    {c.callbackAt && <p className="mt-0.5 text-xs text-warn">Call back {fmt(c.callbackAt)}</p>}
                    {c.note && <p className="mt-1 whitespace-pre-wrap text-sm">{c.note}</p>}
                  </li>
                )
              })}
            </ul>
          )}
        </Section>
      </div>

      {calling && (
        <CallLeadModal
          lead={lead}
          submit={(call) => apiClient.post(`/leads/${id}/calls`, call)}
          onClose={() => setCalling(false)}
          onLogged={async () => {
            setCalling(false)
            setToast('Call logged')
            await load()
          }}
        />
      )}
      {editing && (
        <EditLeadModal
          lead={lead}
          rates={rates}
          rateCardProblem={rateCardProblem}
          fixedAmountByType={fixedAmountByType}
          onCancel={() => setEditing(false)}
          onSave={save}
        />
      )}
    </main>
  )
}
