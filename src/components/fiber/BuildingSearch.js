'use client'

import { useEffect, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { Input } from '@/components/ui/Input'

const DEBOUNCE_MS = 300
const MIN_CHARS = 2

/**
 * Find a building by name or address, asking the server only once typing
 * pauses (300 ms, from two letters). Lists buildings the user may see
 * (GET /buildings is role-scoped). `onPick(building)` gets the list row.
 */
export default function BuildingSearch({ onPick, autoFocus = false }) {
  const [query, setQuery] = useState('')
  // The answer, tagged with the text it answers, so an old reply never shows under new text.
  const [result, setResult] = useState({ for: null, items: [], error: null })
  const text = query.trim()

  useEffect(() => {
    if (text.length < MIN_CHARS) return undefined
    let alive = true
    const timer = setTimeout(() => {
      apiClient
        .get('/buildings', { params: { search: text, page: 1, pageSize: 8 } })
        .then((res) => alive && setResult({ for: text, items: res.data.data.items ?? [], error: null }))
        .catch((err) => alive && setResult({ for: text, items: [], error: getApiErrorMessage(err, 'Could not search buildings') }))
    }, DEBOUNCE_MS)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [text])

  const answered = result.for === text
  return (
    <div className="flex flex-col gap-2">
      <Input
        id="splitter-building-search"
        label="Which building is it in?"
        placeholder="Type the building name or address"
        value={query}
        autoFocus={autoFocus}
        autoComplete="off"
        onChange={(e) => setQuery(e.target.value)}
      />
      {text.length >= MIN_CHARS && (
        <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-btn border border-line">
          {!answered && <li className="px-3 py-3 text-sm font-normal text-muted">Searching…</li>}
          {answered && result.error && <li className="px-3 py-3 text-sm font-medium text-bad">{result.error}</li>}
          {answered && !result.error && result.items.length === 0 && (
            <li className="px-3 py-3 text-sm font-normal text-muted">No building matches that.</li>
          )}
          {answered &&
            result.items.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => onPick(b)}
                  className="flex min-h-11 w-full flex-col items-start px-3 py-2 text-left transition-colors hover:bg-paper"
                >
                  <span className="text-sm font-medium text-ink">{b.buildingName}</span>
                  <span className="line-clamp-1 text-xs font-normal text-muted">
                    {[b.zone?.name, b.formattedAddress].filter(Boolean).join(' · ')}
                  </span>
                </button>
              </li>
            ))}
        </ul>
      )}
      {text.length > 0 && text.length < MIN_CHARS && (
        <p className="text-xs font-normal text-muted">Type at least {MIN_CHARS} letters.</p>
      )}
    </div>
  )
}
