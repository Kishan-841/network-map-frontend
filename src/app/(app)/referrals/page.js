'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import { PageHeader } from '@/components/ui/PageHeader'
import { Input, Select } from '@/components/ui/Input'
import { DataTable } from '@/components/ui/DataTable'
import { IconUsers } from '@/components/ui/icons'

const STATUS_STYLE = {
  NEW: 'bg-fiber-tint text-fiber',
  CONTACTED: 'bg-doc-tint text-doc',
  INTERESTED: 'bg-doc-tint text-doc',
  CONVERTED: 'bg-ok-tint text-ok',
  NOT_INTERESTED: 'bg-bad-tint text-bad',
  UNREACHABLE: 'bg-bad-tint text-bad',
  DUPLICATE: 'bg-paper text-muted',
}
const STATUS_LABEL = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  INTERESTED: 'Interested',
  CONVERTED: 'Converted',
  NOT_INTERESTED: 'Not interested',
  UNREACHABLE: 'Unreachable',
  DUPLICATE: 'Duplicate',
}
const PARTNER_TYPE = {
  AGENT: 'Agent',
  SOCIETY_REPRESENTATIVE: 'Society rep',
  RETAIL_SHOP: 'Retail shop',
  DSA: 'DSA',
}
const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' })

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
        STATUS_STYLE[status] ?? 'bg-paper text-muted'
      }`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

/**
 * Referrals sent in by partners.
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
    { key: 'status', header: 'Status', render: (lead) => <StatusBadge status={lead.status} /> },
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
        <StatusBadge status={lead.status} />
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
        title="Referrals"
        sub={
          role === 'PARTNER_MANAGER'
            ? 'Customers referred by the partners you onboarded'
            : 'Customers referred by partners'
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
            id="referrals-search"
            placeholder="Search customer, mobile, email or partner…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select id="referrals-partner" value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
          <option value="">All partners</option>
          {partners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Select id="referrals-status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
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
              {leads?.length ? 'Nothing matches these filters' : 'No referrals yet'}
            </p>
            <p className="mt-1 max-w-sm text-sm font-normal text-muted">
              {leads?.length
                ? 'Try a different search, partner or status.'
                : 'When your partners refer customers, they will appear here.'}
            </p>
          </div>
        }
      />
    </main>
  )
}
