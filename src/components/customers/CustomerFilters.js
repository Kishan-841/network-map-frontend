'use client'

import { Select } from '@/components/ui/Input'
import {
  CONN_OPTIONS,
  EXPIRY_OPTIONS,
  RENEWAL_OPTIONS,
} from '@/lib/customer-filters'

// A facet value picked from the URL may not be in the list (e.g. a stale link) — keep it selectable.
const withCurrent = (options, current) =>
  current && !options.some((o) => o.value === current) ? [...options, { value: current, label: current }] : options

const fromStrings = (list = []) => list.map((v) => ({ value: v, label: v }))

/**
 * The filter controls (everything but search), defined once and rendered both inline (desktop) and
 * inside the phone sheet — `idSuffix` only keeps the two copies' ids apart. A change calls
 * `onChange(patch)`; the page owns the state (the URL) and resets the page to 1.
 */
export function CustomerFilters({ filters, facets, onChange, idSuffix = '' }) {
  const id = (name) => `customers-${name}${idSuffix}`
  const select = (name, label, options, allLabel) => {
    const opts = withCurrent(options, filters[name])
    return (
      <Select
        id={id(name)}
        label={label}
        value={filters[name]}
        onChange={(e) => onChange({ [name]: e.target.value })}
      >
        <option value="">{allLabel}</option>
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    )
  }

  return (
    <>
      {select(
        'zoneId',
        'Our zone',
        (facets?.zones ?? []).map((z) => ({ value: z.id, label: z.name })),
        'All zones',
      )}
      {select('networkZone', 'Network zone', fromStrings(facets?.networkZones), 'All network zones')}
      {select('operator', 'Operator', fromStrings(facets?.operators), 'All operators')}
      {select('billingStatus', 'Billing status', fromStrings(facets?.billingStatuses), 'Any status')}
      {select('conn', 'Connection', CONN_OPTIONS, 'Any connection')}
      {select('expiry', 'Plan expiry', EXPIRY_OPTIONS, 'Any expiry')}
      {select('planName', 'Plan', fromStrings(facets?.planNames), 'All plans')}
      {select('autoRenewal', 'Auto renewal', RENEWAL_OPTIONS, 'Any')}
      <label className="flex min-h-12 cursor-pointer items-center gap-3 self-end text-sm font-medium text-ink">
        <input
          id={id('weak')}
          type="checkbox"
          className="checkbox checkbox-sm"
          checked={filters.weak === 'true'}
          onChange={(e) => onChange({ weak: e.target.checked ? 'true' : '' })}
        />
        Weak signal only
      </label>
    </>
  )
}
