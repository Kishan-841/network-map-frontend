/**
 * Role helpers — one place that knows what each team may see.
 * The API enforces all of this too; these only shape the UI.
 */
export const ROLE_LABELS = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  SURVEYOR: 'Surveyor',
  ACQUISITION_AGENT: 'Acquisition agent',
  ACQUISITION_LEAD: 'Acquisition lead',
  SUPERVISOR: 'Supervisor',
  PARTNER_MANAGER: 'Partner manager',
  ACCOUNTS: 'Accounts',
}

export const isAgent = (role) => role === 'ACQUISITION_AGENT'
export const isLead = (role) => role === 'ACQUISITION_LEAD'
/** Acquisition team: no map, zones, operators or fiber anywhere. */
export const isAcquisition = (role) => isAgent(role) || isLead(role)
/** The coverage team that owns the map and the existing registry. */
export const isCoverage = (role) => ['ADMIN', 'MANAGER', 'SURVEYOR'].includes(role)
/** Oversight across BOTH registries — sees every building, edits any of them. */
export const isSupervisor = (role) => role === 'SUPERVISOR'
/** Recruits external referral partners; never touches the building registry. */
export const isPartnerManager = (role) => role === 'PARTNER_MANAGER'
/**
 * Finance. Records that a partner has been paid and nothing else — no
 * registry, no map, and none of the customers' details behind the earnings.
 */
export const isAccounts = (role) => role === 'ACCOUNTS'
/**
 * May create and edit building CONTENT, whoever logged it. Distinct from
 * administration (users, zones, operators, logs), which stays with ADMIN.
 * One list so a new role is one edit here, not a hunt through the components.
 */
export const canManageBuildings = (role) => ['ADMIN', 'MANAGER', 'SUPERVISOR'].includes(role)

/**
 * May build and edit the fiber network — draw routes, add closures and
 * splitters, mark a fiber cut or restored. A per-user grant, not a role
 * privilege: an ADMIN ticks the user on Users → Assign accesses. Takes the
 * whole USER, not the role. Mirrors `mayManageFiber` in the API's
 * middleware/auth.js — the role list applies to a ticked user too.
 */
export const FIBER_ACCESS_ROLES = ['MANAGER', 'SURVEYOR', 'SUPERVISOR']
export const canManageFiber = (user) =>
  user?.role === 'ADMIN' ||
  (user?.canManageFiber === true && FIBER_ACCESS_ROLES.includes(user?.role))

/** POPs were not opened up with fiber access — still the API's ADMIN / MANAGER. */
export const canManagePops = (role) => ['ADMIN', 'MANAGER'].includes(role)

/** The two admin pages fiber access opens. */
const FIBER_PAGES = [
  { href: '/admin/fiber', label: 'Fibers' },
  { href: '/admin/closures', label: 'Closures' },
]
export const FIBER_PAGE_HREFS = FIBER_PAGES.map(({ href }) => href)
const isFiberPage = (pathname) =>
  FIBER_PAGES.some(({ href }) => pathname === href || pathname.startsWith(`${href}/`))

/**
 * The /admin section's gate. The fiber pages follow the tick — so an unticked
 * manager is kept out of them — and everything else stays ADMIN / MANAGER.
 */
export const mayOpenAdminPath = (user, pathname) =>
  isFiberPage(pathname) ? canManageFiber(user) : ['ADMIN', 'MANAGER'].includes(user?.role)

/**
 * Sidebar links for a ticked user who is not an admin. The admin already has
 * these inside the full Manage group, so gets nothing extra here.
 */
export const fiberNavFor = (user) =>
  user?.role !== 'ADMIN' && canManageFiber(user) ? FIBER_PAGES : []

/**
 * May work the partner network — recruit partners, see their leads, quote the
 * rate card. An admin does everything a partner manager does; the difference
 * is that a partner manager does ONLY this, and sees only their own partners.
 * Mirrors the API, which scopes every partner query by `role !== 'ADMIN'`.
 */
export const canManagePartners = (role) => ['ADMIN', 'PARTNER_MANAGER'].includes(role)

export const DESIGNATIONS = [
  { value: 'CHAIRMAN', label: 'Chairman' },
  { value: 'SECRETARY', label: 'Secretary' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'OWNER', label: 'Owner' },
  { value: 'TREASURER', label: 'Treasurer' },
  { value: 'COMMITTEE_MEMBER', label: 'Committee member' },
  { value: 'WATCHMAN', label: 'Watchman' },
  { value: 'OTHER', label: 'Other' },
]
export const designationLabel = (value) =>
  DESIGNATIONS.find((d) => d.value === value)?.label ?? value

/** Where a role lands after login — each team starts on its own home. */
export const homePathFor = (role) =>
  isAgent(role)
    ? '/buildings'
    : isLead(role)
      ? '/acquisition'
      : // A supervisor oversees everything — the map is the overview, and the
        // coverage dashboard is not theirs.
        isSupervisor(role)
        ? '/map'
        : isPartnerManager(role)
          ? '/partner-dashboard'
          : isAccounts(role)
            ? '/payouts'
            : '/dashboard'

/** Route prefixes each role must never reach. */
const COVERAGE_ONLY = ['/dashboard', '/admin']
// A supervisor reads every building but administers nothing, and has no
// coverage dashboard of its own.
const OFF_LIMITS_FOR_SUPERVISOR = ['/dashboard', '/admin', '/acquisition']
// A partner manager works with people, not the registry: everything about
// buildings, zones and the map is off limits.
const PARTNER_MANAGER_ALLOWED = [
  '/partner-dashboard',
  '/partners',
  '/referrals',
  '/leads',
  '/calculator',
  '/profile',
]
/**
 * The partner network. Only the admin and the partner managers, mirroring the
 * API, which refuses everyone else with a 403.
 *
 * A lead carries a member of the public's name and mobile number, so reaching
 * it needs a reason rather than a senior-sounding role — a manager or
 * supervisor oversees the building registry, not other people's customers.
 */
// The calculator is included because it IS the commission structure — what
// every partner is paid — not just a convenience tool.
const PARTNER_NETWORK = ['/partner-dashboard', '/partners', '/referrals', '/leads', '/calculator']
/** Accounts reaches payouts and their own profile. Nothing else. */
const ACCOUNTS_ALLOWED = ['/payouts', '/profile']
export const isForbiddenPath = (role, pathname, user) => {
  // Checked before the per-role rules below, so a new role cannot reach the
  // partner network just by not appearing in any of them.
  if (PARTNER_NETWORK.some((p) => pathname.startsWith(p)) && !canManagePartners(role)) return true
  // Allow-list, like the partner manager: a new staff route must not become
  // reachable by finance just because nobody remembered to exclude it.
  if (isAccounts(role)) return !ACCOUNTS_ALLOWED.some((p) => pathname.startsWith(p))
  // Fiber access opens exactly two pages under /admin, for whoever holds it
  // (only ever a map role — canManageFiber checks). Below the accounts rule
  // on purpose: finance stays on its allow-list whatever a flag says.
  if (isFiberPage(pathname) && canManageFiber(user)) return false
  if (isAcquisition(role)) return COVERAGE_ONLY.some((p) => pathname.startsWith(p))
  if (isSupervisor(role)) return OFF_LIMITS_FOR_SUPERVISOR.some((p) => pathname.startsWith(p))
  // Allow-list rather than deny-list: a new staff route must not silently
  // become reachable by this role just because nobody remembered to add it.
  if (isPartnerManager(role)) return !PARTNER_MANAGER_ALLOWED.some((p) => pathname.startsWith(p))
  return false
}
