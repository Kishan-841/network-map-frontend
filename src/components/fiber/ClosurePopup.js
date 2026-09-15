'use client'

import { useEffect, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { invalidateClosures } from '@/hooks/useClosures'
import { invalidateFibers } from '@/hooks/useFibers'
import { coreColor, FIBER_STATUS, RATIO_LABELS } from '@/lib/fiber/constants'
import { canManageFiber } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/Button'
import { IconClose, IconTrash } from '@/components/ui/icons'
import SplitterForm from '@/components/fiber/SplitterForm'

const CHIP = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium'

const ROLE_LABEL = {
  in: 'ends here',
  out: 'starts here',
  through: 'passes through',
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="h-6 w-32 animate-pulse rounded-btn bg-paper" />
      <div className="h-4 w-48 animate-pulse rounded-btn bg-paper" />
      <div className="h-24 w-full animate-pulse rounded-card bg-paper" />
      <div className="h-24 w-full animate-pulse rounded-card bg-paper" />
    </div>
  )
}

/** One fiber touching this closure — a row that hands off to the fiber panel. */
function FiberRow({ fiber, onOpenFiber }) {
  const status = FIBER_STATUS[fiber.status] ?? FIBER_STATUS.PLANNED
  return (
    <button
      type="button"
      onClick={() => onOpenFiber?.(fiber.id)}
      className="flex min-h-11 w-full items-center gap-2 rounded-btn px-2 py-1.5 text-left transition-colors hover:bg-paper"
    >
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: coreColor(fiber.coreCount) }}
      />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{fiber.name}</span>
      <span className={`${CHIP} bg-paper text-muted`}>{ROLE_LABEL[fiber.role] ?? fiber.role}</span>
      <span className={`${CHIP} ${status.className}`}>{status.label}</span>
    </button>
  )
}

/** One output port on a splitter card: a fiber link, a building, or free. */
function OutputRow({ output, onOpenFiber }) {
  if (output.toFiber) {
    return (
      <button
        type="button"
        onClick={() => onOpenFiber?.(output.toFiber.id)}
        className="flex min-h-11 w-full items-center rounded-btn px-2 py-1.5 text-left text-sm font-medium text-fiber transition-colors hover:bg-paper"
      >
        Out {output.portNo} → {output.toFiber.name}
      </button>
    )
  }
  if (output.toBuilding) {
    return (
      <div className="flex min-h-11 w-full items-center rounded-btn px-2 py-1.5 text-sm font-medium text-ink">
        Out {output.portNo} → {output.toBuilding.buildingName}
      </div>
    )
  }
  return (
    <div className="flex min-h-11 w-full items-center rounded-btn px-2 py-1.5 text-sm text-faint">
      Out {output.portNo} · free
    </div>
  )
}

/** A splitter card: ratio/location header, its feed, its outputs, delete. */
function SplitterCard({ splitter, fiberById, canManage, busy, onOpenFiber, onDelete }) {
  // Three states: no input chosen yet, an input chosen but not among this
  // closure's own fibers (data integrity oddity — still worth surfacing
  // distinctly rather than silently falling back to "no input yet"), or a
  // resolved feed name.
  const feedLabel = !splitter.inputFiberId
    ? 'no input yet'
    : fiberById.has(splitter.inputFiberId)
      ? `fed by ${fiberById.get(splitter.inputFiberId).name}`
      : 'input fiber not on this closure'
  return (
    <div className="flex flex-col gap-1.5 rounded-card border border-line p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-ink">
            {RATIO_LABELS[splitter.ratio] ?? splitter.ratio} · {splitter.location}
          </p>
          <p className="text-xs font-normal text-faint">{feedLabel}</p>
        </div>
        {canManage && (
          <button
            type="button"
            aria-label="Delete splitter"
            disabled={busy}
            onClick={() => onDelete(splitter)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn text-faint transition-colors hover:bg-bad-tint hover:text-bad disabled:opacity-50"
          >
            <IconTrash className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        {splitter.outputs.map((output) => (
          <OutputRow key={output.portNo} output={output} onOpenFiber={onOpenFiber} />
        ))}
      </div>
    </div>
  )
}

/**
 * Everything known about one closure: its fibers and its splitters. Same
 * responsive shell as FiberDetailPanel (fixed right panel on desktop, bottom
 * sheet on mobile) but narrower — this is a popup, not the main detail view.
 */
export default function ClosurePopup({ closureId, onClose, onOpenFiber, readOnly = false }) {
  const [closure, setClosure] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [version, setVersion] = useState(0)
  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const canManage = canManageFiber(useAuthStore((s) => s.user?.role)) && !readOnly

  useEffect(() => {
    let alive = true
    apiClient
      .get(`/closures/${closureId}`)
      .then((res) => {
        if (!alive) return
        setClosure(res.data.data)
        setError(null)
        setLoading(false)
      })
      .catch((err) => {
        if (!alive) return
        setError(getApiErrorMessage(err, 'Could not load this closure'))
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [closureId, version])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const refresh = () => setVersion((v) => v + 1)

  const retry = () => {
    setLoading(true)
    setError(null)
    refresh()
  }

  const handleSplitterSaved = () => {
    invalidateClosures()
    invalidateFibers()
    setShowForm(false)
    refresh()
  }

  const deleteSplitter = async (splitter) => {
    const label = RATIO_LABELS[splitter.ratio] ?? splitter.ratio
    if (!window.confirm(`Delete this ${label} splitter?`)) return
    setBusyId(splitter.id)
    setActionError(null)
    try {
      await apiClient.delete(`/splitters/${splitter.id}`)
      invalidateClosures()
      invalidateFibers()
      refresh()
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Could not delete this splitter'))
    } finally {
      setBusyId(null)
    }
  }

  const fiberById = new Map((closure?.fibers ?? []).map((f) => [f.id, f]))
  const endingFibers = (closure?.fibers ?? [])
    .filter((f) => f.role === 'in')
    .map((f) => ({ id: f.id, name: f.name }))

  return (
    <div
      className="fixed inset-0 z-[55] flex items-end bg-ink/40 lg:left-auto lg:right-0 lg:top-0 lg:bottom-0 lg:block lg:w-[380px] lg:bg-transparent"
      onClick={() => onClose?.()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Closure details"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85dvh] w-full flex-col gap-3 overflow-y-auto rounded-t-2xl bg-card p-5 pb-[calc(2rem+env(safe-area-inset-bottom))] shadow-xl lg:h-full lg:max-h-none lg:rounded-none lg:border-l lg:border-line lg:pb-5 lg:shadow-lift"
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="min-w-0 flex-1 truncate text-lg font-bold">{closure?.code ?? 'Closure'}</h2>
          <button
            type="button"
            onClick={() => onClose?.()}
            aria-label="Close"
            className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-btn text-faint transition-colors hover:bg-paper hover:text-ink"
          >
            <IconClose className="h-5 w-5" />
          </button>
        </div>

        {loading && <Skeleton />}

        {!loading && error && (
          <div className="flex flex-col items-start gap-3">
            <p className="rounded-btn bg-bad-tint p-3 text-sm font-medium text-bad">{error}</p>
            <button
              type="button"
              onClick={retry}
              className="min-h-11 rounded-btn border border-line px-4 text-sm font-medium transition-colors hover:bg-paper"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && closure && (
          <>
            <div className="flex flex-col gap-1.5">
              {closure.kind && (
                <span className={`${CHIP} w-fit bg-fiber-tint text-fiber`}>{closure.kind} closure</span>
              )}
              {closure.notes && <p className="text-sm text-muted">{closure.notes}</p>}
              <div className="flex flex-wrap items-center gap-1.5">
                {closure.building && (
                  <span className={`${CHIP} bg-paper text-muted`}>{closure.building.buildingName}</span>
                )}
              </div>
              <p className="font-mono text-xs text-faint">
                {closure.latitude.toFixed(6)}, {closure.longitude.toFixed(6)}
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-bold text-ink">Fibers</h3>
              {closure.fibers.length === 0 && <p className="text-sm text-faint">No fibers here.</p>}
              {closure.fibers.map((fiber) => (
                <FiberRow key={fiber.id} fiber={fiber} onOpenFiber={onOpenFiber} />
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-bold text-ink">Splitters</h3>
              {closure.splitters.length === 0 && <p className="text-sm text-faint">No splitters yet.</p>}
              {closure.splitters.map((splitter) => (
                <SplitterCard
                  key={splitter.id}
                  splitter={splitter}
                  fiberById={fiberById}
                  canManage={canManage}
                  busy={busyId === splitter.id}
                  onOpenFiber={onOpenFiber}
                  onDelete={deleteSplitter}
                />
              ))}

              {actionError && (
                <p className="rounded-btn bg-bad-tint p-3 text-sm font-medium text-bad">{actionError}</p>
              )}

              {canManage && !showForm && (
                <Button type="button" variant="secondary" className="h-11 min-h-11" onClick={() => setShowForm(true)}>
                  Add splitter
                </Button>
              )}

              {canManage && showForm && (
                <SplitterForm
                  closureId={closureId}
                  endingFibers={endingFibers}
                  onSaved={handleSplitterSaved}
                  onCancel={() => setShowForm(false)}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
