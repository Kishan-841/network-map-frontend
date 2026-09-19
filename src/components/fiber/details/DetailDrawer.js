'use client'

import { useEffect } from 'react'
import { canManageFiber } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'
import { IconArrowLeft, IconClose } from '@/components/ui/icons'
import PopDetails from './PopDetails'
import FiberDetails from './FiberDetails'
import ClosureDetails from './ClosureDetails'

const TITLES = { pop: 'POP details', fiber: 'Fiber details', closure: 'Closure details' }
const BODIES = { pop: PopDetails, fiber: FiberDetails, closure: ClosureDetails }

/**
 * The one place a POP, fiber or closure is read in full — on the map and on
 * the Fibers, POPs and Closures pages alike.
 *
 * It opens from the right edge, so the map stays visible to its left on a
 * desktop; on a phone it covers most of the screen over a dimmed backdrop
 * that closes it. `stack` comes from `lib/fiber/detail-stack.js`:
 * the last entry is shown, and Back steps to the one before.
 */
export default function DetailDrawer({ stack, onOpen, onBack, onClose, onCentre, onEditFiber, onEditPop, readOnly = false }) {
  const entry = stack.at(-1)
  const canManage = canManageFiber(useAuthStore((s) => s.user)) && !readOnly

  useEffect(() => {
    if (!entry) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [entry, onClose])

  if (!entry) return null
  const Body = BODIES[entry.kind]

  return (
    <>
      {/* Phone only: the map behind is covered anyway, so a tap outside closes. */}
      <div className="fixed inset-0 z-[59] bg-ink/40 lg:hidden" onClick={() => onClose?.()} aria-hidden="true" />
      <aside
        role="dialog"
        aria-label={TITLES[entry.kind]}
        className="fixed inset-y-0 right-0 z-[60] flex w-[min(92vw,440px)] flex-col border-l border-line bg-card shadow-lift transition-transform duration-200 ease-out starting:translate-x-full"
      >
        <header className="flex items-center gap-1 border-b border-line px-2 py-2">
          {stack.length > 1 ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn text-muted transition-colors hover:bg-paper hover:text-ink"
            >
              <IconArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <span className="w-3" />
          )}
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-muted">{TITLES[entry.kind]}</p>
          <button
            type="button"
            onClick={() => onClose?.()}
            aria-label="Close"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn text-faint transition-colors hover:bg-paper hover:text-ink"
          >
            <IconClose className="h-5 w-5" />
          </button>
        </header>

        {/* Keyed per record, so each one loads fresh and starts at the top. */}
        <div
          key={`${entry.kind}:${entry.id}`}
          className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-4"
        >
          <Body
            id={entry.id}
            canManage={canManage}
            onOpen={onOpen}
            onCentre={onCentre}
            onEdit={entry.kind === 'fiber' ? onEditFiber : entry.kind === 'pop' ? onEditPop : undefined}
          />
        </div>
      </aside>
    </>
  )
}
