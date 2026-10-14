import { wingSummary } from './building-wings'

export const GPS_ACCURACY_WARN_METERS = 20

// Zone boundary colors — assigned by list index (zones are name-ordered, so
// stable). Green/red excluded: those mean feasible/rejected on markers.
export const ZONE_COLORS = [
  '#0e7569', // fiber teal
  '#1d6fa5', // blue
  '#7c3aed', // purple
  '#b45309', // amber
  '#be185d', // pink
  '#475569', // slate
]

export const zoneColor = (index) => ZONE_COLORS[index % ZONE_COLORS.length]

// Fiber cable types with FIXED render colors — the color on the map IS the
// type, so field teams read the network at a glance. Shared by the fiber
// editor, admin list, and the /map layer.
export const FIBER_TYPE_COLORS = {
  '2 core': '#eab308', // yellow
  '4 core': '#2563eb', // blue
  '6 core': '#10b981', // green
  '12 core': '#a855f7', // purple
  '24 core': '#f97316', // orange
  '48 core': '#dc2626', // red
}
export const FIBER_TYPES = Object.keys(FIBER_TYPE_COLORS)
export const fiberTypeColor = (type) => FIBER_TYPE_COLORS[type] ?? FIBER_TYPE_COLORS['2 core']

// Live-connection marker colors: green when the fiber connection is live,
// red when it isn't yet.
export const LIVE_COLOR = '#22c55e' // green
export const NOT_LIVE_COLOR = '#dc2626' // red
export const PARTIAL_COLOR = '#f59e0b' // amber — some, not all, wings live
// A building whose wings are ALL placed takes its colour from them: all live
// green, some live amber, none red (spec 2026-10-14). While only partly placed
// it keeps its own Live flag (the badge still shows how many are placed).
export const buildingColor = (building) => {
  const summary = wingSummary(building)
  if (summary.complete) {
    return summary.state === 'all' ? LIVE_COLOR : summary.state === 'some' ? PARTIAL_COLOR : NOT_LIVE_COLOR
  }
  return building?.isLive ? LIVE_COLOR : NOT_LIVE_COLOR
}

// System log filter options — must match backend module/action names
// (see backend src/modules/system-logs + route annotations).
export const SYSTEM_LOG_MODULES = [
  'Auth',
  'User',
  'Zone',
  'Building',
  'BuildingType',
  'Upload',
  'FiberRoute',
  'Fiber',
  'Closure',
  'Splitter',
  'Pop',
]
export const SYSTEM_LOG_ACTIONS = [
  'Login',
  'FailedLogin',
  'Logout',
  'Create',
  'BulkCreate',
  'BulkZoneAssign',
  'Update',
  'Delete',
  'StatusChange',
  'PhotoAdd',
  'PhotoDelete',
  'FileUpload',
  'Cut',
  'Restore',
  'SegmentUpdate',
  'SplitterAdd',
  'OltCreate',
  'OltUpdate',
  'OltDelete',
]
