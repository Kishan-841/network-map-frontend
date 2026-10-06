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
  SALES_MANAGER: 'Sales manager',
  TEAM_LEADER: 'Team leader',
  SALES_EXECUTIVE: 'Sales executive',
  PERMISSION_EXECUTIVE: 'Permission Executive',
}

export const isPermissionExecutive = (role) => role === 'PERMISSION_EXECUTIVE'

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
/** Field-sales hierarchy: works assigned buildings, records visits + inquiries. */
export const SALES_ROLES = ['SALES_MANAGER', 'TEAM_LEADER', 'SALES_EXECUTIVE']
export const isSales = (role) => SALES_ROLES.includes(role)
export const isSalesManager = (role) => role === 'SALES_MANAGER'
export const isTeamLeader = (role) => role === 'TEAM_LEADER'
export const isSalesExecutive = (role) => role === 'SALES_EXECUTIVE'
/** May assign / distribute buildings down the sales chain (mirrors the API's ASSIGNER). */
export const canAssignSalesBuildings = (role) => ['ADMIN', 'SALES_MANAGER', 'TEAM_LEADER'].includes(role)

/** May give team leaders zones (mirrors the API's /sales/team-leaders gate). */
export const canManageTeamZones = (role) => role === 'ADMIN' || role === 'SALES_MANAGER'

/** Who the assign picker offers: never a team leader — they work zones now. */
export const assignTargets = (team) => (team ?? []).filter((u) => u.role !== 'TEAM_LEADER')
/**
 * May create and edit building CONTENT, whoever logged it. Distinct from
 * administration (users, zones, operators, logs), which stays with ADMIN.
 * One list so a new role is one edit here, not a hunt through the components.
 */
export const canManageBuildings = (role) => ['ADMIN', 'MANAGER', 'SUPERVISOR'].includes(role)

// May this user edit buildings at all (mirrors `requireBuildingEdit` on the
// API): ADMIN/MANAGER/SUPERVISOR always; a SURVEYOR needs the granted tick.
export const canEditBuildingsAtAll = (user) =>
  ['ADMIN', 'MANAGER', 'SUPERVISOR'].includes(user?.role) ||
  (user?.role === 'SURVEYOR' && user?.canEditBuildings === true)

// May bulk-assign an OLT + PON port. Wider than building editing (user's
// choice): EVERY coverage role, a SURVEYOR with no edit tick included. Mirrors
// `requireOltAssign` / OLT_ASSIGN_ROLES on the API; the server still scopes the
// buildings to the actor's zone, so a surveyor can only map their own zone.
export const OLT_ASSIGN_ROLES = ['ADMIN', 'MANAGER', 'SUPERVISOR', 'SURVEYOR']
export const canAssignOlt = (role) => OLT_ASSIGN_ROLES.includes(role)

/**
 * May edit THIS building. The roles above may edit any of them; a SURVEYOR
 * needs the per-user grant an ADMIN ticks on Users → Assign accesses, and then
 * only for what they logged themselves. Takes the whole user and the building,
 * because ownership is half the answer. Mirrors `mayEditBuildings` in the
 * API's middleware/auth.js, which also re-checks the creator server-side.
 */
export const BUILDING_EDIT_ROLES = ['SURVEYOR']
export const canEditBuilding = (user, building) =>
  canManageBuildings(user?.role) ||
  (user?.canEditBuildings === true &&
    BUILDING_EDIT_ROLES.includes(user?.role) &&
    Boolean(building?.createdById) &&
    building.createdById === user?.id)


/**
 * May build and edit the fiber network — draw routes, add closures, splitters
 * and POPs, mark a fiber cut or restored. A per-user grant, not a role
 * privilege: an ADMIN ticks the user on Users → Assign accesses. Takes the
 * whole USER, not the role. Mirrors `mayManageFiber` in the API's
 * middleware/auth.js — the role list applies to a ticked user too.
 */
export const FIBER_ACCESS_ROLES = ['MANAGER', 'SURVEYOR', 'SUPERVISOR']
export const canManageFiber = (user) =>
  user?.role === 'ADMIN' ||
  (user?.canManageFiber === true && FIBER_ACCESS_ROLES.includes(user?.role))
/** Which per-user ticks a role can hold at all — drives Assign accesses. */
export const ACCESS_ROLES = {
  canManageFiber: FIBER_ACCESS_ROLES,
  canEditBuildings: BUILDING_EDIT_ROLES,
}
export const mayHoldAccess = (role, access) => (ACCESS_ROLES[access] ?? []).includes(role)

/**
 * The admin pages fiber access opens. POPs belong here too: a POP is where the
 * network starts, so whoever draws the cable records the site it runs from.
 */
const FIBER_PAGES = [
  { href: '/admin/fiber', label: 'Fibers' },
  { href: '/admin/closures', label: 'Closures' },
  { href: '/admin/pops', label: 'POPs' },
  { href: '/admin/splitters', label: 'Splitters' },
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
            : isSales(role)
              ? '/sales'
              : isPermissionExecutive(role)
                ? '/societies'
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
/** The field-sales team reach only their own workspace and profile. */
const SALES_ALLOWED = ['/sales', '/profile']
/** A permission executive reaches only their society capture + profile. */
const PERMISSION_ALLOWED = ['/societies', '/profile']
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
  // Allow-list: the sales team reach only /sales and /profile, whatever new
  // staff route is added elsewhere.
  if (isSales(role)) return !SALES_ALLOWED.some((p) => pathname.startsWith(p))
  // Allow-list: a permission executive reaches only /societies and /profile.
  if (isPermissionExecutive(role)) return !PERMISSION_ALLOWED.some((p) => pathname.startsWith(p))
  if (isAcquisition(role)) return COVERAGE_ONLY.some((p) => pathname.startsWith(p))
  if (isSupervisor(role)) return OFF_LIMITS_FOR_SUPERVISOR.some((p) => pathname.startsWith(p))
  // Allow-list rather than deny-list: a new staff route must not silently
  // become reachable by this role just because nobody remembered to add it.
  if (isPartnerManager(role)) return !PARTNER_MANAGER_ALLOWED.some((p) => pathname.startsWith(p))
  return false
}
