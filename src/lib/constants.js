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

// PRD marker colors (🟢 feasible, 🟡 permission pending, 🔴 rejected, 🔵 survey
// pending) mapped to the design system's signal palette in globals.css.
export const STATUS_COLORS = {
  FEASIBLE: '#22c55e', // bright, high-visibility green for map pins
  PERMISSION_PENDING: '#96610d', // --color-warn
  REJECTED: '#b3261e', // --color-bad
  SURVEY_PENDING: '#1d6fa5', // --color-scan
}
