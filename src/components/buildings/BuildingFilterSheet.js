'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { IconClose } from '@/components/ui/icons'

/**
 * Bottom sheet holding the buildings filter controls on phones. It never
 * owns the filter values itself — the controls it renders (passed as
 * children) call straight back into the page's own state setters, so a
 * change applies immediately, exactly like the inline row on larger screens.
 * Clear/Done only reset or close; there is no separate "apply" step.
 */
export default function BuildingFilterSheet({ open, onClose, onClear, activeCount, children }) {
  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/40 lg:hidden" onClick={onClose}>
      <div
        className="w-full rounded-t-2xl bg-card p-5 pb-[calc(2rem+env(safe-area-inset-bottom))] shadow-xl max-h-[85dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Filters</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-paper"
          >
            <IconClose className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3">{children}</div>

        <div className="mt-5 flex gap-3">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={onClear}
            disabled={activeCount === 0}
          >
            Clear
          </Button>
          <Button type="button" className="flex-1" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}
