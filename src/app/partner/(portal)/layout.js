'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { usePartnerAuthStore } from '@/stores/partner-auth-store'
import { partnerApi } from '@/lib/partner-api-client'
import {
  PartnerSidebar,
  PartnerBottomNav,
  PartnerTopBar,
  PARTNER_TABS,
  PENDING_TABS,
  PENDING_ALLOWED,
} from '@/components/partner/PartnerNav'

/** Screens that are a table, and should use the full width available. */
// Prefix matches. The earnings dashboard is listed separately because
// '/partner' as a prefix would widen every page in the portal.
const WIDE_ROUTES = ['/partner/leads']
const WIDE_EXACT = ['/partner']

/**
 * The signed-in partner shell.
 *
 * Two redirects, both deliberate: no session goes to the login page, and an
 * un-approved partner is pinned to /partner/documents. There is no half-open
 * app with a lead form they cannot submit — a partner sees either their
 * onboarding, or the portal.
 */
export default function PartnerPortalLayout({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const { token, partner, clearAuth, setPartner } = usePartnerAuthStore()
  const [ready, setReady] = useState(false)
  /**
   * Has the persisted session been read out of localStorage yet?
   *
   * useSyncExternalStore rather than an effect flag: its third argument is
   * the SERVER snapshot, so prerendering never touches the persist API (which
   * does not exist there), and on the client a token already in storage is
   * seen on the first render. Without this, a signed-in partner gets bounced
   * to the login page by a hydration race.
   */
  const hydrated = useSyncExternalStore(
    (onChange) => usePartnerAuthStore.persist.onFinishHydration(onChange),
    () => usePartnerAuthStore.persist.hasHydrated(),
    () => false,
  )

  useEffect(() => {
    if (!hydrated) return
    if (!token) {
      router.replace('/partner/login')
      return
    }
    let cancelled = false
    // Re-read on mount so an approval granted since the last sign-in takes
    // effect without the partner having to sign out and back in.
    partnerApi
      .get('/partner-auth/me')
      .then((res) => {
        if (cancelled) return
        setPartner(res.data.data)
        setReady(true)
      })
      .catch(() => {
        // Never leave the portal stuck on "Loading…": a session we cannot
        // confirm is a session that has to start again.
        if (!cancelled) {
          clearAuth()
          router.replace('/partner/login')
        }
      })
    return () => {
      cancelled = true
    }
  }, [hydrated, token, router, setPartner, clearAuth])

  // A partner awaiting approval keeps the pitch tools and is pushed back only
  // from the earning actions.
  const allowedWhilePending = PENDING_ALLOWED.some((r) => pathname.startsWith(r))
  useEffect(() => {
    if (!ready || !partner) return
    if (partner.status !== 'APPROVED' && !allowedWhilePending) router.replace('/partner/documents')
  }, [ready, partner, allowedWhilePending, router])

  if (!hydrated || !token || !ready) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="text-sm font-normal text-muted">Loading…</p>
      </main>
    )
  }

  // Before approval there is nowhere else to go, so the nav would only offer
  // dead ends — the onboarding screen stands on its own.
  const approved = partner?.status === 'APPROVED'
  const tabs = approved ? PARTNER_TABS : PENDING_TABS

  /**
   * Content width is decided here rather than per page, so there is one place
   * that knows how wide each screen should be. A table wants the room; a
   * single column of form fields stretched to the same width reads badly.
   */
  const wide =
    WIDE_EXACT.includes(pathname) || WIDE_ROUTES.some((r) => pathname.startsWith(r))
  const contentWidth = wide ? 'max-w-6xl' : 'max-w-3xl'

  return (
    <div className="min-h-dvh bg-paper">
      <PartnerSidebar tabs={tabs} />
      <PartnerTopBar />
      <div className="lg:pl-[260px]">
        {/* pb-28 clears the bottom bar on phones; lg has no bottom bar. */}
        <main
          className={`mx-auto w-full px-5 pb-28 pt-5 lg:px-8 lg:pb-12 lg:pt-8 ${contentWidth}`}
        >
          {children}
        </main>
      </div>
      <PartnerBottomNav tabs={tabs} />
    </div>
  )
}
