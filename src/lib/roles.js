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
 * May create and edit building CONTENT, whoever logged it. Distinct from
 * administration (users, zones, operators, logs), which stays with ADMIN.
 * One list so a new role is one edit here, not a hunt through the components.
 */
export const canManageBuildings = (role) => ['ADMIN', 'MANAGER', 'SUPERVISOR'].includes(role)

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
          ? '/partners'
          : '/dashboard'

/** Route prefixes each role must never reach. */
const COVERAGE_ONLY = ['/dashboard', '/admin']
// A supervisor reads every building but administers nothing, and has no
// coverage dashboard of its own.
const OFF_LIMITS_FOR_SUPERVISOR = ['/dashboard', '/admin', '/acquisition']
// A partner manager works with people, not the registry: everything about
// buildings, zones and the map is off limits.
const PARTNER_MANAGER_ALLOWED = ['/partners', '/leads', '/calculator', '/profile']
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
const PARTNER_NETWORK = ['/partners', '/leads', '/calculator']
export const isForbiddenPath = (role, pathname) => {
  // Checked before the per-role rules below, so a new role cannot reach the
  // partner network just by not appearing in any of them.
  if (PARTNER_NETWORK.some((p) => pathname.startsWith(p)) && !canManagePartners(role)) return true
  if (isAcquisition(role)) return COVERAGE_ONLY.some((p) => pathname.startsWith(p))
  if (isSupervisor(role)) return OFF_LIMITS_FOR_SUPERVISOR.some((p) => pathname.startsWith(p))
  // Allow-list rather than deny-list: a new staff route must not silently
  // become reachable by this role just because nobody remembered to add it.
  if (isPartnerManager(role)) return !PARTNER_MANAGER_ALLOWED.some((p) => pathname.startsWith(p))
  return false
}
