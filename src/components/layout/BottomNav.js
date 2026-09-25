'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  IconDashboard,
  IconMap,
  IconBuildings,
  IconUser,
  IconUsers,
  IconMore,
} from '@/components/ui/icons'
import { useAuthStore } from '@/stores/auth-store'
import { isAgent, isLead, isSupervisor, isSales, isSalesExecutive } from '@/lib/roles'
import { MANAGE_LINKS } from '@/lib/manage-links'
import { pickExtraNav } from '@/lib/nav-extras'
import { MoreSheet, splitNav } from '@/components/layout/MoreSheet'

const COVERAGE_NAV = [
  { href: '/dashboard', label: 'Home', icon: IconDashboard },
  { href: '/map', label: 'Map', icon: IconMap },
  { href: '/buildings', label: 'Buildings', icon: IconBuildings },
  { href: '/profile', label: 'Profile', icon: IconUser },
]
// The acquisition team never sees the map or the coverage registry.
const AGENT_NAV = [
  { href: '/map', label: 'Map', icon: IconMap },
  { href: '/buildings', label: 'My buildings', icon: IconBuildings },
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
const SALES_NAV = [
  { href: '/sales', label: 'Sales', icon: IconBuildings, exact: true },
  { href: '/sales/map', label: 'Map', icon: IconMap },
  { href: '/sales/dashboard', label: 'My work', icon: IconDashboard },
  { href: '/profile', label: 'Profile', icon: IconUser },
]
const SALES_LEAD_NAV = [
  { href: '/sales', label: 'Sales', icon: IconBuildings, exact: true },
  { href: '/sales/map', label: 'Map', icon: IconMap },
  { href: '/sales/dashboard', label: 'Dashboard', icon: IconDashboard },
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
        : isSales(role)
          ? isSalesExecutive(role)
            ? SALES_NAV
            : SALES_LEAD_NAV
          : COVERAGE_NAV

  // The admin pages a phone could not reach at all — every Manage link for an
  // admin, the fiber pages for whoever was ticked on Users → Assign accesses.
  // They go after the role's own tabs, so what a thumb reaches first never
  // changes, and splitNav folds whatever spills over behind More.
  const NAV_ITEMS = [
    ...ROLE_NAV,
    ...pickExtraNav(MANAGE_LINKS, user, ROLE_NAV.map((item) => item.href)),
  ]
  const { visible, overflow } = splitNav(NAV_ITEMS)
  const [moreOpen, setMoreOpen] = useState(false)
  const isActive = (item, path) => (item.exact ? path === item.href : path.startsWith(item.href))
  // More lights up when the page you are on lives inside it, so the bar never
  // looks like nothing is selected.
  const inOverflow = overflow.some((item) => isActive(item, pathname))
  const tabClass = (active) =>
    `flex flex-1 flex-col items-center justify-center gap-1 text-xs transition-colors duration-200 ${
      active ? 'font-medium text-fiber' : 'font-normal text-faint'
    }`

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-card/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
        <div className="mx-auto flex h-18 max-w-lg">
          {visible.map((item) => {
            const { href, label, icon: NavIcon } = item
            const active = isActive(item, pathname)
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={tabClass(active)}
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

          {overflow.length > 0 && (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-expanded={moreOpen}
              className={tabClass(inOverflow)}
            >
              <IconMore className="h-5.5 w-5.5" strokeWidth={inOverflow ? 2 : 1.8} />
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
