// Filter state of the Customers list <-> URL query, plus the small pure helpers its rows need.
// No React in here, so it can be tested (spec 2026-10-21-customers-tab).

import { connectionLabel, connectionTone, isOltDown, oltDownTitle, OLT_DOWN_LABEL } from './connection'

export const CONN_VALUES = ['online', 'offline', 'not_seen', 'olt_down', 'not_linked', 'no_username', 'never']
export const EXPIRY_VALUES = ['expired', '7d', '30d']
export const RENEWAL_VALUES = ['yes', 'no', 'unset']
export const SORT_VALUES = ['name', 'expiry', 'signal', 'checked']

export const CONN_OPTIONS = [
  { value: 'online', label: 'Online' },
  { value: 'offline', label: 'Offline' },
  { value: 'not_seen', label: 'Not seen' },
  { value: 'olt_down', label: OLT_DOWN_LABEL },
  { value: 'not_linked', label: 'Not linked' },
  { value: 'no_username', label: 'No username' },
  { value: 'never', label: 'Never checked' },
]
export const EXPIRY_OPTIONS = [
  { value: 'expired', label: 'Expired' },
  { value: '7d', label: 'Expires in 7 days' },
  { value: '30d', label: 'Expires in 30 days' },
]
export const RENEWAL_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unset', label: 'Not set' },
]
export const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'expiry', label: 'Expiry (soonest first)' },
  { value: 'signal', label: 'Signal (weakest first)' },
  { value: 'checked', label: 'Last checked' },
]

const TEXT_KEYS = ['q', 'zoneId', 'networkZone', 'operator', 'billingStatus', 'buildingId', 'planName']
const oneOf = (values, v) => (values.includes(v) ? v : '')

/** Everything the list can be narrowed by, with its untouched value. */
export const EMPTY_FILTERS = {
  q: '',
  zoneId: '',
  networkZone: '',
  operator: '',
  billingStatus: '',
  conn: '',
  weak: '',
  expiry: '',
  buildingId: '',
  planName: '',
  autoRenewal: '',
  sort: 'name',
  page: 1,
}

/** URLSearchParams -> filters. Unknown or malformed values fall back to "no filter". */
export function parseFilters(params) {
  const get = (k) => (params?.get(k) ?? '').trim()
  const out = { ...EMPTY_FILTERS }
  for (const k of TEXT_KEYS) out[k] = get(k)
  out.conn = oneOf(CONN_VALUES, get('conn'))
  out.weak = get('weak') === 'true' ? 'true' : ''
  out.expiry = oneOf(EXPIRY_VALUES, get('expiry'))
  out.autoRenewal = oneOf(RENEWAL_VALUES, get('autoRenewal'))
  out.sort = oneOf(SORT_VALUES, get('sort')) || 'name'
  const page = Number.parseInt(get('page'), 10)
  out.page = Number.isInteger(page) && page > 1 ? page : 1
  return out
}

/** filters -> URLSearchParams, leaving out every empty/default value (so a clean URL means "no filters"). */
export function toQuery(filters) {
  const params = new URLSearchParams()
  for (const k of [...TEXT_KEYS, 'conn', 'weak', 'expiry', 'autoRenewal']) {
    const v = typeof filters?.[k] === 'string' ? filters[k].trim() : ''
    if (v) params.set(k, v)
  }
  if (filters?.sort && filters.sort !== 'name') params.set('sort', filters.sort)
  if (filters?.page > 1) params.set('page', String(filters.page))
  return params
}

/** Number of narrowing filters set (search, sort and page do not count). */
export function activeFilterCount(filters) {
  return [...TEXT_KEYS.filter((k) => k !== 'q'), 'conn', 'weak', 'expiry', 'autoRenewal'].filter((k) => filters?.[k])
    .length
}

/** The summary tiles above the list. `patch` is applied on top of a cleared status/signal/expiry. */
export const TILES = [
  { id: 'total', label: 'Total', countKey: 'total', patch: {} },
  { id: 'online', label: 'Online', countKey: 'online', patch: { conn: 'online' } },
  { id: 'offline', label: 'Offline', countKey: 'offline', patch: { conn: 'offline' } },
  { id: 'not_seen', label: 'Not seen', countKey: 'notSeen', patch: { conn: 'not_seen' } },
  { id: 'olt_down', label: OLT_DOWN_LABEL, countKey: 'oltDown', patch: { conn: 'olt_down' }, onlyWhenPositive: true },
  { id: 'weak', label: 'Weak signal', countKey: 'weak', patch: { weak: 'true' } },
  { id: 'expiring', label: 'Expiring in 7 days', countKey: 'expiring7d', patch: { expiry: '7d' } },
]
const TILE_KEYS = ['conn', 'weak', 'expiry']

/** Filters after tapping a tile: the three tile-owned filters are replaced, everything else kept, page reset. */
export function applyTile(filters, tile) {
  const next = { ...filters, page: 1 }
  for (const k of TILE_KEYS) next[k] = ''
  return { ...next, ...tile.patch }
}

/** Is this tile the one currently applied? "Total" is lit when no tile-owned filter is set. */
export function tileActive(filters, tile) {
  const patchKeys = Object.keys(tile.patch)
  if (patchKeys.length === 0) return TILE_KEYS.every((k) => !filters[k])
  return TILE_KEYS.every((k) => (patchKeys.includes(k) ? filters[k] === tile.patch[k] : !filters[k]))
}

/** Words for the stored connection state; `never` (no snapshot yet) reads "Never checked". */
export function connLabel(row) {
  if (!row?.connState) return 'Never checked'
  return connectionLabel({ state: row.connState, oltReachable: row.oltReachable, best: { lastSeen: row.connLastSeen } })
}

/** 'ok' | 'bad' | 'warn' | 'muted' for a row's stored state. */
export function connTone(row) {
  return row?.connState ? connectionTone({ state: row.connState }) : 'muted'
}

/** Is this list row "not seen" only because its OLT is unreachable? */
export const rowOltDown = (row) => isOltDown({ state: row?.connState, oltReachable: row?.oltReachable })

/** Tooltip of a row's connection cell: the OLT explanation, else "checked 6 min ago". */
export function connTitle(row, now = Date.now()) {
  if (rowOltDown(row)) return oltDownTitle(row.connOlt)
  return checkedAgo(row?.connCheckedAt, now) || undefined
}

/** Tiles to render: onlyWhenPositive ones disappear at count 0 (or not loaded) unless their filter is active. */
export function visibleTiles(counts, filters) {
  return TILES.filter((t) => !t.onlyWhenPositive || (counts?.[t.countKey] ?? 0) > 0 || (filters ? tileActive(filters, t) : false))
}

export const STALE_MS = 5 * 60000
export const REFRESH_MAX_IDS = 50

/** Ids of rows whose stored status was never checked or is older than 5 min (at most 50). */
export function staleIds(rows = [], now = Date.now()) {
  return rows
    .filter((r) => !r.connCheckedAt || !(now - new Date(r.connCheckedAt).getTime() < STALE_MS))
    .map((r) => r.id)
    .slice(0, REFRESH_MAX_IDS)
}

/** Replace rows by id with the refreshed ones; everything else is kept as it was. */
export function mergeRows(rows = [], updates = []) {
  if (!updates.length) return rows
  const byId = new Map(updates.map((u) => [u.id, u]))
  return rows.map((r) => (byId.has(r.id) ? { ...r, ...byId.get(r.id) } : r))
}

/** `checked 6 min ago` / `checked 2 h ago` / `checked 3 days ago`; '' when never checked. */
export function checkedAgo(date, now = Date.now()) {
  if (!date) return ''
  const ms = new Date(now).getTime() - new Date(date).getTime()
  if (!Number.isFinite(ms)) return ''
  const min = Math.floor(Math.max(0, ms) / 60000)
  if (min < 1) return 'checked just now'
  if (min < 60) return `checked ${min} min ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `checked ${h} h ago`
  const d = Math.floor(h / 24)
  return `checked ${d} ${d === 1 ? 'day' : 'days'} ago`
}

/**
 * 'bad' once the plan has expired, 'warn' within 7 days, else null (also null with no date).
 * A rolling window, not calendar days: expired = before now, warn = up to now + 7 x 24 h
 * (the backend's "expiring in 7 days" filter and tile use the same definition).
 */
export function expiryTone(date, now = Date.now()) {
  if (!date) return null
  const ms = new Date(date).getTime() - new Date(now).getTime()
  if (!Number.isFinite(ms)) return null
  if (ms < 0) return 'bad'
  return ms <= 7 * 86400000 ? 'warn' : null
}

/** Buildings whose name contains the typed text (case-insensitive); all of them when empty. */
export function filterBuildings(buildings = [], query = '') {
  const q = query.trim().toLowerCase()
  return q ? buildings.filter((b) => b.buildingName?.toLowerCase().includes(q)) : buildings
}

/** Name for the picked building; a stale link (id not in the facet list) reads "Selected building". */
export function buildingFilterLabel(buildings = [], id) {
  if (!id) return ''
  return buildings.find((b) => b.id === id)?.buildingName ?? 'Selected building'
}

/** "18m" / "2h" / "3d" since `date`; '' with no date. Under a minute reads "now". */
export function shortAge(date, now = Date.now()) {
  if (!date) return ''
  const ms = new Date(now).getTime() - new Date(date).getTime()
  if (!Number.isFinite(ms)) return ''
  const min = Math.floor(Math.max(0, ms) / 60000)
  if (min < 1) return 'now'
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

const shortDate = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })

const SHORT_WORDS = {
  online: 'Online',
  offline: 'Offline',
  not_seen: 'Not seen',
  not_linked: 'Not linked',
  no_username: 'No username',
  unavailable: 'Unavailable',
  pending: 'Not checked yet',
}

/**
 * The one-line connection cell as { word, note }: "Online" + "18m", "Not seen" + "since 5 Oct",
 * "Never checked" + ''. `state` empty means no snapshot yet.
 */
export function connShort({ state, lastSeen, checkedAt, oltReachable } = {}, now = Date.now()) {
  if (!state) return { word: 'Never checked', note: '' }
  const word = isOltDown({ state, oltReachable }) ? OLT_DOWN_LABEL : (SHORT_WORDS[state] ?? 'Unknown')
  if (state === 'not_seen' && lastSeen) return { word, note: `since ${shortDate.format(new Date(lastSeen))}` }
  return { word, note: shortAge(checkedAt, now) }
}

const EXPIRY_CHIP = { expired: 'Expired', '7d': 'within 7 days', '30d': 'within 30 days' }

/**
 * One chip per narrowing filter, in a stable order: { key, label, patch }. `patch` clears just that
 * filter. `facets` supplies names for zone and building ids (a stale id reads generically).
 */
export function filterChips(filters, facets = {}) {
  const f = filters ?? {}
  const chips = []
  const add = (key, label) => chips.push({ key, label, patch: { [key]: '' } })
  if (f.zoneId) add('zoneId', `Zone: ${facets?.zones?.find((z) => z.id === f.zoneId)?.name ?? 'Selected zone'}`)
  if (f.networkZone) add('networkZone', `Network zone: ${f.networkZone}`)
  if (f.operator) add('operator', `Operator: ${f.operator}`)
  if (f.billingStatus) add('billingStatus', `Billing: ${f.billingStatus}`)
  if (f.buildingId) add('buildingId', `Building: ${buildingFilterLabel(facets?.buildings, f.buildingId)}`)
  if (f.conn) add('conn', `Connection: ${CONN_OPTIONS.find((o) => o.value === f.conn)?.label ?? f.conn}`)
  if (f.expiry) add('expiry', `Expires: ${EXPIRY_CHIP[f.expiry] ?? f.expiry}`)
  if (f.planName) add('planName', `Plan: ${f.planName}`)
  if (f.autoRenewal) {
    const r = RENEWAL_OPTIONS.find((o) => o.value === f.autoRenewal)?.label ?? f.autoRenewal
    add('autoRenewal', `Auto renewal: ${r}`)
  }
  if (f.weak) add('weak', 'Weak signal')
  return chips
}

/** Back link of the Customers-tab detail: only a /customers path (query allowed) is trusted. */
export function safeBackHref(back) {
  const v = Array.isArray(back) ? back[0] : back
  if (typeof v !== 'string') return '/customers'
  return /^\/customers(?:[/?#]|$)/.test(v) && !v.includes('//') ? v : '/customers'
}

/** Link from a Customers-tab row to its detail, remembering the list (path + query) to come back to. */
export function customerDetailHref(id, pathname, search = '') {
  const here = `${pathname}${search ? (search.startsWith('?') ? search : `?${search}`) : ''}`
  return `/customers/${id}?back=${encodeURIComponent(here)}`
}
