/**
 * The material catalogue a surveyor asks for on a society's site survey.
 * Mirrors the backend's `src/lib/society-materials.js` — keys are the API's,
 * so a key added there must be added here too. Units: 'm' (metres) or
 * 'count' (pieces).
 */

const group = (key, label, unit, items) => ({
  key,
  label,
  unit,
  items: items.map(([itemKey, itemLabel]) => ({ key: itemKey, label: itemLabel, unit })),
})

const sizes = (prefix) =>
  ['1X2', '1X4', '1X6', '1X8', '1X16'].map((s) => [`${prefix}_${s}`, s.replace('X', '×')])

export const MATERIAL_GROUPS = [
  group('FIBER', 'Fiber', 'm', [
    ['FIBER_4F', '4F'],
    ['FIBER_6F', '6F'],
    ['FIBER_12F', '12F'],
    ['FIBER_24F', '24F'],
    ['FIBER_48F', '48F'],
  ]),
  group('PVC_PIPE', 'PVC pipe', 'm', [
    ['PVC_PIPE_40', '40 mm'],
    ['PVC_PIPE_25', '25 mm'],
  ]),
  group('FLEX_PIPE', 'Flexible pipe', 'm', [
    ['FLEX_PIPE_40', '40 mm'],
    ['FLEX_PIPE_25', '25 mm'],
  ]),
  group('PVC_DUCT', 'PVC duct', 'm', [['PVC_DUCT_40', '40 mm']]),
  group('FITTINGS', 'Fittings', 'count', [
    ['FOUR_WAY', '4-way'],
    ['SIDE_L', 'Side L'],
    ['SCREW_BOX', 'Screw box'],
    ['RAWL_PLUG', 'Rawl plug'],
    ['FAT_BOX', 'FAT box'],
    ['FDC', 'FDC'],
  ]),
  group('CLOSURES', 'Closures', 'count', [
    ['CLOSURE_TIFFIN', 'Tiffin'],
    ['CLOSURE_JUMBO_4WAY', 'Jumbo 4-way'],
  ]),
  group('STEEL_TUBE', 'Steel tube', 'count', sizes('STEEL_TUBE')),
  group('CASSETTE', 'Cassette', 'count', sizes('CASSETTE')),
  group('PATCH', 'Patch cord', 'count', [
    ['PATCH_LC_LC', 'LC–LC'],
    ['PATCH_SC_SC', 'SC–SC'],
    ['PATCH_LC_SC', 'LC–SC'],
  ]),
]

/** Every item, flat, each carrying its group's key. */
export const MATERIALS = MATERIAL_GROUPS.flatMap((g) => g.items.map((item) => ({ ...item, group: g.key })))
export const MATERIAL_KEYS = MATERIALS.map((m) => m.key)
const BY_KEY = Object.fromEntries(MATERIALS.map((m) => [m.key, m]))

export const materialLabel = (key) => BY_KEY[key]?.label ?? key
export const materialUnit = (key) => BY_KEY[key]?.unit ?? 'count'
/** How a unit prints next to a quantity. */
export const unitText = (unit) => (unit === 'm' ? 'm' : 'pcs')

/**
 * A saved material request as the read-only list shows it: only items asked
 * for (qty > 0), grouped, in catalogue order. Unknown keys are left out.
 */
export function materialRows(materials) {
  const m = materials ?? {}
  return MATERIAL_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    unit: g.unit,
    items: g.items.filter((item) => Number(m[item.key]) > 0).map((item) => ({ ...item, qty: Number(m[item.key]) })),
  })).filter((g) => g.items.length > 0)
}
