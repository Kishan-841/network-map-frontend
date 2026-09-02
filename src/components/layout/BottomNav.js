'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  IconDashboard,
  IconMap,
  IconBuildings,
  IconUser,
  IconUsers,
  IconUserPlus,
  IconShare,
  IconCalculator,
  IconRupee,
} from '@/components/ui/icons'
import { useAuthStore } from '@/stores/auth-store'
import { isAgent, isLead, isSupervisor, isPartnerManager, isAccounts } from '@/lib/roles'

const COVERAGE_NAV = [
  { href: '/dashboard', label: 'Home', icon: IconDashboard },
  { href: '/map', label: 'Map', icon: IconMap },
  { href: '/buildings', label: 'Buildings', icon: IconBuildings },
  { href: '/profile', label: 'Profile', icon: IconUser },
]
// Mirrors the sidebar: an admin does everything a partner manager does.
const ADMIN_NAV = [
  { href: '/dashboard', label: 'Home', icon: IconDashboard },
  { href: '/map', label: 'Map', icon: IconMap },
  { href: '/buildings', label: 'Buildings', icon: IconBuildings },
  { href: '/partners', label: 'Partners', icon: IconUsers },
  { href: '/referrals', label: 'Referrals', icon: IconShare },
  { href: '/leads', label: 'Leads', icon: IconUserPlus },
  { href: '/profile', label: 'Profile', icon: IconUser },
]
// The acquisition team never sees the map or the coverage registry.
const AGENT_NAV = [
  { href: '/map', label: 'Map', icon: IconMap },
  { href: '/buildings', label: 'My buildings', icon: IconBuildings },
  { href: '/profile', label: 'Profile', icon: IconUser },
]
// Recruits partners; no building or map access at all.
const PARTNER_MANAGER_NAV = [
  { href: '/partner-dashboard', label: 'Overview', icon: IconDashboard, exact: true },
  { href: '/partners', label: 'Partners', icon: IconUsers },
  { href: '/referrals', label: 'Referrals', icon: IconShare },
  { href: '/leads', label: 'Leads', icon: IconUserPlus },
  { href: '/calculator', label: 'Calculator', icon: IconCalculator },
  { href: '/profile', label: 'Profile', icon: IconUser },
]
/** Finance: one job, one tab. */
const ACCOUNTS_NAV = [
  { href: '/payouts', label: 'Payouts', icon: IconRupee },
  { href: '/profile', label: 'Profile', icon: IconUser },
]
const SUPERVISOR_NAV = [
  { href: '/map', label: 'Map', icon: IconMap },
  { href: '/buildings', label: 'Buildings', icon: IconBuildings },
  { href: '/profile', label: 'Profile', icon: IconUser },
]
const LEAD_NAV = [
  // `exact` — /acquisition/users is a sibling tab, not a child of the dashboard.
  { href: '/acquisition', label: 'Team', icon: IconDashboard, exact: true },
  { href: '/acquisition/users', label: 'Users', icon: IconUsers },
  { href: '/map', label: 'Map', icon: IconMap },
  { href: '/buildings', label: 'Buildings', icon: IconBuildings },
  { href: '/profile', label: 'Profile', icon: IconUser },
]

/** Mobile-only bottom bar (72px, blurred). Hidden at lg — Sidebar takes over. */
export function BottomNav() {
  const pathname = usePathname()
  const role = useAuthStore((s) => s.user?.role)
  const NAV_ITEMS = isAgent(role)
    ? AGENT_NAV
    : isLead(role)
      ? LEAD_NAV
      : isSupervisor(role)
        ? SUPERVISOR_NAV
        : isAccounts(role)
          ? ACCOUNTS_NAV
          : isPartnerManager(role)
            ? PARTNER_MANAGER_NAV
            : role === 'ADMIN'
              ? ADMIN_NAV
              : COVERAGE_NAV

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-card/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
      <div className="mx-auto flex h-18 max-w-lg">
        {NAV_ITEMS.map(({ href, label, icon: NavIcon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center justify-center gap-1 text-xs transition-colors duration-200 ${
                active ? 'font-medium text-fiber' : 'font-normal text-faint'
              }`}
            >
              <NavIcon
                className={`h-5.5 w-5.5 transition-transform duration-300 ${
                  active ? 'scale-105' : ''
                }`}
                strokeWidth={active ? 2 : 1.8}
              />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
