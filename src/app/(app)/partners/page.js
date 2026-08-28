'use client'

import { PageHeader } from '@/components/ui/PageHeader'
import { IconUsers } from '@/components/ui/icons'

/**
 * Employee home for the partner network. The roster, invites and lead
 * figures land here (plan Task 10) — this is the shell that makes the
 * PARTNER_MANAGER role reachable end to end today.
 */
export default function PartnersPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">
      <PageHeader title="Partners" sub="Referral partners you have onboarded" />
      <div className="flex flex-col items-center rounded-card bg-card px-6 py-16 text-center shadow-soft">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-fiber-tint text-fiber">
          <IconUsers className="h-7 w-7" strokeWidth={1.8} />
        </span>
        <p className="mt-4 font-bold">No partners yet</p>
        <p className="mt-1 max-w-sm text-sm font-normal text-muted">
          Inviting partners and tracking the leads they send arrives in the next step of
          this build.
        </p>
      </div>
    </main>
  )
}
