'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { IconPin, IconBuildings, IconHome, IconCrosshair, IconTrash, IconChevronDown } from '@/components/ui/icons'
import { POINT_COLORS } from '@/lib/fiber/constants'

const CARD_WIDTH = 220
const CARD_MAX_HEIGHT = 320

/** Colour dot matching a point's marker colour — precedes every type item. */
function Dot({ type }) {
  return (
    <span
      className="h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: POINT_COLORS[type] }}
      aria-hidden="true"
    />
  )
}

function Row({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      className={`flex min-h-11 w-full items-center gap-2.5 rounded-btn px-3 py-2 text-left text-sm font-medium transition-colors ${
        active ? 'bg-fiber-tint text-fiber' : 'text-ink hover:bg-paper'
      }`}
    >
      {children}
    </button>
  )
}

/**
 * Per-vertex context menu for the fiber draw editor: pick the point's type
 * (Waypoint / POP / Closure / Building) or remove it. Absolutely positioned
 * at `at` (container pixels) by the caller's overlay; closes on outside
 * click and Escape.
 */
export default function PointMenu({ point, at, bounds, pops, nearbyBuildings, onChoose, onRemove, onClose }) {
  const [section, setSection] = useState(null) // null | 'pop' | 'building'
  const [addingPop, setAddingPop] = useState(false)
  const [newPopName, setNewPopName] = useState('')
  const rootRef = useRef(null)

  useEffect(() => {
    function onDocClick(e) {
      if (!rootRef.current?.contains(e.target)) onClose()
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  function choosePop(pop) {
    onChoose('POP', { popId: pop.id, name: pop.name }, { latitude: pop.latitude, longitude: pop.longitude })
    onClose()
  }

  function addNewPop() {
    const name = newPopName.trim()
    if (!name) return
    onChoose('POP', { newPop: { name } })
    onClose()
  }

  function chooseBuilding(building) {
    onChoose(
      'BUILDING',
      { buildingId: building.id, name: building.label },
      { latitude: building.latitude, longitude: building.longitude }
    )
    onClose()
  }

  function chooseClosure() {
    onChoose('CLOSURE', { newClosure: { kind: null } })
    onClose()
  }

  function chooseWaypoint() {
    onChoose('WAYPOINT', null)
    onClose()
  }

  function removePoint() {
    onRemove()
    onClose()
  }

  const left = bounds ? Math.max(8, Math.min(at.x, bounds.width - (CARD_WIDTH + 12))) : at.x
  const top = bounds?.height
    ? Math.max(8, Math.min(at.y, bounds.height - CARD_MAX_HEIGHT - 8))
    : at.y

  return (
    <div
      ref={rootRef}
      role="menu"
      style={{ left, top, width: CARD_WIDTH }}
      className="absolute z-30 flex max-h-[320px] flex-col gap-0.5 overflow-y-auto rounded-card border border-line bg-card p-1.5 shadow-lift"
    >
      <Row active={point.type === 'WAYPOINT'} onClick={chooseWaypoint}>
        <Dot type="WAYPOINT" />
        <IconCrosshair className="h-4 w-4 text-muted" />
        Waypoint
      </Row>

      <Row active={point.type === 'POP'} onClick={() => setSection(section === 'pop' ? null : 'pop')}>
        <Dot type="POP" />
        <IconPin className="h-4 w-4 text-muted" />
        <span className="flex-1">POP</span>
        <IconChevronDown
          className={`h-4 w-4 shrink-0 text-faint transition-transform ${section === 'pop' ? 'rotate-180' : ''}`}
        />
      </Row>
      {section === 'pop' && (
        <div className="ml-4 flex flex-col gap-0.5 border-l border-line/60 pl-2">
          {pops.map((pop) => (
            <Row key={pop.id} active={point.ref?.popId === pop.id} onClick={() => choosePop(pop)}>
              <span className="truncate">{pop.name}</span>
            </Row>
          ))}
          {!addingPop && (
            <Row onClick={() => setAddingPop(true)}>
              <span className="text-muted">New POP…</span>
            </Row>
          )}
          {addingPop && (
            <div className="flex flex-col gap-2 px-1 py-1.5">
              <Input
                id="point-menu-new-pop-name"
                autoFocus
                placeholder="POP name"
                value={newPopName}
                onChange={(e) => setNewPopName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addNewPop()
                }}
              />
              <Button
                type="button"
                variant="primary"
                fullWidth
                disabled={!newPopName.trim()}
                onClick={addNewPop}
              >
                Add
              </Button>
            </div>
          )}
        </div>
      )}

      <Row active={point.type === 'CLOSURE'} onClick={chooseClosure}>
        <Dot type="CLOSURE" />
        Closure
      </Row>

      <Row
        active={point.type === 'BUILDING'}
        onClick={() => setSection(section === 'building' ? null : 'building')}
      >
        <Dot type="BUILDING" />
        <IconBuildings className="h-4 w-4 text-muted" />
        <span className="flex-1">Building</span>
        <IconChevronDown
          className={`h-4 w-4 shrink-0 text-faint transition-transform ${section === 'building' ? 'rotate-180' : ''}`}
        />
      </Row>
      {section === 'building' && (
        <div className="ml-4 flex flex-col gap-0.5 border-l border-line/60 pl-2">
          {nearbyBuildings.length === 0 && (
            <p className="px-2 py-1.5 text-xs font-normal text-faint">No building within 50 m</p>
          )}
          {nearbyBuildings.map((building) => (
            <Row
              key={building.id}
              active={point.ref?.buildingId === building.id}
              onClick={() => chooseBuilding(building)}
            >
              <IconHome className="h-4 w-4 shrink-0 text-muted" />
              <span className="truncate">{building.label}</span>
            </Row>
          ))}
        </div>
      )}

      <div className="my-1 border-t border-line/60" />

      <Row onClick={removePoint}>
        <IconTrash className="h-4 w-4 shrink-0 text-bad" />
        <span className="text-bad">Remove point</span>
      </Row>
    </div>
  )
}
