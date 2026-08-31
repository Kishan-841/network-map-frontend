'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { partnerApi, getPartnerApiError } from '@/lib/partner-api-client'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { DataTable } from '@/components/ui/DataTable'

const STATUS_STYLE = {
  NEW: 'bg-fiber-tint text-fiber',
  CONTACTED: 'bg-doc-tint text-doc',
  INTERESTED: 'bg-doc-tint text-doc',
  CONVERTED: 'bg-ok-tint text-ok',
  NOT_INTERESTED: 'bg-bad-tint text-bad',
  UNREACHABLE: 'bg-bad-tint text-bad',
  DUPLICATE: 'bg-paper text-muted',
}
// What the PARTNER should read — not our internal vocabulary. "NEW" means
// nothing to them; "Sent" does.
const STATUS_LABEL = {
  NEW: 'Sent',
  CONTACTED: 'We called them',
  INTERESTED: 'Interested',
  CONVERTED: 'Signed up',
  NOT_INTERESTED: 'Not interested',
  UNREACHABLE: 'Could not reach',
  DUPLICATE: 'Already known',
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

export default function PartnerLeadsPage() {
  const [leads, setLeads] = useState(null)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    let cancelled = false
    partnerApi
      .get('/partner/leads')
      .then((res) => !cancelled && setLeads(res.data.data))
      .catch((err) => !cancelled && setError(getPartnerApiError(err, 'Could not load your referrals')))
    return () => {
      cancelled = true
    }
  }, [])

  const shown = useMemo(() => {
    if (!leads) return null
    const q = search.trim().toLowerCase()
    return leads.filter(
      (lead) =>
        (!status || lead.status === status) &&
        (!q ||
          [lead.customerName, lead.customerMobile, lead.customerEmail, lead.building?.buildingName]
            .filter(Boolean)
            .some((field) => field.toLowerCase().includes(q))),
    )
  }, [leads, search, status])

  const columns = [
    {
      key: 'customer',
      header: 'Customer',
      render: (lead) => <span className="text-sm font-medium">{lead.customerName}</span>,
    },
    {
      key: 'mobile',
      header: 'Mobile',
      render: (lead) => lead.customerMobile,
      className: 'whitespace-nowrap tabular-nums text-muted',
    },
    {
      key: 'email',
      header: 'Email',
      render: (lead) => lead.customerEmail || '—',
      className: 'max-w-[220px] truncate text-muted',
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
      header: 'Sent',
      render: (lead) => dateFormat.format(new Date(lead.createdAt)),
      className: 'whitespace-nowrap tabular-nums text-muted',
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
      <p className="mt-3 truncate border-t border-line pt-3 text-xs font-normal text-faint">
        {lead.building?.buildingName ?? lead.address ?? '—'} ·{' '}
        {dateFormat.format(new Date(lead.createdAt))}
      </p>
    </div>
  )

  if (error) return <p className="text-sm font-normal text-bad">{error}</p>

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">My referrals</h1>
      <p className="mt-1 text-sm font-normal text-muted">
        {leads === null
          ? 'Loading…'
          : leads.length === 0
            ? 'Nothing yet.'
            : `${leads.length} referral${leads.length === 1 ? '' : 's'} so far`}
      </p>

      {/* The controls only earn their space once there is a list to narrow. */}
      {leads?.length > 0 && (
        <div className="mb-4 mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Input
              id="my-leads-search"
              placeholder="Search customer, mobile, email or building…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select id="my-leads-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className={leads?.length > 0 ? '' : 'mt-4'}>
        <DataTable
          columns={columns}
          rows={shown}
          loading={leads === null}
          keyField="id"
          renderCard={renderCard}
          emptyState={
            <div className="rounded-card bg-card p-8 text-center shadow-soft">
              <p className="font-bold">
                {leads?.length ? 'Nothing matches these filters' : 'Refer your first customer'}
              </p>
              <p className="mt-1 text-sm font-normal text-muted">
                {leads?.length
                  ? 'Try a different search or status.'
                  : 'Search for their building, and we will tell you whether we can serve it.'}
              </p>
              {!leads?.length && (
                <Link href="/partner/refer">
                  <Button className="mt-4">Refer a customer</Button>
                </Link>
              )}
            </div>
          }
        />
      </div>
    </>
  )
}
