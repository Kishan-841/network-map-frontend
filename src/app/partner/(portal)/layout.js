'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { usePartnerAuthStore } from '@/stores/partner-auth-store'
import { partnerApi } from '@/lib/partner-api-client'
import { NodeMark, IconLogout } from '@/components/ui/icons'

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

  const onDocuments = pathname.startsWith('/partner/documents')
  useEffect(() => {
    if (!ready || !partner) return
    if (partner.status !== 'APPROVED' && !onDocuments) router.replace('/partner/documents')
  }, [ready, partner, onDocuments, router])

  if (!hydrated || !token || !ready) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="text-sm font-normal text-muted">Loading…</p>
      </main>
    )
  }

  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-5 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-btn bg-primary text-primary-content">
            <NodeMark className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold leading-tight">{partner?.name}</p>
            <p className="truncate text-xs font-normal text-muted">Partner portal</p>
          </div>
          <button
            type="button"
            onClick={() => {
              clearAuth()
              router.replace('/partner/login')
            }}
            aria-label="Sign out"
            className="flex h-9 w-9 items-center justify-center rounded-btn text-muted transition-colors hover:bg-bad-tint hover:text-bad"
          >
            <IconLogout className="h-4.5 w-4.5" strokeWidth={1.8} />
          </button>
        </div>
        {partner?.status === 'APPROVED' && (
          <nav className="mx-auto flex w-full max-w-3xl gap-1 px-3 pb-2">
            {[
              { href: '/partner', label: 'Home' },
              { href: '/partner/documents', label: 'My documents' },
            ].map((tab) => {
              const active = tab.href === '/partner' ? pathname === tab.href : pathname.startsWith(tab.href)
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`rounded-btn px-3 py-1.5 text-sm font-medium transition-colors ${
                    active ? 'bg-primary text-primary-content' : 'text-muted hover:bg-primary/5'
                  }`}
                >
                  {tab.label}
                </Link>
              )
            })}
          </nav>
        )}
      </header>
      <main className="mx-auto w-full max-w-3xl px-5 py-6">{children}</main>
    </div>
  )
}
