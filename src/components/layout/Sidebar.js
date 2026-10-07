'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import { useUiStore } from '@/stores/ui-store'
import { apiClient } from '@/lib/api-client'
import { useTheme } from '@/hooks/useTheme'
import { NAV_GROUPS } from '@/lib/manage-links'
import {
  isAgent,
  isLead,
  isSupervisor,
  isPartnerManager,
  isAccounts,
  isSales,
  isSalesExecutive,
  isPermissionExecutive,
  fiberNavFor,
  partnerNavFor,
  ROLE_LABELS,
} from '@/lib/roles'
import {
  NodeMark,
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
  IconChevronDown,
  IconSun,
  IconMoon,
  IconCollapse,
  IconExpand,
  IconLogout,
} from '@/components/ui/icons'

const COVERAGE_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: IconDashboard },
  { href: '/map', label: 'Map', icon: IconMap },
  { href: '/buildings', label: 'Buildings', icon: IconBuildings },
  { href: '/profile', label: 'Profile', icon: IconUser },
]
/**
 * An admin does everything a partner manager does, so the partner tabs sit in
 * the admin's own nav rather than only in a role that cannot see the registry.
 * The calculator lives in Manage instead — an admin quotes rates far less
 * often than they look at partners and leads, and six is what the bar holds.
 */
const ADMIN_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: IconDashboard },
  { href: '/map', label: 'Map', icon: IconMap },
  { href: '/buildings', label: 'Buildings', icon: IconBuildings },
]
const AGENT_NAV = [
  { href: '/map', label: 'Map', icon: IconMap },
  { href: '/buildings', label: 'My buildings', icon: IconBuildings },
  { href: '/profile', label: 'Profile', icon: IconUser },
]
// Oversight role: everything the map and registry offer, no administration.
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
  { href: '/buildings', label: 'All buildings', icon: IconBuildings },
  { href: '/profile', label: 'Profile', icon: IconUser },
]
const LEAD_NAV = [
  // `exact` — /acquisition/users is a sibling tab, not a child of the dashboard.
  { href: '/acquisition', label: 'Acquisition team', icon: IconDashboard, exact: true },
  { href: '/map', label: 'Map', icon: IconMap },
  { href: '/buildings', label: 'Buildings', icon: IconBuildings },
  { href: '/acquisition/users', label: 'Users', icon: IconUsers },
  { href: '/profile', label: 'Profile', icon: IconUser },
]
// Field-sales team: their assigned buildings (and, for a manager/leader, the
// pool they distribute) live on one page for now.
const SALES_NAV = [
  { href: '/sales', label: 'Sales', icon: IconBuildings, exact: true },
  { href: '/sales/map', label: 'Map', icon: IconMap },
  { href: '/sales/leads', label: 'Leads', icon: IconUserPlus },
  { href: '/sales/dashboard', label: 'My work', icon: IconDashboard },
  { href: '/profile', label: 'Profile', icon: IconUser },
]
// Managers and team leaders also get the team dashboard.
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

/**
 * One collapsible group in the admin sidebar.
 *
 * Opens itself when the current page is inside it, so you can always see
 * where you are without hunting — and a group you opened by hand stays open
 * until you close it.
 */
function NavGroup({ label, items, pathname, collapsed, renderLink, defaultOpen = false }) {
  const holdsCurrent = items.some((item) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href),
  )
  const [open, setOpen] = useState(holdsCurrent || defaultOpen)
  const wasHolding = useRef(holdsCurrent)

  // Navigating INTO the group opens it; navigating away leaves it as the
  // reader left it.
  useEffect(() => {
    if (holdsCurrent && !wasHolding.current) setOpen(true)
    wasHolding.current = holdsCurrent
  }, [holdsCurrent])

  // Collapsed rail has no room for headings — show the icons, always.
  if (collapsed) {
    return (
      <>
        <div className="mx-auto my-3 h-px w-8 bg-neutral-content/15" />
        <div className="flex flex-col gap-1">{items.map((item) => renderLink(item))}</div>
      </>
    )
  }

  return (
    <div className="pt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 rounded-btn px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-wider text-neutral-content/40 transition-colors hover:text-neutral-content/70"
      >
        <IconChevronDown
          className={`h-3 w-3 shrink-0 transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
          strokeWidth={2.5}
        />
        {label}
        {!open && holdsCurrent && (
          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
        )}
      </button>
      {open && <div className="mt-1 flex flex-col gap-1">{items.map((item) => renderLink(item))}</div>}
    </div>
  )
}

// A permission executive only captures societies and manages their own.
const PERMISSION_NAV = [
  { href: '/societies', label: 'My buildings', icon: IconBuildings, exact: true },
  { href: '/societies/add', label: 'Add building', icon: IconPlus },
  { href: '/profile', label: 'Profile', icon: IconUser },
]

function initials(name = '') {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

const iconBtn =
  'flex h-9 w-9 items-center justify-center rounded-btn text-neutral-content/60 transition-colors duration-200 hover:bg-neutral-content/10 hover:text-neutral-content'

/**
 * Desktop rail on the theme's neutral surface (adapts to every DaisyUI theme).
 * Collapse toggle sits top-right; a logout button anchors the bottom.
 * Width lives in --sidebar-w so the content shell and map track it.
 */
export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  // Named to match BottomNav, which selects the role directly. The two files
  // pick the same nav from the same role and have twice now drifted on how
  // they spell it.
  const role = user?.role
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const { sidebarCollapsed: collapsed, toggleSidebar } = useUiStore()
  const { theme, toggle: toggleTheme } = useTheme()
  const NAV_ITEMS = isAgent(role)
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

  // Fiber access is granted per user (Users → Assign accesses). Whoever holds
  // it gets the same two links the admin has, icons and all, in a group of
  // their own — looked up from NAV_GROUPS so the two can't drift apart.
  const fiberHrefs = fiberNavFor(user).map((item) => item.href)
  const FIBER_ITEMS = NAV_GROUPS.flatMap((group) => group.items).filter((item) =>
    fiberHrefs.includes(item.href),
  )
  // A sales manager also runs four partner-network pages — the admin's own
  // links, looked up the same way.
  const partnerHrefs = partnerNavFor(role)
  const PARTNER_ITEMS = NAV_GROUPS.flatMap((group) => group.items).filter((item) =>
    partnerHrefs.includes(item.href),
  )

  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-w', collapsed ? '80px' : '280px')
  }, [collapsed])

  function handleLogout() {
    apiClient.post('/auth/logout').catch(() => {}) // audit only — never block logout
    clearAuth()
    router.replace('/login')
  }

  // Plain render helper (not a component) — keeps link identity stable and
  // shares one style between the main nav and the Manage section.
  const navLink = ({ href, label, icon: NavIcon, exact }) => {
    const active = exact ? pathname === href : pathname.startsWith(href)
    return (
      <Link
        key={href}
        href={href}
        title={collapsed ? label : undefined}
        aria-current={active ? 'page' : undefined}
        className={`group flex items-center gap-3 rounded-btn py-2.5 text-sm font-medium transition-colors duration-200 ${
          collapsed ? 'justify-center px-0' : 'px-3.5'
        } ${
          active
            ? 'bg-primary text-primary-content shadow-sm'
            : 'text-neutral-content/60 hover:bg-neutral-content/10 hover:text-neutral-content'
        }`}
      >
        <NavIcon
          className={`h-5 w-5 shrink-0 transition-transform duration-200 ${
            collapsed ? '' : 'group-hover:translate-x-0.5'
          }`}
          strokeWidth={1.8}
        />
        {!collapsed && label}
      </Link>
    )
  }

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 hidden flex-col bg-neutral text-neutral-content transition-[width] duration-300 lg:flex ${
        collapsed ? 'w-20' : 'w-[280px]'
      }`}
    >
      {/* Header: brand + collapse toggle (top-right) */}
      {collapsed ? (
        <div className="flex flex-col items-center gap-3 pb-6 pt-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-btn bg-primary text-primary-content">
            <NodeMark className="h-6 w-6" />
          </span>
          <button onClick={toggleSidebar} title="Expand sidebar" aria-label="Expand sidebar" className={iconBtn}>
            <IconExpand className="h-4.5 w-4.5" strokeWidth={1.8} />
          </button>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2 px-5 pb-6 pt-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-btn bg-primary text-primary-content">
              <NodeMark className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-bold leading-tight tracking-tight">
                ISP Coverage
              </p>
              <p className="truncate text-xs font-normal text-neutral-content/50">
                Field survey console
              </p>
            </div>
          </div>
          <button
            onClick={toggleSidebar}
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
            className={`${iconBtn} -mr-1 shrink-0`}
          >
            <IconCollapse className="h-4.5 w-4.5" strokeWidth={1.8} />
          </button>
        </div>
      )}

      {/* Nav (scrollable — the Manage section makes it tall on short screens) */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-3">
        <div className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => navLink(item))}
        </div>

        {/* Grouped, and ADMIN-only. Eighteen links as one flat list is a
            wall nobody reads. */}
        {role === 'ADMIN' &&
          NAV_GROUPS.map((group) => (
            <NavGroup
              key={group.label}
              label={group.label}
              items={group.items}
              pathname={pathname}
              collapsed={collapsed}
              renderLink={navLink}
            />
          ))}
        {FIBER_ITEMS.length > 0 && (
          <NavGroup
            label="Fiber"
            items={FIBER_ITEMS}
            // Two links, and the whole reason this user was ticked — don't hide them.
            defaultOpen
            pathname={pathname}
            collapsed={collapsed}
            renderLink={navLink}
          />
        )}
        {PARTNER_ITEMS.length > 0 && (
          <NavGroup
            label="Partner network"
            items={PARTNER_ITEMS}
            defaultOpen
            pathname={pathname}
            collapsed={collapsed}
            renderLink={navLink}
          />
        )}
      </nav>

      {/* Bottom: user + theme toggle + logout */}
      <div
        className={`mt-auto flex flex-col gap-2 border-t border-neutral-content/10 pb-5 pt-4 ${
          collapsed ? 'items-center px-2' : 'px-3'
        }`}
      >
        {user && (
          <Link
            href="/profile"
            title={collapsed ? user.name : undefined}
            className={`flex items-center gap-3 rounded-btn transition-colors duration-200 hover:bg-neutral-content/10 ${
              collapsed ? 'p-1.5' : 'px-2 py-2'
            }`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
              {initials(user.name)}
            </span>
            {!collapsed && (
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{user.name}</span>
                <span className="block text-xs font-normal text-neutral-content/50">
                  {ROLE_LABELS[user.role] ?? user.role}
                </span>
              </span>
            )}
          </Link>
        )}

        <div className={`flex gap-2 ${collapsed ? 'flex-col items-center' : ''}`}>
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
            aria-label={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
            className={iconBtn}
          >
            {theme === 'dark' ? (
              <IconSun className="h-4.5 w-4.5" strokeWidth={1.8} />
            ) : (
              <IconMoon className="h-4.5 w-4.5" strokeWidth={1.8} />
            )}
          </button>
          <button
            onClick={handleLogout}
            title="Log out"
            aria-label="Log out"
            className={`flex h-9 items-center justify-center gap-2 rounded-btn text-sm font-medium text-neutral-content/70 transition-colors duration-200 hover:bg-error/15 hover:text-error ${
              collapsed ? 'w-9' : 'flex-1'
            }`}
          >
            <IconLogout className="h-4.5 w-4.5" strokeWidth={1.8} />
            {!collapsed && 'Log out'}
          </button>
        </div>
      </div>
    </aside>
  )
}
