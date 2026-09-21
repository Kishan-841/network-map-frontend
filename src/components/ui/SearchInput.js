'use client'

import { IconSearch } from '@/components/ui/icons'

/** A full-width search box with a leading icon, for filtering a list on screen. */
export function SearchInput({ value, onChange, placeholder = 'Search…', className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-faint" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-h-12 w-full rounded-btn border border-line bg-card pl-11 pr-4 text-base outline-none transition-shadow focus:border-fiber focus:ring-2 focus:ring-fiber/15"
      />
    </div>
  )
}
