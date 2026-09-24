'use client'

import { useEffect, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { ROLE_LABELS } from '@/lib/roles'
import { Button } from '@/components/ui/Button'
import { SearchInput } from '@/components/ui/SearchInput'
import { invalidateSalesBuildings } from '@/hooks/useSales'
import { AssignToTeamModal } from './AssignToTeamModal'

const holderOf = (b) => b.salesAssignments?.[0]?.assignedTo ?? null

/**
 * Search the whole building registry and assign the picked buildings to a team
 * member — a manager's (or admin's) way to pull buildings into the pipeline. A
 * team leader distributes their existing pool instead, so they don't see this.
 */
export function BuildingSearchAssign({ onAssigned }) {
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(() => new Set())
  const [assigning, setAssigning] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    if (debounced.length < 2) {
      setResults([])
      return undefined
    }
    let alive = true
    setLoading(true)
    setError(null)
    apiClient
      .get('/sales/search-buildings', { params: { q: debounced } })
      .then((res) => alive && (setResults(res.data.data), setLoading(false)))
      .catch((err) => alive && (setResults([]), setLoading(false), setError(getApiErrorMessage(err, 'Search failed'))))
    return () => {
      alive = false
    }
  }, [debounced])

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <section className="mb-6 flex flex-col gap-3 rounded-card border border-line bg-card p-4">
      <div>
        <p className="font-medium text-ink">Assign buildings</p>
        <p className="text-sm font-normal text-muted">Search the building registry and hand buildings to your team.</p>
      </div>

      <SearchInput value={q} onChange={setQ} placeholder="Search buildings by name or address…" />

      {selected.size > 0 && (
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{selected.size} selected</p>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="inline-flex h-9 items-center rounded-btn border border-line px-3.5 text-sm font-medium text-muted transition-colors hover:border-faint hover:text-ink"
            >
              Clear
            </button>
            <Button className="h-9 min-h-9" onClick={() => setAssigning(true)}>
              Assign to…
            </Button>
          </div>
        </div>
      )}

      {error && <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>}
      {loading && <p className="text-sm font-normal text-muted">Searching…</p>}
      {!loading && debounced.length >= 2 && results.length === 0 && (
        <p className="text-sm font-normal text-muted">No buildings match “{debounced}”.</p>
      )}

      {results.length > 0 && (
        <ul className="flex max-h-96 flex-col gap-0.5 overflow-y-auto">
          {results.map((b) => {
            const h = holderOf(b)
            return (
              <li key={b.id}>
                <label className="flex cursor-pointer items-start gap-3 rounded-btn p-2 transition-colors hover:bg-paper">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm mt-1 shrink-0"
                    checked={selected.has(b.id)}
                    onChange={() => toggle(b.id)}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">{b.buildingName}</span>
                    <span className="block truncate text-sm font-normal text-muted">{b.formattedAddress}</span>
                    {h && (
                      <span className="text-xs font-normal text-faint">
                        Currently with {h.name} ({ROLE_LABELS[h.role] ?? h.role})
                      </span>
                    )}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      )}

      {assigning && (
        <AssignToTeamModal
          buildingIds={[...selected]}
          onClose={() => setAssigning(false)}
          onDone={({ count }) => {
            setAssigning(false)
            setSelected(new Set())
            setQ('')
            setResults([])
            invalidateSalesBuildings()
            onAssigned?.(count)
          }}
        />
      )}
    </section>
  )
}
