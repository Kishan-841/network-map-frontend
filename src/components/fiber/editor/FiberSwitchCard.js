'use client'

import { IconEdit } from '@/components/ui/icons'
import BottomSheet from './BottomSheet'

/**
 * A faint "other" fibre tapped in Pan mode: say which one it is and offer to
 * edit it next, in this same editor.
 */
export default function FiberSwitchCard({ fiber, switching, onEdit, onClose }) {
  return (
    <BottomSheet>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold">{fiber.name?.trim() || 'Unnamed fibre'}</p>
          <p className="truncate text-sm font-normal text-muted">
            {['Fibre', fiber.zone?.name, fiber.coreCount && `${fiber.coreCount} core`].filter(Boolean).join(' · ')}
          </p>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="shrink-0 p-1 text-faint transition-colors hover:text-ink"
        >
          ✕
        </button>
      </div>
      <button
        type="button"
        onClick={onEdit}
        disabled={switching}
        className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-btn bg-fiber px-3.5 text-sm font-medium text-on-fiber transition-colors hover:bg-fiber-deep disabled:opacity-60"
      >
        {switching ? (
          <span className="loading loading-spinner loading-xs" />
        ) : (
          <IconEdit className="h-4 w-4" aria-hidden="true" />
        )}
        Edit this fibre
      </button>
    </BottomSheet>
  )
}
