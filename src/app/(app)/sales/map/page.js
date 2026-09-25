'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import { canAssignSalesBuildings, isSales } from '@/lib/roles'
import { useOpenVisit } from '@/hooks/useSales'
import { CheckInModal } from '@/components/sales/CheckInModal'
import { OpenVisitCard } from '@/components/sales/OpenVisitCard'
import { AssignToTeamModal } from '@/components/sales/AssignToTeamModal'

const BuildingsMap = dynamic(() => import('@/components/map/BuildingsMap'), { ssr: false })

/**
 * The field-sales map: every building the person may act on, as pins — no
 * search needed. A manager/admin sees the whole registry; a team leader /
 * executive only their assigned buildings. Tapping a pin works it in place:
 *  - assigned → check in (reuses the CheckInModal / open-visit flow);
 *  - unassigned (managers/admins only) → assign it to the team first.
 * One open visit at a time: while one is open, the map shows it and blocks a
 * second check-in.
 */
export default function SalesMapPage() {
  const role = useAuthStore((s) => s.user?.role)
  const canAct = isSales(role) || role === 'ADMIN'
  const canAssign = canAssignSalesBuildings(role)

  const [buildings, setBuildings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const [checkInFor, setCheckInFor] = useState(null)
  const [assignFor, setAssignFor] = useState(null)

  const { visit: openVisit, refresh: refreshOpen } = useOpenVisit(canAct)

  const load = useCallback(() => {
    setLoading(true)
    apiClient
      .get('/sales/map-buildings')
      .then((res) => {
        setBuildings(res.data.data)
        setLoading(false)
      })
      .catch((err) => {
        setError(getApiErrorMessage(err, 'Could not load the map'))
        setLoading(false)
      })
  }, [])
  useEffect(load, [load])

  function onSelect(building) {
    if (openVisit) {
      setToast('Finish your current visit — check out before starting another.')
      return
    }
    if (building.assigned) setCheckInFor(building)
    else if (canAssign) setAssignFor(building)
    else setToast('This building is not assigned to you yet.')
  }

  return (
    <div className="fixed inset-x-0 top-0 z-50 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] transition-[left] duration-300 lg:bottom-0 lg:left-[var(--sidebar-w)]">
      <BuildingsMap buildings={buildings} selectedId={checkInFor?.id ?? null} onSelect={onSelect} />

      {/* Title + hint */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-40 lg:inset-x-6 lg:top-6">
        <div className="inline-flex flex-col rounded-xl border border-line bg-card/95 px-4 py-2 shadow-md backdrop-blur">
          <span className="text-sm font-semibold text-ink">Field map</span>
          <span className="text-xs font-normal text-muted">
            {loading ? 'Loading buildings…' : `${buildings.length} building${buildings.length === 1 ? '' : 's'} · tap one to check in`}
          </span>
        </div>
      </div>

      {/* Toast / errors */}
      {(toast || error) && (
        <div className="absolute inset-x-3 top-20 z-40 mx-auto max-w-md lg:top-24">
          <div
            className={`flex items-center justify-between gap-3 rounded-btn px-4 py-3 text-sm font-medium shadow-md ${
              error ? 'bg-bad-tint text-bad' : 'bg-ok-tint text-ok'
            }`}
          >
            {error || toast}
            <button
              type="button"
              onClick={() => (error ? setError(null) : setToast(null))}
              className="text-xs font-medium underline-offset-2 hover:underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && buildings.length === 0 && (
        <div className="absolute inset-x-6 top-1/2 z-40 mx-auto max-w-sm -translate-y-1/2 rounded-card border border-line bg-card px-4 py-6 text-center text-sm text-muted shadow-md">
          No buildings assigned to you yet. Ask your manager to assign some.
        </div>
      )}

      {/* The open visit, over the map */}
      {canAct && openVisit && (
        <div className="absolute inset-x-3 bottom-3 z-40 mx-auto max-h-[70vh] max-w-md overflow-y-auto lg:inset-x-auto lg:right-6 lg:bottom-6">
          <OpenVisitCard visit={openVisit} onChanged={refreshOpen} />
        </div>
      )}

      {checkInFor && (
        <CheckInModal
          building={checkInFor}
          onClose={() => setCheckInFor(null)}
          onDone={() => {
            setToast(`Checked in to ${checkInFor.buildingName}`)
            setCheckInFor(null)
            refreshOpen()
          }}
        />
      )}

      {assignFor && (
        <AssignToTeamModal
          buildingIds={[assignFor.id]}
          onClose={() => setAssignFor(null)}
          onDone={({ count }) => {
            setToast(`${count} building${count === 1 ? '' : 's'} assigned`)
            setAssignFor(null)
            load() // the pin is now assigned — refresh so a tap checks in
          }}
        />
      )}
    </div>
  )
}
