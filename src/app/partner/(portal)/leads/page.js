'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { partnerApi, getPartnerApiError } from '@/lib/partner-api-client'
import { Button } from '@/components/ui/Button'

const STATUS_STYLE = {
  NEW: 'bg-fiber-tint text-fiber',
  CONTACTED: 'bg-doc-tint text-doc',
  INTERESTED: 'bg-doc-tint text-doc',
  CONVERTED: 'bg-ok-tint text-ok',
  NOT_INTERESTED: 'bg-bad-tint text-bad',
  UNREACHABLE: 'bg-bad-tint text-bad',
  DUPLICATE: 'bg-paper text-muted',
}
// What the PARTNER should read, which is not always our internal word.
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

export default function PartnerLeadsPage() {
  const [leads, setLeads] = useState(null)
  const [error, setError] = useState(null)

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

  if (error) return <p className="text-sm font-normal text-bad">{error}</p>
  if (!leads) return <p className="text-sm font-normal text-muted">Loading…</p>

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">My referrals</h1>
      <p className="mt-1 text-sm font-normal text-muted">
        {leads.length === 0
          ? 'Nothing yet.'
          : `${leads.length} referral${leads.length === 1 ? '' : 's'} so far`}
      </p>

      {leads.length === 0 ? (
        <div className="mt-4 rounded-card bg-card p-8 text-center shadow-soft">
          <p className="font-bold">Refer your first customer</p>
          <p className="mt-1 text-sm font-normal text-muted">
            Search for their building, and we will tell you whether we can serve it.
          </p>
          <Link href="/partner/refer">
            <Button className="mt-4">Refer a customer</Button>
          </Link>
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {leads.map((lead) => (
            <li key={lead.id} className="rounded-card bg-card p-4 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-bold">{lead.customerName}</p>
                  <p className="truncate text-sm font-normal text-muted">{lead.customerMobile}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                    STATUS_STYLE[lead.status] ?? 'bg-paper text-muted'
                  }`}
                >
                  {STATUS_LABEL[lead.status] ?? lead.status}
                </span>
              </div>
              <p className="mt-2 truncate text-xs font-normal text-faint">
                {lead.building?.buildingName ?? lead.address ?? '—'} ·{' '}
                {dateFormat.format(new Date(lead.createdAt))}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
