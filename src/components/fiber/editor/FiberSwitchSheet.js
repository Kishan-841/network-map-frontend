'use client'

import { useMemo, useState } from 'react'
import { SearchInput } from '@/components/ui/SearchInput'
import { coreColor } from '@/lib/fiber/constants'
import { fiberChoices } from '@/lib/fiber/switch'
import BottomSheet, { SHEET_DIALOG } from './BottomSheet'

/**
 * "Edit another fibre": search the fibres this user can see (the same
 * role-scoped list as the Fibers page) and pick one to edit without leaving
 * the editor.
 */
export default function FiberSwitchSheet({ fibers, loading, currentId, onPick, onClose }) {
  const [query, setQuery] = useState('')
  const choices = useMemo(() => fiberChoices(fibers, query, currentId), [fibers, query, currentId])

  return (
    <BottomSheet desktop={SHEET_DIALOG} backdrop onBackdropClick={onClose}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-bold">Edit another fibre</p>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="shrink-0 p-1 text-faint transition-colors hover:text-ink"
        >
          ✕
        </button>
      </div>

      <SearchInput value={query} onChange={setQuery} placeholder="Search fibres by name or zone…" className="mb-2" />

      {loading && fibers.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Loading fibres…</p>
      ) : choices.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No fibre matches “{query.trim()}”.</p>
      ) : (
        <ul className="-mx-1 max-h-[55dvh] overflow-y-auto lg:max-h-96">
          {choices.map((fiber) => (
            <li key={fiber.id}>
              <button
                type="button"
                onClick={() => onPick(fiber)}
                className="flex min-h-12 w-full items-center gap-3 rounded-btn px-2 py-2 text-left transition-colors hover:bg-paper"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: coreColor(fiber.coreCount) }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{fiber.name?.trim() || 'Unnamed fibre'}</span>
                  <span className="block truncate text-xs text-muted">
                    {[fiber.zone?.name, fiber.coreCount && `${fiber.coreCount} core`].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {choices.total > choices.length && (
        <p className="pt-2 text-center text-xs text-muted">
          Showing {choices.length} of {choices.total} — type to narrow it down
        </p>
      )}
    </BottomSheet>
  )
}
