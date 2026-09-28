'use client'

import { useMemo, useState } from 'react'
import { IconClose, IconSearch } from '@/components/ui/icons'

/**
 * Searchable multi-select: type to filter, click to add, chips for the picks.
 * Scales past a plain checkbox list. `options` are { id, label, sub? }.
 */
export function MultiSelect({ options, selectedIds, onChange, placeholder = 'Search…', emptyText = 'No matches' }) {
  const [query, setQuery] = useState('')

  const selected = useMemo(() => options.filter((o) => selectedIds.includes(o.id)), [options, selectedIds])
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    return options.filter(
      (o) =>
        !selectedIds.includes(o.id) &&
        (!q || o.label.toLowerCase().includes(q) || o.sub?.toLowerCase().includes(q)),
    )
  }, [options, selectedIds, query])

  const add = (id) => onChange([...selectedIds, id])
  const remove = (id) => onChange(selectedIds.filter((x) => x !== id))

  return (
    <div className="flex flex-col gap-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((o) => (
            <span
              key={o.id}
              className="inline-flex items-center gap-1 rounded-full bg-fiber-tint px-2.5 py-1 text-xs font-medium text-fiber"
            >
              {o.label}
              <button type="button" aria-label={`Remove ${o.label}`} onClick={() => remove(o.id)} className="hover:opacity-70">
                <IconClose className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="h-11 w-full rounded-btn border border-line bg-card pl-9 pr-3 text-sm text-ink outline-none placeholder:text-faint focus:border-fiber focus:ring-2 focus:ring-fiber/15"
        />
      </div>

      <div className="max-h-44 overflow-y-auto rounded-btn border border-line">
        {matches.length === 0 && <p className="px-3 py-2.5 text-sm text-muted">{emptyText}</p>}
        {matches.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => add(o.id)}
            className="flex w-full items-center justify-between gap-2 border-b border-line/60 px-3 py-2.5 text-left text-sm transition-colors last:border-b-0 hover:bg-fiber-tint/50"
          >
            <span className="truncate font-medium">{o.label}</span>
            {o.sub && <span className="shrink-0 text-xs text-muted">{o.sub}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
