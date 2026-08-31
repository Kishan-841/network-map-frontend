'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import { PageHeader } from '@/components/ui/PageHeader'
import { Input, Select } from '@/components/ui/Input'
import { DataTable } from '@/components/ui/DataTable'
import { IconUsers, IconChevronDown } from '@/components/ui/icons'
import { ConvertLeadModal } from '@/components/leads/ConvertLeadModal'
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

/**
 * A status badge you can change.
 *
 * It is a real <select> wearing the badge's clothes, not a custom menu: the
 * keyboard, the screen reader and the phone's native picker all work for free,
 * and a picker wheel is the right control on the phone this list is often read
 * on. The chevron is the only hint that it is editable, which is enough
 * alongside the hover ring.
 */
function StatusPicker({ status, onPick, busy }) {
  const tint = leadStatusClass(status)
  return (
    <span
      className={`relative inline-flex items-center rounded-full transition-opacity ${tint} ${
        busy ? 'opacity-50' : ''
      }`}
    >
      <select
        value={status}
        disabled={busy}
        aria-label="Lead status"
        onChange={(e) => onPick(e.target.value)}
        className="cursor-pointer appearance-none rounded-full bg-transparent py-1 pl-2.5 pr-7 text-xs font-medium text-inherit outline-none ring-inset transition-shadow hover:ring-1 hover:ring-current/30 focus-visible:ring-2 focus-visible:ring-current/50 disabled:cursor-wait"
      >
        {LEAD_STATUSES.map((value) => (
          <option key={value} value={value} className="bg-card text-ink">
            {STATUS_LABEL[value]}
          </option>
        ))}
      </select>
      <IconChevronDown
        className="pointer-events-none absolute right-2 h-3 w-3 opacity-70"
        strokeWidth={2.4}
      />
    </span>
  )
}

const rupees = (n) => `₹${(n ?? 0).toLocaleString('en-IN')}`

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
export default function ReferralsPage() {
  const role = useAuthStore((s) => s.user?.role)
  const [leads, setLeads] = useState(null)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [partnerId, setPartnerId] = useState('')
  const [saving, setSaving] = useState(null)
  // The lead waiting on a plan before it can be converted, and the rate card
  // the amount comes from.
  const [converting, setConverting] = useState(null)
  const [rates, setRates] = useState([])
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
      .then((res) => !cancelled && setRates(res.data.data.rates ?? []))
      .catch(() => {})
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
  const updateStatus = useCallback(async (lead, next, plan) => {
    // A plan always goes through, even when the status is unchanged: that is
    // how a lead already sitting in Converted gets its missing earning.
    if (next === lead.status && !plan) return
    setError(null)
    setSaving(lead.id)
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status: next } : l)))
    try {
      await apiClient.patch(`/leads/${lead.id}/status`, { status: next, ...(plan && { plan }) })
    } catch (err) {
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status: lead.status } : l)))
      // Rethrown as well as shown: the convert modal needs to know it failed
      // so it can stay open with the reason rather than closing on a no-op.
      const message = getApiErrorMessage(err, 'Could not update that lead')
      setError(message)
      throw new Error(message)
    } finally {
      setSaving(null)
    }
  }, [])

  /**
   * Converting is the one status that cannot be applied straight away: it
   * creates the partner's earning, and the amount depends on a plan nobody
   * has recorded yet. Every other status goes through untouched.
   */
  const pickStatus = useCallback(
    (lead, next) => {
      if (next === 'CONVERTED' && lead.status !== 'CONVERTED') {
        setConverting(lead)
        return
      }
      updateStatus(lead, next).catch(() => {})
    },
    [updateStatus],
  )

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
          {canUpdate ? (
            <StatusPicker
              status={lead.status}
              busy={saving === lead.id}
              onPick={(next) => pickStatus(lead, next)}
            />
          ) : (
            <StatusBadge status={lead.status} />
          )}
          <EarningNote lead={lead} onFix={canUpdate ? () => setConverting(lead) : undefined} />
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Received',
      render: (lead) => dateFormat.format(new Date(lead.createdAt)),
      className: 'tabular-nums text-muted',
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
        <div className="text-right">
          {canUpdate ? (
            <StatusPicker
              status={lead.status}
              busy={saving === lead.id}
              onPick={(next) => pickStatus(lead, next)}
            />
          ) : (
            <StatusBadge status={lead.status} />
          )}
          <EarningNote lead={lead} onFix={canUpdate ? () => setConverting(lead) : undefined} />
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
          <option value="">All statuses</option>
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

      {converting && (
        <ConvertLeadModal
          key={converting.id}
          lead={converting}
          rates={rates}
          onCancel={() => setConverting(null)}
          onConfirm={async (plan) => {
            await updateStatus(converting, 'CONVERTED', plan)
            // Pull the row back so the amount appears straight away — the
            // status may not even have changed, only the earning behind it.
            apiClient
              .get('/leads')
              .then((res) => setLeads(res.data.data))
              .catch(() => {})
            setConverting(null)
          }}
        />
      )}
    </main>
  )
}
