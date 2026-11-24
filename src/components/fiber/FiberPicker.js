'use client'

import { useEffect, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { Input } from '@/components/ui/Input'
import { distanceLabel } from '@/lib/fiber/splitter-place'

const DEBOUNCE_MS = 300

/** Ask GET /fibers/nearby once the inputs settle; the answer is tagged with what it answers. */
function useNearbyFibers(params, enabled) {
  const key = JSON.stringify(params)
  const [result, setResult] = useState({ key: null, list: [], error: null })
  useEffect(() => {
    if (!enabled) return undefined
    let alive = true
    const timer = setTimeout(() => {
      apiClient
        .get('/fibers/nearby', { params: JSON.parse(key) })
        .then((res) => alive && setResult({ key, list: res.data.data ?? [], error: null }))
        .catch((err) => alive && setResult({ key, list: [], error: getApiErrorMessage(err, 'Could not load fibres') }))
    }, DEBOUNCE_MS)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [key, enabled])
  return { ...result, loading: enabled && result.key !== key }
}

function Choice({ checked, onSelect, title, sub }) {
  return (
    <li>
      <button
        type="button"
        role="radio"
        aria-checked={checked}
        onClick={onSelect}
        className={`flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
          checked ? 'bg-fiber-tint' : 'hover:bg-paper'
        }`}
      >
        <span
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 rounded-full border-2 ${checked ? 'border-fiber bg-fiber' : 'border-line'}`}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">{title}</span>
          {sub && <span className="block text-xs font-normal text-muted">{sub}</span>}
        </span>
      </button>
    </li>
  )
}

/**
 * The fibre feeding a splitter (spec 2026-11-24-splitter-in-building): fibres
 * passing within 100 m of the pin, nearest first; a route-name search for any
 * other; or none. `value` is the chosen fibre { id, name } or null.
 */
export default function FiberPicker({ latitude, longitude, value, onChange }) {
  const [query, setQuery] = useState('')
  const text = query.trim()
  const searching = text.length >= 2
  const pin = latitude != null && longitude != null ? { lat: latitude.toFixed(6), lng: longitude.toFixed(6) } : {}
  const near = useNearbyFibers(pin, !searching && pin.lat != null)
  const found = useNearbyFibers({ q: text, ...pin }, searching)
  const shown = searching ? found : near

  const pick = (f) => onChange(f ? { id: f.id, name: f.name } : null)
  const listed = shown.list.some((f) => f.id === value?.id)

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-ink">Input fiber</span>
      <Input
        id="splitter-fiber-search"
        aria-label="Search fibres by route name"
        placeholder="Search by route name (e.g. FIB-22)"
        value={query}
        autoComplete="off"
        onChange={(e) => setQuery(e.target.value)}
      />
      <p className="text-xs font-normal text-muted">
        {searching ? 'Fibres matching that name' : 'Fibres within 100 m of the pin, nearest first'}
      </p>
      <ul role="radiogroup" aria-label="Input fiber" className="flex max-h-64 flex-col divide-y divide-line overflow-y-auto rounded-btn border border-line">
        <Choice checked={!value} onSelect={() => pick(null)} title="None yet" sub="Link it later in the fibre editor" />
        {value && !listed && <Choice checked onSelect={() => {}} title={value.name} sub="Chosen" />}
        {shown.loading && <li className="px-3 py-3 text-sm font-normal text-muted">Looking…</li>}
        {!shown.loading && shown.error && <li className="px-3 py-3 text-sm font-medium text-bad">{shown.error}</li>}
        {!shown.loading && !shown.error && shown.list.length === 0 && (
          <li className="px-3 py-3 text-sm font-normal text-muted">
            {searching ? 'No fibre matches that name.' : 'No fibre within 100 m — search by name instead.'}
          </li>
        )}
        {!shown.loading &&
          shown.list.map((f) => (
            <Choice
              key={f.id}
              checked={value?.id === f.id}
              onSelect={() => pick(f)}
              title={f.name}
              sub={distanceLabel(f.distanceM) ? `${distanceLabel(f.distanceM)} away` : null}
            />
          ))}
      </ul>
    </div>
  )
}
