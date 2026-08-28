'use client'

import Link from 'next/link'
import { usePartnerAuthStore } from '@/stores/partner-auth-store'
import { partnerTypeLabel } from '@/lib/partner-api-client'
import { Button } from '@/components/ui/Button'

/**
 * The approved partner's home. Referrals and lead figures land here in the
 * next phase; today it confirms they are through the gate.
 */
export default function PartnerHomePage() {
  const partner = usePartnerAuthStore((s) => s.partner)
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Welcome, {partner?.name}</h1>
      <p className="mt-1 text-sm font-normal text-muted">
        {partnerTypeLabel(partner?.type)}
        {partner?.companyName ? ` · ${partner.companyName}` : ''}
      </p>

      <div className="mt-6 rounded-card bg-card p-6 shadow-soft">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-tint px-2.5 py-1 text-xs font-medium text-ok">
          <span className="h-1.5 w-1.5 rounded-full bg-ok" />
          Approved
        </span>
        <p className="mt-3 font-bold">You are all set</p>
        <p className="mt-1 text-sm font-normal text-muted">
          Find a customer&rsquo;s building, check we can serve it, and send us their
          details.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/partner/refer">
            <Button>Refer a customer</Button>
          </Link>
          <Link href="/partner/leads">
            <Button variant="secondary">My referrals</Button>
          </Link>
        </div>
      </div>
    </>
  )
}
