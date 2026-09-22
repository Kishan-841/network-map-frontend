'use client'

import { useEffect, useRef } from 'react'
import { canManageFiber } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'
import { IconArrowLeft, IconClose } from '@/components/ui/icons'
import PopDetails from './PopDetails'
import FiberDetails from './FiberDetails'
import ClosureDetails from './ClosureDetails'
import BuildingDetails from './BuildingDetails'

const TITLES = { pop: 'POP details', fiber: 'Fiber details', closure: 'Closure details', building: 'Building details' }
const BODIES = { pop: PopDetails, fiber: FiberDetails, closure: ClosureDetails, building: BuildingDetails }

/**
 * The one place a POP, fiber, closure or building is read in full — on the
 * map and on the Fibers, POPs and Closures pages alike.
 *
 * It opens from the right edge, so the map stays visible to its left on a
 * desktop; on a phone it covers most of the screen over a dimmed backdrop.
 * Clicking anywhere outside it, or pressing Escape, closes it — on the desktop
 * as well as the phone. `stack` comes from `lib/fiber/detail-stack.js`: the
 * last entry is shown, and Back steps to the one before.
 */
export default function DetailDrawer({ stack, onOpen, onBack, onClose, onCentre, onEditFiber, onEditPop, readOnly = false }) {
  const entry = stack.at(-1)
  const canManage = canManageFiber(useAuthStore((s) => s.user)) && !readOnly
  const panelRef = useRef(null)
  // The outside-press listeners must ignore the tail of the very gesture that
  // opened the drawer. On touch, a map marker opens the drawer on `touchend`
  // (Google Maps fires a marker's click there, mid-tap), so the drawer mounts
  // while the panel is still sliding in from off-screen; the tap's trailing
  // synthesized `mousedown` — and the backdrop's own click — then land outside
  // the panel a millisecond later and would close it instantly (the bug: on a
  // phone the drawer flashed open and vanished). Arm them one frame after open,
  // once those events have passed. A mouse click on desktop is unaffected: the
  // marker opens on `click`, after its mousedown has already fired.
  const armedRef = useRef(false)

  useEffect(() => {
    if (!entry) return undefined
    armedRef.current = false
    const raf = requestAnimationFrame(() => {
      armedRef.current = true
    })
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    // A press that starts outside the panel closes it. `mousedown` (not click)
    // so it fires even when the press lands on the map or a table row behind.
    const onDown = (e) => {
      if (armedRef.current && panelRef.current && !panelRef.current.contains(e.target)) onClose?.()
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [entry, onClose])

  if (!entry) return null
  const Body = BODIES[entry.kind]

  return (
    <>
      {/* Phone only: the map behind is covered anyway, so a tap outside closes.
          Guarded like the mousedown listener so the opening tap's own click,
          which lands here while the panel is still sliding in, is ignored. */}
      <div
        className="fixed inset-0 z-[59] bg-ink/40 lg:hidden"
        onClick={() => armedRef.current && onClose?.()}
        aria-hidden="true"
      />
      <aside
        ref={panelRef}
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
