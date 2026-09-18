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
}

export const isAgent = (role) => role === 'ACQUISITION_AGENT'
export const isLead = (role) => role === 'ACQUISITION_LEAD'
/** Acquisition team: no map, zones, operators or fiber anywhere. */
export const isAcquisition = (role) => isAgent(role) || isLead(role)
/** The coverage team that owns the map and the existing registry. */
export const isCoverage = (role) => ['ADMIN', 'MANAGER', 'SURVEYOR'].includes(role)
/** Oversight across BOTH registries — sees every building, edits any of them. */
export const isSupervisor = (role) => role === 'SUPERVISOR'
/**
 * May create and edit building CONTENT, whoever logged it. Distinct from
 * administration (users, zones, operators, logs), which stays with ADMIN.
 * One list so a new role is one edit here, not a hunt through the components.
 */
export const canManageBuildings = (role) => ['ADMIN', 'MANAGER', 'SUPERVISOR'].includes(role)

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
        : '/dashboard'

/** Route prefixes each role must never reach. */
const COVERAGE_ONLY = ['/dashboard', '/admin']
// A supervisor reads every building but administers nothing, and has no
// coverage dashboard of its own.
const OFF_LIMITS_FOR_SUPERVISOR = ['/dashboard', '/admin', '/acquisition']
export const isForbiddenPath = (role, pathname, user) => {
  // Fiber access opens exactly two pages under /admin, for whoever holds it
  // (only ever a map role — canManageFiber checks that).
  if (isFiberPage(pathname) && canManageFiber(user)) return false
  if (isAcquisition(role)) return COVERAGE_ONLY.some((p) => pathname.startsWith(p))
  if (isSupervisor(role)) return OFF_LIMITS_FOR_SUPERVISOR.some((p) => pathname.startsWith(p))
  return false
}
