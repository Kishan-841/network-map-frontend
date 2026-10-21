'use client'

import { useMemo, useRef, useState } from 'react'
import { IconClose, IconSearch } from '@/components/ui/icons'
import { buildingFilterLabel, filterBuildings } from '@/lib/customer-filters'

const SHOWN = 50

/**
 * Single-building picker: type to narrow the facet list, tap one to choose it. The chosen building
 * shows as a chip with a clear button (also for a stale link, as "Selected building").
 * `buildings` are { id, buildingName }; `onChange(id)` gets '' when cleared.
 */
export function BuildingPicker({ id, value, buildings = [], onChange }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  const listId = `${id}-list`
  const matches = useMemo(() => filterBuildings(buildings, query), [buildings, query])

  function pick(buildingId) {
    onChange(buildingId)
    setQuery('')
    setOpen(false)
  }

  return (
    <div
      ref={root}
      className="relative flex flex-col gap-1.5 lg:col-span-2"
      onBlur={(e) => {
        // close only when focus leaves the whole picker, so Tab can move into the options
        if (!root.current?.contains(e.relatedTarget)) setOpen(false)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation()
          setOpen(false)
        }
      }}
    >
      <label htmlFor={id} className="text-sm font-medium text-ink">
        Building
      </label>
      {value && (
        <span className="inline-flex w-fit max-w-full items-center gap-2 rounded-full bg-fiber-tint px-3 py-1.5 text-sm font-medium text-fiber">
          <span className="truncate">{buildingFilterLabel(buildings, value)}</span>
          <button type="button" aria-label="Clear building filter" onClick={() => pick('')}>
            <IconClose className="h-3.5 w-3.5" />
          </button>
        </span>
      )}
      <div className="relative">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        <input
          id={id}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          placeholder={value ? 'Pick a different building' : 'Search buildings'}
          autoComplete="off"
          className="h-12 w-full rounded-btn border border-line bg-card pl-9 pr-3 text-sm text-ink outline-none placeholder:text-faint focus:border-fiber focus:ring-2 focus:ring-fiber/15"
        />
      </div>
      {open && (
        <ul id={listId} role="listbox" aria-label="Buildings" className="max-h-48 overflow-y-auto rounded-btn border border-line bg-card shadow-soft">
          {matches.length === 0 && <li role="presentation" className="px-3 py-2.5 text-sm text-muted">No buildings match</li>}
          {matches.slice(0, SHOWN).map((b) => (
            <li key={b.id} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={b.id === value}
                // mousedown fires before the input's blur closes the list, so the tap is not lost
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(b.id)}
                className={`w-full border-b border-line/60 px-3 py-2.5 text-left text-sm transition-colors last:border-b-0 hover:bg-fiber-tint/50 ${
                  b.id === value ? 'font-semibold text-fiber' : 'font-medium'
                }`}
              >
                {b.buildingName}
              </button>
            </li>
          ))}
          {matches.length > SHOWN && (
            <li role="presentation" className="px-3 py-2 text-xs text-muted">Showing the first {SHOWN} — type to narrow</li>
          )}
        </ul>
      )}
    </div>
  )
}
