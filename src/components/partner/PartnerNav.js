'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { usePartnerAuthStore } from '@/stores/partner-auth-store'
import { partnerTypeLabel } from '@/lib/partner-api-client'
import { useTheme } from '@/hooks/useTheme'
import {
  NodeMark,
  IconHome,
  IconPlus,
  IconUsers,
  IconUserPlus,
  IconDoc,
  IconUser,
  IconCalculator,
  IconLogout,
  IconSun,
  IconMoon,
} from '@/components/ui/icons'

/**
 * The partner portal's navigation, mirroring the staff app: a rail on
 * laptops, a bottom bar on phones. Partners work from a phone in a lobby far
 * more often than from a desk, so the bottom bar is the primary design and
 * the sidebar is what fills the space a large screen offers.
 */
/**
 * The five things a partner came to do (partner-network.md §2). Documents and
 * Profile live inside Profile, so the bar is not cluttered with settings.
 */
export const PARTNER_TABS = [
  { href: '/partner', label: 'Earnings', icon: IconHome, exact: true },
  { href: '/partner/calculator', label: 'Calculator', icon: IconCalculator },
  { href: '/partner/refer', label: 'Add lead', icon: IconPlus },
  { href: '/partner/leads', label: 'My leads', icon: IconUsers },
  { href: '/partner/introduce', label: 'Refer', icon: IconUserPlus },
  { href: '/partner/profile', label: 'Profile', icon: IconUser },
]

/**
 * What a partner can do while their documents are still being checked
 * (partner-network.md §8): the pitch tools work from minute one, and only the
 * actions that create an obligation wait on approval.
 */
export const PENDING_TABS = [
  { href: '/partner/calculator', label: 'Calculator', icon: IconCalculator },
  // §2: referring a partner works from minute one — it creates no obligation,
  // so it does not wait on documents the way adding a lead does.
  { href: '/partner/introduce', label: 'Refer', icon: IconUserPlus },
  { href: '/partner/documents', label: 'Documents', icon: IconDoc },
  { href: '/partner/profile', label: 'Profile', icon: IconUser },
]
export const PENDING_ALLOWED = PENDING_TABS.map((t) => t.href)

const isActive = (pathname, { href, exact }) =>
  exact ? pathname === href : pathname.startsWith(href)

/**
 * Quick light/dark flip. The full palette lives on the Profile tab; this is
 * the one-tap version the staff rail also offers. `theme` is null until the
 * hook mounts, so the icon renders neutrally for that first frame.
 */
function ThemeToggle({ className = '' }) {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={toggle}
      title={dark ? 'Switch to light' : 'Switch to dark'}
      aria-label={dark ? 'Switch to light' : 'Switch to dark'}
      className={className}
    >
      {dark ? (
        <IconSun className="h-4.5 w-4.5" strokeWidth={1.8} />
      ) : (
        <IconMoon className="h-4.5 w-4.5" strokeWidth={1.8} />
      )}
    </button>
  )
}

function initials(name = '') {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/** Laptop: a fixed rail. Hidden below lg, where the bottom bar takes over. */
export function PartnerSidebar({ tabs = PARTNER_TABS }) {
  const pathname = usePathname()
  const router = useRouter()
  const { partner, clearAuth } = usePartnerAuthStore()

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col bg-neutral text-neutral-content lg:flex">
      <div className="flex items-center gap-3 px-5 pb-6 pt-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-btn bg-primary text-primary-content">
          <NodeMark className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold leading-tight tracking-tight">
            Partner portal
          </p>
          <p className="truncate text-xs font-normal text-neutral-content/50">
            Refer customers, track leads
          </p>
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3">
        <div className="flex flex-col gap-1">
          {tabs.map((tab) => {
            const active = isActive(pathname, tab)
            const Icon = tab.icon
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={`group flex items-center gap-3 rounded-btn px-3.5 py-2.5 text-sm font-medium transition-colors duration-200 ${
                  active
                    ? 'bg-primary text-primary-content shadow-sm'
                    : 'text-neutral-content/60 hover:bg-neutral-content/10 hover:text-neutral-content'
                }`}
              >
                <Icon
                  className={`h-5 w-5 shrink-0 transition-transform duration-200 ${
                    active ? '' : 'group-hover:translate-x-0.5'
                  }`}
                  strokeWidth={1.8}
                />
                {tab.label}
              </Link>
            )
          })}
        </div>
      </nav>

      <div className="mt-auto flex flex-col gap-2 border-t border-neutral-content/10 px-3 pb-5 pt-4">
        {partner && (
          <div className="flex items-center gap-3 px-2 py-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
              {initials(partner.name)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{partner.name}</span>
              <span className="block truncate text-xs font-normal text-neutral-content/50">
                {partnerTypeLabel(partner.type)}
              </span>
            </span>
          </div>
        )}
        <div className="flex gap-2">
          <ThemeToggle
            className="flex h-9 w-9 items-center justify-center rounded-btn text-neutral-content/60 transition-colors duration-200 hover:bg-neutral-content/10 hover:text-neutral-content"
          />
          <button
            type="button"
            onClick={() => {
              clearAuth()
              router.replace('/partner/login')
            }}
            className="flex h-9 flex-1 items-center justify-center gap-2 rounded-btn text-sm font-medium text-neutral-content/70 transition-colors duration-200 hover:bg-error/15 hover:text-error"
          >
            <IconLogout className="h-4.5 w-4.5" strokeWidth={1.8} />
            Sign out
          </button>
        </div>
      </div>
    </aside>
  )
}

/** Phone: a fixed bottom bar. Hidden at lg, where the rail takes over. */
export function PartnerBottomNav({ tabs = PARTNER_TABS }) {
  const pathname = usePathname()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-card/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
      <div className="mx-auto flex h-18 max-w-lg">
        {tabs.map((tab) => {
          const active = isActive(pathname, tab)
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors duration-200 ${
                active ? 'text-primary' : 'text-muted'
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.8} />
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

/** Phone: a slim top bar, since the rail is not there to carry identity. */
export function PartnerTopBar() {
  const router = useRouter()
  const { partner, clearAuth } = usePartnerAuthStore()
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-card/90 backdrop-blur-md lg:hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-btn bg-primary text-primary-content">
          <NodeMark className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold leading-tight">{partner?.name}</p>
          <p className="truncate text-xs font-normal text-muted">Partner portal</p>
        </div>
        <ThemeToggle className="flex h-9 w-9 items-center justify-center rounded-btn text-muted transition-colors hover:bg-primary/10 hover:text-primary" />
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
    </header>
  )
}
