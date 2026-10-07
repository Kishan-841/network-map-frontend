'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  IconDashboard,
  IconMap,
  IconBuildings,
  IconPlus,
  IconUser,
  IconCalendar,
  IconUsers,
  IconUserPlus,
  IconShare,
  IconCalculator,
  IconRupee,
  IconMore,
} from '@/components/ui/icons'
import { useAuthStore } from '@/stores/auth-store'
import { isAgent, isLead, isSupervisor, isPartnerManager, isAccounts, isSales, isSalesExecutive, isPermissionExecutive } from '@/lib/roles'
import { MANAGE_LINKS } from '@/lib/manage-links'
import { pickExtraNav } from '@/lib/nav-extras'
import { MoreSheet, splitNav } from '@/components/layout/MoreSheet'

const COVERAGE_NAV = [
  { href: '/dashboard', label: 'Home', icon: IconDashboard },
  { href: '/map', label: 'Map', icon: IconMap },
  { href: '/buildings', label: 'Buildings', icon: IconBuildings },
  { href: '/profile', label: 'Profile', icon: IconUser },
]
// Mirrors the sidebar: an admin does everything a partner manager does.
// Ordered deliberately: the first four are what a thumb reaches without
// opening More, so the registry work an admin does daily comes first.
const ADMIN_NAV = [
  { href: '/dashboard', label: 'Home', icon: IconDashboard },
  { href: '/map', label: 'Map', icon: IconMap },
  { href: '/buildings', label: 'Buildings', icon: IconBuildings },
  { href: '/partners', label: 'Partners', icon: IconUsers },
  { href: '/leads', label: 'Leads', icon: IconUserPlus },
  { href: '/referrals', label: 'Referrals', icon: IconShare },
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
const SALES_NAV = [
  { href: '/sales', label: 'Sales', icon: IconBuildings, exact: true },
  { href: '/sales/map', label: 'Map', icon: IconMap },
  { href: '/sales/leads', label: 'Leads', icon: IconUserPlus },
  { href: '/sales/dashboard', label: 'My work', icon: IconDashboard },
  { href: '/profile', label: 'Profile', icon: IconUser },
]
const SALES_LEAD_NAV = [
  { href: '/sales', label: 'Sales', icon: IconBuildings, exact: true },
  { href: '/sales/map', label: 'Map', icon: IconMap },
  { href: '/sales/leads', label: 'Leads', icon: IconUserPlus },
  { href: '/sales/dashboard', label: 'Dashboard', icon: IconDashboard },
  { href: '/sales/meetings', label: 'Meetings', icon: IconUsers },
  { href: '/sales/plan', label: 'Team plan', icon: IconCalendar },
  { href: '/profile', label: 'Profile', icon: IconUser },
]
// A sales manager also gives their team leaders zones. They also run the
// partner network, whose Leads tab means partner leads — so their own sales
// leads tab says so.
const SALES_MANAGER_NAV = [
  ...SALES_LEAD_NAV.slice(0, -1).map((item) =>
    item.href === '/sales/leads' ? { ...item, label: 'Sales leads' } : item,
  ),
  { href: '/sales/zones', label: 'Team zones', icon: IconMap },
  SALES_LEAD_NAV[SALES_LEAD_NAV.length - 1],
]
const LEAD_NAV = [
  // `exact` — /acquisition/users is a sibling tab, not a child of the dashboard.
  { href: '/acquisition', label: 'Team', icon: IconDashboard, exact: true },
  { href: '/acquisition/users', label: 'Users', icon: IconUsers },
  { href: '/map', label: 'Map', icon: IconMap },
  { href: '/buildings', label: 'Buildings', icon: IconBuildings },
  { href: '/profile', label: 'Profile', icon: IconUser },
]

// A permission executive only captures societies and manages their own.
const PERMISSION_NAV = [
  { href: '/societies', label: 'My buildings', icon: IconBuildings, exact: true },
  { href: '/societies/add', label: 'Add building', icon: IconPlus },
  { href: '/profile', label: 'Profile', icon: IconUser },
]

/** Mobile-only bottom bar (72px, blurred). Hidden at lg — Sidebar takes over. */
export function BottomNav() {
  const pathname = usePathname()
  const user = useAuthStore((s) => s.user)
  const role = user?.role
  const ROLE_NAV = isAgent(role)
    ? AGENT_NAV
    : isLead(role)
      ? LEAD_NAV
      : isSupervisor(role)
        ? SUPERVISOR_NAV
        : isAccounts(role)
          ? ACCOUNTS_NAV
          : isSales(role)
            ? isSalesExecutive(role)
              ? SALES_NAV
              : role === 'SALES_MANAGER'
                ? SALES_MANAGER_NAV
                : SALES_LEAD_NAV
            : isPartnerManager(role)
              ? PARTNER_MANAGER_NAV
              : isPermissionExecutive(role)
                ? PERMISSION_NAV
                : role === 'ADMIN'
                  ? ADMIN_NAV
                  : COVERAGE_NAV

  // The admin pages a phone could not reach at all — every Manage link for an
  // admin, the fiber pages for whoever was ticked. They go after the role's
  // own tabs, so what a thumb reaches first never changes.
  const NAV_ITEMS = [
    ...ROLE_NAV,
    ...pickExtraNav(MANAGE_LINKS, user, ROLE_NAV.map((item) => item.href)),
  ]

  const [moreOpen, setMoreOpen] = useState(false)
  const { visible, overflow } = splitNav(NAV_ITEMS)
  const isActive = (item, path) => (item.exact ? path === item.href : path.startsWith(item.href))
  // "More" lights up when the page you are on lives inside it, so the bar
  // never looks like nothing is selected.
  const inOverflow = overflow.some((item) => isActive(item, pathname))

  const tab = (active) =>
    `flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors duration-200 ${
      active ? 'text-primary' : 'text-muted'
    }`

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-card/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
        <div className="mx-auto flex h-18 max-w-lg">
          {visible.map((item) => {
            const active = isActive(item, pathname)
            const NavIcon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={tab(active)}
              >
                <NavIcon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.8} />
                {item.label}
              </Link>
            )
          })}

          {overflow.length > 0 && (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-expanded={moreOpen}
              className={tab(inOverflow)}
            >
              <IconMore className="h-5 w-5" strokeWidth={inOverflow ? 2.2 : 1.8} />
              More
            </button>
          )}
        </div>
      </nav>

      {moreOpen && (
        <MoreSheet
          items={overflow}
          pathname={pathname}
          isActive={isActive}
          onClose={() => setMoreOpen(false)}
        />
      )}
    </>
  )
}
