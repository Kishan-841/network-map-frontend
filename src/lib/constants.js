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

// Live-connection marker colors: green when the fiber connection is live,
// red when it isn't yet.
export const LIVE_COLOR = '#22c55e' // green
export const NOT_LIVE_COLOR = '#dc2626' // red
export const buildingColor = (building) => (building?.isLive ? LIVE_COLOR : NOT_LIVE_COLOR)
