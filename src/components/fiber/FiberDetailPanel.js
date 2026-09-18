'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { coreColor } from '@/lib/fiber/constants'
import { canManageFiber } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'
import { IconClose } from '@/components/ui/icons'
import SegmentList from '@/components/fiber/SegmentList'
import FiberActions from '@/components/fiber/FiberActions'

// React Flow measures the DOM on mount, so the schematic never renders on the
// server. The placeholder holds the same height to keep the panel from jumping.
const FiberSchematic = dynamic(() => import('@/components/fiber/FiberSchematic'), {
  ssr: false,
  loading: () => <div className="h-64 rounded-card bg-paper lg:h-72" />,
})

const metres = (n) => `${Math.round(n ?? 0)} m`

function Stat({ caption, value }) {
  return (
    <div className="rounded-btn bg-paper px-2.5 py-2">
      <p className="truncate text-[11px] font-normal text-faint">{caption}</p>
      <p className="text-sm font-bold tabular-nums text-ink">{value}</p>
    </div>
  )
}

const CHIP = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium'

/** OLT feed, upstream splitter, or nothing — one chip, sometimes a link up the tree. */
function FeedChip({ fiber, onSwap }) {
  if (fiber.olt) {
    return (
      <span className={`${CHIP} bg-paper text-muted`}>
        {fiber.olt.pop.name} · {fiber.olt.name} · port {fiber.ponPort}
      </span>
    )
  }
  if (!fiber.fedBy) return <span className={`${CHIP} bg-paper text-faint`}>No feed</span>

  const { portNo, splitter } = fiber.fedBy
  const label = `Fed by ${splitter.closure?.code ?? splitter.code ?? 'splitter'} · out ${portNo}`
  if (!splitter.inputFiber) return <span className={`${CHIP} bg-paper text-muted`}>{label}</span>
  return (
    <button
      type="button"
      onClick={() => onSwap?.(splitter.inputFiber.id)}
      className={`${CHIP} bg-fiber-tint text-fiber transition-opacity hover:opacity-80`}
    >
      {label} · {splitter.inputFiber.name} →
    </button>
  )
}

function DetailsBlock({ fiber }) {
  const rows = [
    ['Cable type', fiber.cableType],
    ['Cable tag', fiber.cableTag],
    ['Placement', fiber.placement],
    ['Operator', fiber.operator?.name],
    ['Zone', fiber.zone?.name],
    ['Notes', fiber.notes],
  ].filter(([, value]) => value)
  const images = fiber.images ?? []
  if (rows.length === 0 && images.length === 0) return null

  return (
    <details className="rounded-card border border-line px-3 py-2">
      <summary className="cursor-pointer py-1.5 text-sm font-medium text-ink">Details</summary>
      <dl className="mt-1 flex flex-col gap-1.5 pb-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex gap-3 text-sm">
            <dt className="w-24 shrink-0 font-normal text-faint">{label}</dt>
            <dd className="min-w-0 flex-1 break-words text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2 pb-2">
          {images.map((url) => (
            <a key={url} href={url} target="_blank" rel="noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-20 w-full rounded-btn object-cover" />
            </a>
          ))}
        </div>
      )}
    </details>
  )
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="h-6 w-40 animate-pulse rounded-btn bg-paper" />
      <div className="h-7 w-full animate-pulse rounded-full bg-paper" />
      <div className="h-16 w-full animate-pulse rounded-card bg-paper" />
      <div className="h-64 w-full animate-pulse rounded-card bg-paper lg:h-72" />
      <div className="h-24 w-full animate-pulse rounded-card bg-paper" />
    </div>
  )
}

/**
 * Everything known about one fiber: a right-hand panel on desktop, a bottom
 * sheet on a phone. One DOM tree with responsive classes rather than two, so
 * the React Flow schematic is only ever mounted once.
 *
 * The mount site passes `key={fiberId}`, so this always starts fresh — state
 * is only ever set from a settled request, never synchronously in an effect.
 */
export default function FiberDetailPanel({ fiberId, onClose, onEdit, onSwap, onCentre, readOnly = false }) {
  const [fiber, setFiber] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [version, setVersion] = useState(0)
  const canManage = canManageFiber(useAuthStore((s) => s.user)) && !readOnly

  useEffect(() => {
    let alive = true
    apiClient
      .get(`/fibers/${fiberId}`)
      .then((res) => {
        if (!alive) return
        setFiber(res.data.data)
        setError(null)
        setLoading(false)
      })
      .catch((err) => {
        if (!alive) return
        setError(getApiErrorMessage(err, 'Could not load this fiber'))
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [fiberId, version])

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

  return (
    <div
      className="fixed inset-0 z-[55] flex items-end bg-ink/40 lg:left-auto lg:right-0 lg:top-0 lg:bottom-0 lg:block lg:w-[420px] lg:bg-transparent"
      onClick={() => onClose?.()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Fiber details"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85dvh] w-full flex-col gap-3 overflow-y-auto rounded-t-2xl bg-card p-5 pb-[calc(2rem+env(safe-area-inset-bottom))] shadow-xl lg:h-full lg:max-h-none lg:rounded-none lg:border-l lg:border-line lg:pb-5 lg:shadow-lift"
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="min-w-0 flex-1 truncate text-lg font-bold">{fiber?.name ?? 'Fiber'}</h2>
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

        {!loading && !error && fiber && (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`${CHIP} bg-paper text-muted`}>
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: coreColor(fiber.coreCount) }}
                />
                {fiber.coreCount} core
              </span>
              <FeedChip fiber={fiber} onSwap={onSwap} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Stat caption="Length" value={metres(fiber.totals.mapMeters || fiber.totals.pathMeters)} />
              <Stat caption="Closures" value={fiber.totals.closureCount} />
              <Stat caption="Splitters" value={fiber.totals.splitterCount ?? 0} />
            </div>

            <FiberSchematic
              fiber={fiber}
              onNodeClick={(point) => onCentre?.(point)}
              onFiberLink={(id) => onSwap?.(id)}
            />

            <SegmentList segments={fiber.segments} points={fiber.points} />

            <DetailsBlock fiber={fiber} />

            <FiberActions fiber={fiber} canManage={canManage} onEdit={onEdit} />
          </>
        )}
      </div>
    </div>
  )
}
