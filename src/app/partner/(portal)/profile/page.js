'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { usePartnerAuthStore } from '@/stores/partner-auth-store'
import { partnerTypeLabel } from '@/lib/partner-api-client'
import { ThemePicker } from '@/components/ui/ThemePicker'
import { Button } from '@/components/ui/Button'
import { IconChevronRight, IconDoc, IconLogout } from '@/components/ui/icons'

const STATUS_STYLE = {
  REGISTERED: 'bg-paper text-muted',
  PENDING_APPROVAL: 'bg-doc-tint text-doc',
  APPROVED: 'bg-ok-tint text-ok',
  REJECTED: 'bg-bad-tint text-bad',
  SUSPENDED: 'bg-bad-tint text-bad',
}
const STATUS_LABEL = {
  REGISTERED: 'Documents needed',
  PENDING_APPROVAL: 'Awaiting approval',
  APPROVED: 'Verified',
  REJECTED: 'Documents rejected',
  SUSPENDED: 'Suspended',
}

function Row({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 last:border-b-0">
      <span className="shrink-0 text-sm text-muted">{label}</span>
      <span className="min-w-0 truncate text-sm font-medium">{value || '—'}</span>
    </div>
  )
}

/** The partner's own details, and the same theme picker the staff app offers. */
export default function PartnerProfilePage() {
  const router = useRouter()
  const { partner, clearAuth } = usePartnerAuthStore()

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
      <p className="mt-1 text-sm font-normal text-muted">Your details and how the app looks</p>

      <section className="mt-4 rounded-card bg-card p-5 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">{partner?.name}</p>
            <p className="truncate text-sm font-normal text-muted">
              {partnerTypeLabel(partner?.type)}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
              STATUS_STYLE[partner?.status] ?? 'bg-paper text-muted'
            }`}
          >
            {STATUS_LABEL[partner?.status] ?? partner?.status}
          </span>
        </div>

        <div className="mt-4">
          <Row label="Business" value={partner?.companyName} />
          <Row label="Email" value={partner?.email} />
          <Row label="Mobile" value={partner?.mobile} />
        </div>

        <p className="mt-4 text-xs font-normal text-muted">
          Need any of these changed? Ask your contact at the company.
        </p>
      </section>

      {/* The only way back to the documents page once approved — the nav drops
          it then. Bank details (where commission is paid) live there too. */}
      <Link
        href="/partner/documents"
        className="mt-4 flex items-center gap-3 rounded-card bg-card p-5 shadow-soft transition-colors hover:bg-paper"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paper text-muted">
          <IconDoc className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">Documents &amp; bank account</span>
          <span className="block truncate text-xs font-normal text-muted">
            Aadhaar, PAN, cheque and where we pay you
          </span>
        </span>
        <IconChevronRight className="h-4.5 w-4.5 shrink-0 text-faint" />
      </Link>

      <section className="mt-4 rounded-card bg-card p-5 shadow-soft">
        <p className="text-xs font-medium uppercase tracking-wide text-faint">Theme</p>
        <p className="mb-3 mt-0.5 text-sm font-normal text-muted">
          Pick how the app looks. It is remembered on this device.
        </p>
        <ThemePicker />
      </section>

      <Button
        variant="dangerGhost"
        fullWidth
        className="mt-4"
        onClick={() => {
          clearAuth()
          router.replace('/partner/login')
        }}
      >
        <IconLogout className="h-4.5 w-4.5" />
        Sign out
      </Button>
    </>
  )
}
