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
}

export const isAgent = (role) => role === 'ACQUISITION_AGENT'
export const isLead = (role) => role === 'ACQUISITION_LEAD'
/** Acquisition team: no map, zones, operators or fiber anywhere. */
export const isAcquisition = (role) => isAgent(role) || isLead(role)
/** The coverage team that owns the map and the existing registry. */
export const isCoverage = (role) => ['ADMIN', 'MANAGER', 'SURVEYOR'].includes(role)

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
  isAgent(role) ? '/buildings' : isLead(role) ? '/acquisition' : '/dashboard'

/** Route prefixes the acquisition team must never reach. */
const COVERAGE_ONLY = ['/dashboard', '/admin']
export const isForbiddenPath = (role, pathname) =>
  isAcquisition(role) && COVERAGE_ONLY.some((p) => pathname.startsWith(p))
