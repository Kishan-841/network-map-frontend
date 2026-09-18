'use client'

import { useEffect, useRef, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { Field } from '@/components/ui/Input'
import { IconSearch } from '@/components/ui/icons'

const MIN_CHARS = 2
const DEBOUNCE_MS = 300
const MAX_RESULTS = 8

/**
 * Find a building we have already surveyed and drop the pin on it.
 *
 * Distinct from the map's place search, which asks Google: a POP usually sits
 * in or beside a building somebody on the team has already logged, and our own
 * row carries the coordinates that were checked on site. The list the API
 * returns is already scoped to the reader, so a surveyor searches their own
 * buildings and nobody else's.
 */
export function BuildingSearchField({ onPick, label = 'Find a building' }) {
  const [query, setQuery] = useState('')
  // Keyed by the term they belong to, so a short query shows nothing without
  // an effect having to clear anything — the rule here forbids setState in an
  // effect body, and derived state is the honest fix anyway.
  const [found, setFound] = useState({ term: '', items: [], status: 'idle' })
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const onPickRef = useRef(onPick)
  useEffect(() => {
    onPickRef.current = onPick
  })

  useEffect(() => {
    function onDocClick(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  useEffect(() => {
    const term = query.trim()
    if (term.length < MIN_CHARS) return undefined
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setFound((prev) => ({ ...prev, term, status: 'loading' }))
      apiClient
        .get('/buildings', {
          params: { search: term, page: 1, pageSize: MAX_RESULTS },
          signal: controller.signal,
        })
        .then((res) => setFound({ term, items: res.data.data.items ?? [], status: 'done' }))
        .catch((err) => {
          if (err.code === 'ERR_CANCELED') return
          setFound({ term, items: [], status: 'error' })
        })
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  const term = query.trim()
  // Only ever show results that belong to what is typed now.
  const results = found.term === term ? found.items : []
  const status = found.term === term ? found.status : 'loading'

  const pick = (building) => {
    setOpen(false)
    setQuery(building.buildingName)
    onPickRef.current?.({
      latitude: building.latitude,
      longitude: building.longitude,
      name: building.buildingName,
    })
  }

  return (
    <div ref={wrapRef} className="relative">
      <Field label={label} htmlFor="pop-building-search">
        <div className="relative">
          <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            id="pop-building-search"
            value={query}
            autoComplete="off"
            placeholder="Search a surveyed building by name…"
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            className="min-h-12 w-full rounded-btn border border-line bg-card pl-11 pr-4 text-base outline-none focus:border-fiber focus:ring-2 focus:ring-fiber/15"
          />
        </div>
      </Field>

      {open && query.trim().length >= MIN_CHARS && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-btn border border-line bg-card shadow-lift">
          {status === 'error' && (
            <p className="px-3 py-3 text-sm font-normal text-bad">Search is unavailable right now.</p>
          )}
          {status === 'loading' && results.length === 0 && (
            <p className="px-3 py-3 text-sm font-normal text-muted">Searching…</p>
          )}
          {status === 'done' && results.length === 0 && (
            <p className="px-3 py-3 text-sm font-normal text-muted">No building by that name</p>
          )}
          {results.map((building) => (
            <button
              key={building.id}
              type="button"
              onClick={() => pick(building)}
              className="block min-h-12 w-full px-3 py-2.5 text-left transition-colors hover:bg-paper"
            >
              <span className="block truncate text-sm font-medium">{building.buildingName}</span>
              <span className="block truncate text-[11px] text-muted">
                {building.formattedAddress}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
