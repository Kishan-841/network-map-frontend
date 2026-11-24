'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useClosures } from '@/hooks/useClosures'
import { closureKindLabel } from '@/lib/fiber/constants'
import { matchClosures } from '@/lib/fiber/closure-pick'
import SplitterForm from '@/components/fiber/SplitterForm'
import BuildingSearch from '@/components/fiber/BuildingSearch'
import { IconBuildings, IconDiamond } from '@/components/ui/icons'

// Same picker the closure form uses (Google only).
const GoogleLocationPicker = dynamic(() => import('@/components/map/google/GoogleLocationPicker'), { ssr: false })

/** One big choice button on the "Where is it?" step. */
function WhereChoice({ icon: Icon, title, sub, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-16 flex-1 items-center gap-3 rounded-card border border-line bg-card p-4 text-left transition-colors hover:border-fiber/50 hover:bg-paper"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-fiber-tint text-fiber">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="block text-xs font-normal text-muted">{sub}</span>
      </span>
    </button>
  )
}

/**
 * In a building (spec 2026-11-24-splitter-in-building): find the building
 * (debounced search) → click the map where the splitter is → the splitter form
 * with wing, where in the building and a note.
 */
function BuildingSplitter({ onSaved, onCancel, onBack }) {
  const [picked, setPicked] = useState(null) // the list row
  const [detail, setDetail] = useState({ id: null, building: null, error: null })
  const [pin, setPin] = useState(null)

  useEffect(() => {
    if (!picked) return undefined
    let alive = true
    apiClient
      .get(`/buildings/${picked.id}`)
      .then((res) => alive && setDetail({ id: picked.id, building: res.data.data, error: null }))
      .catch((err) => alive && setDetail({ id: picked.id, building: null, error: getApiErrorMessage(err) }))
    return () => {
      alive = false
    }
  }, [picked])

  if (!picked) {
    return (
      <>
        <BuildingSearch autoFocus onPick={(b) => { setPicked(b); setPin(null) }} />
        <div className="flex gap-2">
          <Button type="button" variant="ghost" className="h-11 min-h-11" onClick={onBack}>
            Back
          </Button>
          <Button type="button" variant="ghost" className="h-11 min-h-11" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </>
    )
  }

  const ready = detail.id === picked.id
  const building = ready ? detail.building : null
  const wings = (building?.wings ?? []).filter((w) => w.latitude != null && w.longitude != null)
  const marks = building
    ? [
        { latitude: building.latitude, longitude: building.longitude, label: building.buildingName },
        ...wings.map((w) => ({ latitude: w.latitude, longitude: w.longitude, label: `Wing ${w.name}`, short: w.name.slice(0, 2) })),
      ]
    : []
  const where = pin ?? (building ? { latitude: building.latitude, longitude: building.longitude } : null)

  return (
    <>
      <div className="flex items-center justify-between gap-3 rounded-btn bg-paper px-3 py-2">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-faint">Building</p>
          <p className="truncate text-sm font-bold text-ink">{picked.buildingName}</p>
        </div>
        <Button type="button" variant="ghost" className="h-11 min-h-11" onClick={() => setPicked(null)}>
          Change
        </Button>
      </div>
      {!ready ? (
        <p className="text-sm font-normal text-muted">Loading the building…</p>
      ) : detail.error ? (
        <p className="rounded-btn bg-bad-tint p-3 text-sm font-medium text-bad">{detail.error}</p>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium text-ink">Where exactly is it?</p>
            <p className="text-xs font-normal text-muted">
              {pin ? 'Pin placed — click again or drag it to adjust.' : 'Click on the map where the splitter is.'}
              {wings.length > 0 ? ' Grey dots are the building and its wings.' : ' The grey dot is the building.'}
            </p>
            <GoogleLocationPicker
              key={building.id}
              latitude={where.latitude}
              longitude={where.longitude}
              onChange={setPin}
              clickToPlace
              marks={marks}
              className="h-72 sm:h-80"
            />
          </div>
          {pin ? (
            <SplitterForm key={building.id} building={building} pin={pin} onSaved={onSaved} onCancel={onCancel} />
          ) : (
            <div className="flex gap-2">
              <Button type="button" variant="ghost" className="h-11 min-h-11" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          )}
        </>
      )}
    </>
  )
}

/**
 * "New splitter" from the Splitters page: first "Where is it?" — in a building
 * (find it, pin it on the map, then the form) or in a closure (find the
 * closure; the splitter takes its position — the same form the closure's own
 * drawer uses). A splitter placed straight on a line is still drawn in the
 * fiber editor.
 */
export default function NewSplitterPanel({ onSaved, onCancel }) {
  const [where, setWhere] = useState(null) // null | 'building' | 'closure'
  return (
    <div className="flex flex-col gap-4 rounded-card bg-card p-5 shadow-soft">
      {where === null && (
        <>
          <p className="text-sm font-semibold text-ink">Where is the splitter?</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <WhereChoice
              icon={IconBuildings}
              title="In a building"
              sub="Find the building, then pin the exact spot"
              onClick={() => setWhere('building')}
            />
            <WhereChoice
              icon={IconDiamond}
              title="In a closure"
              sub="It takes the closure's position"
              onClick={() => setWhere('closure')}
            />
          </div>
          <div>
            <Button type="button" variant="ghost" className="h-11 min-h-11" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </>
      )}
      {where === 'building' && <BuildingSplitter onSaved={onSaved} onCancel={onCancel} onBack={() => setWhere(null)} />}
      {where === 'closure' && <ClosureSplitter onSaved={onSaved} onCancel={onCancel} />}
    </div>
  )
}

/** In a closure: today's flow, unchanged. */
function ClosureSplitter({ onSaved, onCancel }) {
  const { closures, loading } = useClosures()
  const [query, setQuery] = useState('')
  const [closure, setClosure] = useState(null)
  // The chosen closure's fibers (to offer the one feeding the splitter).
  const [detail, setDetail] = useState({ id: null, fibers: null, error: null })

  const matches = useMemo(() => matchClosures(closures, query), [closures, query])

  useEffect(() => {
    if (!closure) return
    let cancelled = false
    apiClient
      .get(`/closures/${closure.id}`)
      .then((res) => !cancelled && setDetail({ id: closure.id, fibers: res.data.data.fibers ?? [], error: null }))
      .catch((err) => !cancelled && setDetail({ id: closure.id, fibers: null, error: getApiErrorMessage(err) }))
    return () => {
      cancelled = true
    }
  }, [closure])

  const ready = closure && detail.id === closure.id
  const endingFibers = (ready && detail.fibers ? detail.fibers : [])
    .filter((f) => f.role === 'in')
    .map((f) => ({ id: f.id, name: f.name }))

  return (
    <>
      {!closure ? (
        <>
          <Input
            id="new-splitter-closure"
            label="Which closure is it in?"
            placeholder="Type a closure code (e.g. JC-0012) or building"
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
          />
          {query.trim() && (
            <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-btn border border-line">
              {matches.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setClosure(c)}
                    className="flex min-h-11 w-full flex-col items-start px-3 py-2 text-left transition-colors hover:bg-paper"
                  >
                    <span className="font-mono text-sm font-bold text-ink">{c.code}</span>
                    <span className="text-xs font-normal text-muted">
                      {closureKindLabel(c.kind) || 'No kind'} · {c.building?.buildingName ?? 'No building'}
                      {c.splitters?.length ? ` · ${c.splitters.length} splitter${c.splitters.length === 1 ? '' : 's'}` : ''}
                    </span>
                  </button>
                </li>
              ))}
              {!matches.length && (
                <li className="px-3 py-3 text-sm font-normal text-muted">
                  {loading ? 'Loading closures…' : 'No closure matches that.'}
                </li>
              )}
            </ul>
          )}
          <div>
            <Button type="button" variant="ghost" className="h-11 min-h-11" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 rounded-btn bg-paper px-3 py-2">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-faint">Closure</p>
              <p className="truncate text-sm font-bold text-ink">
                <span className="font-mono">{closure.code}</span>
                {closure.building?.buildingName ? ` · ${closure.building.buildingName}` : ''}
              </p>
            </div>
            <Button type="button" variant="ghost" className="h-11 min-h-11" onClick={() => setClosure(null)}>
              Change
            </Button>
          </div>
          {!ready ? (
            <p className="text-sm font-normal text-muted">Loading the closure…</p>
          ) : detail.error ? (
            <p className="rounded-btn bg-bad-tint p-3 text-sm font-medium text-bad">{detail.error}</p>
          ) : (
            <SplitterForm key={closure.id} closureId={closure.id} endingFibers={endingFibers} onSaved={onSaved} onCancel={onCancel} />
          )}
        </>
      )}
    </>
  )
}
