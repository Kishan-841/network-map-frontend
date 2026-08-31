'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { partnerApi, getPartnerApiError } from '@/lib/partner-api-client'
import { PartnerSignIn } from '@/components/partner/PartnerSignIn'

/**
 * An employee's one-use invite link. The sign-in flow is identical — the only
 * difference is that the invite rides along, attributing the new partner to
 * the employee who pitched them (partner-network.md §3.1).
 */
export default function PartnerJoinPage({ params }) {
  const { token } = use(params)
  const [invite, setInvite] = useState(null)

  useEffect(() => {
    let cancelled = false
    partnerApi
      .get(`/partner-invites/resolve/${token}`)
      .then((res) => !cancelled && setInvite({ employeeName: res.data.data.employeeName }))
      .catch(
        (err) =>
          !cancelled &&
          setInvite({ error: getPartnerApiError(err, 'This invite link is not valid') }),
      )
    return () => {
      cancelled = true
    }
  }, [token])

  if (!invite) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center px-5">
        <p className="text-sm font-normal text-muted">One moment…</p>
      </main>
    )
  }

  if (invite.error) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
        <div className="rounded-card bg-card p-6 text-center shadow-soft">
          <p className="font-bold">This link has already been used</p>
          <p className="mt-2 text-sm font-normal text-muted">
            Invite links work once. Ask the person who sent it for a fresh one — or sign in
            below if you already have an account.
          </p>
          <Link
            href="/partner/login"
            className="mt-4 inline-block text-sm font-medium text-fiber underline-offset-2 hover:underline"
          >
            Sign in with my mobile number
          </Link>
        </div>
      </main>
    )
  }

  return <PartnerSignIn inviteToken={token} invitedBy={invite.employeeName} />
}
