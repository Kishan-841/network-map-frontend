'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import { PageHeader } from '@/components/ui/PageHeader'
import { Input, Select } from '@/components/ui/Input'
import { DataTable } from '@/components/ui/DataTable'
import { IconUsers, IconEdit, IconPhone } from '@/components/ui/icons'
import { EditLeadModal } from '@/components/leads/EditLeadModal'
import { CallLeadModal } from '@/components/leads/CallLeadModal'
import {
  LEAD_STATUSES,
  leadStatusClass,
  STAFF_LEAD_STATUS_LABEL as STATUS_LABEL,
} from '@/lib/lead-status'

const PARTNER_TYPE = {
  AGENT: 'Agent',
  SOCIETY_REPRESENTATIVE: 'Society rep',
  RETAIL_SHOP: 'Retail shop',
  DSA: 'DSA',
}
const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' })

/**
 * Everyone who can reach this page may move a lead along; the API decides
 * WHICH leads (a partner manager only reaches their own partners'). Mirrored
 * here so the control is never offered where the save would be refused.
 */
const CAN_UPDATE_STATUS = ['ADMIN', 'MANAGER', 'SUPERVISOR', 'PARTNER_MANAGER']

const rupees = (n) => `₹${(n ?? 0).toLocaleString('en-IN')}`

const callbackFormat = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
})

/**
 * A clock that ticks once a minute.
 *
 * "Overdue" is not a property of the data — it is the data compared to now,
 * and now moves while the page is open. Reading the clock during render would
 * be impure and would never update; this makes the passage of time an input
 * the component actually reacts to.
 */
function useMinute() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])
  return now
}

/**
 * When this lead asked to be called back.
 *
 * Overdue is amber rather than red: a callback five minutes late is a nudge,
 * not a failure, and colouring every slipped callback as an error trains
 * people to ignore the colour.
 */
function CallbackDue({ at, now }) {
  if (!at) return null
  const when = new Date(at)
  const overdue = when.getTime() < now
  return (
    <p className={`truncate text-xs font-medium ${overdue ? 'text-warn' : 'text-muted'}`}>
      {overdue ? 'Call back due' : 'Call back'} {callbackFormat.format(when)}
    </p>
  )
}

/**
 * What this lead earned the partner, sitting under its status.
 *
 * A converted lead with no earning is not a display gap — it is real money
 * nobody has recorded, and the only way it gets fixed is if someone can see
 * it. Leads converted before earnings existed all look like this, so the
 * missing state is a button, not a dash.
 */
function EarningNote({ lead, onFix }) {
  if (lead.status !== 'CONVERTED') return null
  if (lead.earning) {
    return (
      <span className="mt-1 block text-xs font-normal tabular-nums text-muted">
        {rupees(lead.earning.amount)}
        {lead.earning.status === 'PAID' ? ' · paid' : ''}
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={onFix}
      className="mt-1 block text-xs font-medium text-warn underline underline-offset-2 transition-opacity hover:opacity-70"
    >
      Add plan
    </button>
  )
}

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${leadStatusClass(status)}`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

/**
 * Leads sent in by partners.
 *
 * The API scopes this: a PARTNER_MANAGER sees only leads from partners they
 * recruited, an admin sees everyone's. Nothing here has to enforce that — but
 * the heading says whose list it is, so nobody mistakes a scoped view for the
 * whole picture.
 */
function LeadsTable() {
  const role = useAuthStore((s) => s.user?.role)
  const [leads, setLeads] = useState(null)
  const [error, setError] = useState(null)
  // Seeded from the URL so a figure elsewhere can link straight to the leads
  // behind it. Read once as the initial value — after that the selects own it,
  // and re-reading would fight the user every time they change a filter.
  const params = useSearchParams()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(() => params.get('status') ?? '')
  const [partnerId, setPartnerId] = useState(() => params.get('partnerId') ?? '')
  const [saving, setSaving] = useState(null)
  // The lead open in the edit panel, and the rate card a conversion prices
  // itself from.
  const [editing, setEditing] = useState(null)
  const [calling, setCalling] = useState(null)
  const now = useMinute()
  const [rates, setRates] = useState([])
  // Why a conversion can't be priced, said out loud rather than leaving the
  // speed choices silently empty (production once had no rate card rows).
  const [rateCardProblem, setRateCardProblem] = useState(null)
  const canUpdate = CAN_UPDATE_STATUS.includes(role)

  useEffect(() => {
    let cancelled = false
    apiClient
      .get('/leads')
      .then((res) => !cancelled && setLeads(res.data.data))
      .catch((err) => !cancelled && setError(getApiErrorMessage(err, 'Could not load referrals')))
    return () => {
      cancelled = true
    }
  }, [])

  // The rate card, so the modal can price a conversion without a round trip
  // per keystroke. Same source the calculator quotes from.
  useEffect(() => {
    let cancelled = false
    apiClient
      .get('/rate-card')
      .then((res) => {
        if (cancelled) return
        const loaded = res.data.data.rates ?? []
        setRates(loaded)
        setRateCardProblem(loaded.length ? null : "The rate card isn't set up yet, so a conversion can't be priced.")
      })
      .catch((err) => {
        if (!cancelled) setRateCardProblem(getApiErrorMessage(err, "Couldn't load the rate card, so a conversion can't be priced."))
      })
    return () => {
      cancelled = true
    }
  }, [])

  /**
   * Move one lead along.
   *
   * Optimistic, because the row is the only feedback there is and a status
   * change is the common case; a refusal puts the old value straight back so
   * the table never shows a state the server rejected.
   */
  /**
   * Save what the edit panel collected.
   *
   * Not optimistic: the panel stays open on failure with the reason, and a
   * conversion has to be told whether the earning was actually created before
   * the row can claim it was.
   */
  const saveLead = useCallback(async (lead, { status, note, plan }) => {
    setError(null)
    setSaving(lead.id)
    try {
      await apiClient.patch(`/leads/${lead.id}/status`, {
        status,
        ...(note && { note }),
        ...(plan && { plan }),
      })
      // Refetch rather than patch in place: converting also creates the
      // earning the row shows, which is not in this response.
      const res = await apiClient.get('/leads')
      setLeads(res.data.data)
    } catch (err) {
      const message = getApiErrorMessage(err, 'Could not update that lead')
      setError(message)
      throw new Error(message)
    } finally {
      setSaving(null)
    }
  }, [])

  // The list is capped at 200 server-side, so filtering in memory is honest
  // here — there is no second page hiding behind these controls.
  const partners = useMemo(() => {
    const seen = new Map()
    for (const lead of leads ?? []) {
      if (lead.partner) seen.set(lead.partner.id, lead.partner)
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [leads])

  const shown = useMemo(() => {
    if (!leads) return null
    const q = search.trim().toLowerCase()
    return leads.filter(
      (lead) =>
        (!status || lead.status === status) &&
        (!partnerId || lead.partner?.id === partnerId) &&
        (!q ||
          [lead.customerName, lead.customerMobile, lead.customerEmail, lead.partner?.name]
            .filter(Boolean)
            .some((field) => field.toLowerCase().includes(q))),
    )
  }, [leads, search, status, partnerId])

  const columns = [
    {
      key: 'customer',
      header: 'Customer',
      render: (lead) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{lead.customerName}</p>
          <p className="truncate text-xs font-normal text-muted">{lead.customerMobile}</p>
          <CallbackDue at={lead.nextCallAt} now={now} />
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (lead) => lead.customerEmail || '—',
      className: 'max-w-[220px] truncate text-muted',
    },
    {
      key: 'partner',
      header: 'Referred by',
      render: (lead) => (
        <div className="min-w-0">
          <p className="truncate text-sm">{lead.partner?.name ?? '—'}</p>
          <p className="truncate text-xs font-normal text-muted">
            {PARTNER_TYPE[lead.partner?.type] ?? ''}
          </p>
        </div>
      ),
      className: 'max-w-[180px]',
    },
    {
      key: 'building',
      header: 'Building',
      render: (lead) => lead.building?.buildingName ?? lead.address ?? '—',
      className: 'max-w-[180px] truncate text-muted',
    },
    {
      key: 'status',
      header: 'Status',
      render: (lead) => (
        <div>
          <StatusBadge status={lead.status} />
          <EarningNote lead={lead} onFix={canUpdate ? () => setEditing(lead) : undefined} />
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Received',
      render: (lead) => dateFormat.format(new Date(lead.createdAt)),
      className: 'tabular-nums text-muted',
    },
    {
      key: 'actions',
      header: 'Action',
      render: (lead) =>
        canUpdate ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCalling(lead)}
              aria-label={`Call ${lead.customerName}`}
              title="Call this lead"
              className="flex h-8 w-8 items-center justify-center rounded-btn text-muted transition-colors hover:bg-ok/10 hover:text-ok"
            >
              <IconPhone className="h-4 w-4" strokeWidth={1.9} />
            </button>
            <button
              type="button"
              onClick={() => setEditing(lead)}
              disabled={saving === lead.id}
              aria-label={`Update ${lead.customerName}`}
              title="Update this lead"
              className="flex h-8 w-8 items-center justify-center rounded-btn text-muted transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-40"
            >
              <IconEdit className="h-4 w-4" strokeWidth={1.9} />
            </button>
          </div>
        ) : null,
      className: 'w-px',
    },
  ]

  const renderCard = (lead) => (
    <div className="rounded-card bg-card p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold">{lead.customerName}</p>
          <p className="truncate text-sm font-normal text-muted">{lead.customerMobile}</p>
          {lead.customerEmail && (
            <p className="truncate text-sm font-normal text-muted">{lead.customerEmail}</p>
          )}
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <div className="text-right">
            <StatusBadge status={lead.status} />
            <EarningNote lead={lead} onFix={canUpdate ? () => setEditing(lead) : undefined} />
          </div>
          {canUpdate && (
            <>
              <button
                type="button"
                onClick={() => setCalling(lead)}
                aria-label={`Call ${lead.customerName}`}
                className="flex h-8 w-8 items-center justify-center rounded-btn text-muted transition-colors hover:bg-ok/10 hover:text-ok"
              >
                <IconPhone className="h-4 w-4" strokeWidth={1.9} />
              </button>
              <button
                type="button"
                onClick={() => setEditing(lead)}
                disabled={saving === lead.id}
                aria-label={`Update ${lead.customerName}`}
                className="flex h-8 w-8 items-center justify-center rounded-btn text-muted transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-40"
              >
                <IconEdit className="h-4 w-4" strokeWidth={1.9} />
              </button>
            </>
          )}
        </div>
      </div>
      <div className="mt-3 border-t border-line pt-3">
        <p className="truncate text-xs font-normal text-faint">
          Referred by <span className="font-medium text-ink">{lead.partner?.name ?? '—'}</span> ·{' '}
          {dateFormat.format(new Date(lead.createdAt))}
        </p>
        {(lead.building?.buildingName || lead.address) && (
          <p className="mt-0.5 truncate text-xs font-normal text-faint">
            {lead.building?.buildingName ?? lead.address}
          </p>
        )}
      </div>
    </div>
  )

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">
      <PageHeader
        title="Leads"
        sub={
          role === 'PARTNER_MANAGER'
            ? 'Sent in by the partners you onboarded'
            : 'Sent in by partners'
        }
      />

      {error && (
        <p className="mb-3 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">
          {error}
        </p>
      )}

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <Input
            id="leads-search"
            placeholder="Search customer, mobile, email or partner…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select id="leads-partner" value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
          <option value="">All partners</option>
          {partners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Select id="leads-status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All status</option>
          {LEAD_STATUSES.map((value) => (
            <option key={value} value={value}>
              {STATUS_LABEL[value]}
            </option>
          ))}
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={shown}
        loading={leads === null}
        keyField="id"
        renderCard={renderCard}
        emptyState={
          <div className="flex flex-col items-center rounded-card bg-card px-6 py-16 text-center shadow-soft">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-fiber-tint text-fiber">
              <IconUsers className="h-7 w-7" strokeWidth={1.8} />
            </span>
            <p className="mt-4 font-bold">
              {leads?.length ? 'Nothing matches these filters' : 'No leads yet'}
            </p>
            <p className="mt-1 max-w-sm text-sm font-normal text-muted">
              {leads?.length
                ? 'Try a different search, partner or status.'
                : 'When your partners send in customers, they will appear here.'}
            </p>
          </div>
        }
      />

      {calling && (
        <CallLeadModal
          key={calling.id}
          lead={calling}
          submit={(call) => apiClient.post(`/leads/${calling.id}/calls`, call)}
          onClose={() => setCalling(null)}
          onLogged={async () => {
            setCalling(null)
            // The outcome moves the lead, so re-read rather than guess.
            const res = await apiClient.get('/leads')
            setLeads(res.data.data)
          }}
        />
      )}

      {editing && (
        <EditLeadModal
          key={editing.id}
          lead={editing}
          rates={rates}
          rateCardProblem={rateCardProblem}
          onCancel={() => setEditing(null)}
          onSave={async (changes) => {
            await saveLead(editing, changes)
            setEditing(null)
          }}
        />
      )}

    </main>
  )
}

// useSearchParams must sit inside a Suspense boundary in the App Router.
export default function LeadsPage() {
  return (
    <Suspense fallback={null}>
      <LeadsTable />
    </Suspense>
  )
}
