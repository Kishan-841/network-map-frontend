// Filter state of the Customers list <-> URL query, plus the small pure helpers its rows need.
// No React in here, so it can be tested (spec 2026-10-21-customers-tab).

import { connectionLabel, connectionTone } from './connection'

export const CONN_VALUES = ['online', 'offline', 'not_seen', 'not_linked', 'no_username', 'never']
export const EXPIRY_VALUES = ['expired', '7d', '30d']
export const RENEWAL_VALUES = ['yes', 'no', 'unset']
export const SORT_VALUES = ['name', 'expiry', 'signal', 'checked']

export const CONN_OPTIONS = [
  { value: 'online', label: 'Online' },
  { value: 'offline', label: 'Offline' },
  { value: 'not_seen', label: 'Not seen' },
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
  return connectionLabel({ state: row.connState, best: { lastSeen: row.connLastSeen } })
}

/** 'ok' | 'bad' | 'warn' | 'muted' for a row's stored state. */
export function connTone(row) {
  return row?.connState ? connectionTone({ state: row.connState }) : 'muted'
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
