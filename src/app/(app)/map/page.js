'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useBuildingMarkers } from '@/hooks/useBuildingMarkers'
import { filterMarkers } from '@/lib/building-filters'
import { useZones } from '@/hooks/useZones'
import { useFibers } from '@/hooks/useFibers'
import { usePops } from '@/hooks/usePops'
import { useAuthStore } from '@/stores/auth-store'
import { canManageFiber, isAcquisition } from '@/lib/roles'
import { AcquisitionMap } from '@/components/map/AcquisitionMap'
import { FilterSheet } from '@/components/map/FilterSheet'
import { SelectedBuildingCard } from '@/components/map/SelectedBuildingCard'
import { useDetailStack } from '@/components/fiber/details/useDetailStack'
import { MapLegend } from '@/components/map/MapLegend'
import { Fab } from '@/components/ui/Fab'
import { IconSearch } from '@/components/ui/icons'

const BuildingsMap = dynamic(() => import('@/components/map/BuildingsMap'), { ssr: false })
// Client-only, and only ever mounted once something on the map is clicked.
const DetailDrawer = dynamic(() => import('@/components/fiber/details/DetailDrawer'), { ssr: false })

// The fiber overlay rebuilds whenever this array changes identity — one stable
// empty array for "hidden" keeps a toggled-off layer from rebuilding forever.
const NO_FIBERS = []
const NO_POPS = []

export default function MapPage() {
  const role = useAuthStore((s) => s.user?.role)
  // The acquisition team gets their own map: their buildings, no coverage
  // zones/fiber/operators.
  if (isAcquisition(role)) return <AcquisitionMap />
  return <CoverageMapPage />
}

function CoverageMapPage() {
  const router = useRouter()
  const role = useAuthStore((s) => s.user?.role)
  const user = useAuthStore((s) => s.user)
  const readOnlyFiber = !canManageFiber(user)
  const [filters, setFilters] = useState({})
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // One API call per pause in typing — not one per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => clearTimeout(timer)
  }, [search])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  // Legend-driven declutter toggles.
  const [buildingsShown, setBuildingsShown] = useState(true)
  const [zonesShown, setZonesShown] = useState(true)
  const [liveShown, setLiveShown] = useState(true)
  const [notLiveShown, setNotLiveShown] = useState(true)
  // Fiber layer is lazy: nothing is fetched until first toggled on. The
  // operator and zone filters scope it the way they scope buildings — filter
  // to a zone and you see that zone's cables, not every cable in the city.
  // A fiber with no zone (drawn before fibers recorded one) drops out of a
  // zone-filtered view rather than pretending to belong.
  const [fiberShown, setFiberShown] = useState(false)
  const { fibers } = useFibers(fiberShown)
  const visibleFibers = useMemo(() => {
    if (!fiberShown) return NO_FIBERS
    const shown = fibers.filter(
      (fiber) =>
        (!filters.operatorId || fiber.operatorId === filters.operatorId) &&
        (!filters.zoneId || fiber.zoneId === filters.zoneId),
    )
    // `fibers` is a fresh [] on every render until the fetch lands — map any
    // empty result onto the stable array so the overlay never rebuilds.
    return shown.length > 0 ? shown : NO_FIBERS
  }, [fiberShown, fibers, filters.operatorId, filters.zoneId])

  // POPs are few and are landmarks, so their layer starts ON (unlike Fiber).
  const [popsShown, setPopsShown] = useState(true)
  const { pops } = usePops()
  const popCount = pops?.length ?? 0
  const visiblePops = popsShown && popCount > 0 ? pops : NO_POPS
  // A POP, fiber or closure clicked on the map opens in the right-hand drawer; a
  // building keeps its own bottom card. One or the other, never both.
  const details = useDetailStack()
  // Filled by the map once it is live: centre the view on one point.
  const centreRef = useRef(null)

  // Every building in scope, fetched once per session — the map is not a page
  // of results. Reading the paginated list at pageSize=500 is what capped it.
  const { markers, loading } = useBuildingMarkers()
  // Filtering happens here rather than on the server: the whole set is already
  // in memory, so a filter change is instant and costs no request.
  const buildings = useMemo(
    () => filterMarkers(markers, { ...filters, search: debouncedSearch }),
    [markers, filters, debouncedSearch],
  )
  const { zones } = useZones()
  const activeFilterCount = Object.values(filters).filter(Boolean).length

  // The Buildings row is the master switch; Live / Not live filter within it.
  const visibleBuildings = buildingsShown
    ? buildings.filter((b) => (b.isLive ? liveShown : notLiveShown))
    : []

  return (
    // z-50 lifts the page's own stacking context above the z-40 bottom nav —
    // fixed ancestors cap children's z-index, so the legend sheet/backdrop
    // could never cover the nav from inside without it.
    <div className="fixed inset-x-0 top-0 z-50 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] transition-[left] duration-300 lg:bottom-0 lg:left-[var(--sidebar-w)]">
      <BuildingsMap
        buildings={visibleBuildings}
        zones={zonesShown ? zones : []}
        fibers={visibleFibers}
        pops={visiblePops}
        selectedId={selected?.id}
        onSelect={(building) => {
          details.close()
          setSelected(building)
        }}
        onPopSelect={(pop) => {
          setSelected(null)
          details.open('pop', pop.id)
        }}
        onFiberSelect={(id) => {
          setSelected(null)
          details.open('fiber', id)
        }}
        onClosureSelect={(id) => {
          setSelected(null)
          details.open('closure', id)
        }}
        centreRef={centreRef}
      />

      <div className="absolute inset-x-3 top-3 z-40 flex gap-2 lg:inset-x-6 lg:top-6">
        <div className="relative flex-1 lg:max-w-md">
          <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search building, address, zone…"
            className="min-h-12 w-full rounded-xl border border-line bg-card pl-11 pr-4 text-base shadow-md outline-none focus:ring-2 focus:ring-fiber/30"
          />
        </div>
        <button
          onClick={() => setFiltersOpen(true)}
          className="relative min-h-12 rounded-xl border border-line bg-card px-4 font-medium shadow-md transition-colors active:bg-paper"
        >
          Filters
          {activeFilterCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-fiber text-xs font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Sits BELOW the map-style switcher on mobile — on one row they collide. */}
      <p className="absolute left-1/2 top-[7.25rem] z-40 -translate-x-1/2 rounded-full border border-line bg-card px-4 py-1.5 font-mono text-[11px] uppercase tracking-wide text-muted shadow sm:top-20 lg:top-24">
        {loading
          ? 'Loading…'
          : `${visibleBuildings.length} building${visibleBuildings.length === 1 ? '' : 's'}${
              zonesShown && zones.length ? ` · ${zones.length} zones` : ''
            }`}
      </p>

      <MapLegend
        buildingCount={buildings.length}
        liveCount={buildings.filter((b) => b.isLive).length}
        notLiveCount={buildings.filter((b) => !b.isLive).length}
        buildingsShown={buildingsShown}
        onToggleBuildings={() => setBuildingsShown((v) => !v)}
        zonesShown={zonesShown}
        zoneCount={zones.length}
        onToggleZones={() => setZonesShown((v) => !v)}
        liveShown={liveShown}
        onToggleLive={() => setLiveShown((v) => !v)}
        notLiveShown={notLiveShown}
        onToggleNotLive={() => setNotLiveShown((v) => !v)}
        fiberShown={fiberShown}
        fiberCount={visibleFibers.length}
        onToggleFiber={() => setFiberShown((v) => !v)}
        popsShown={popsShown}
        popCount={popCount}
        onTogglePops={() => setPopsShown((v) => !v)}
      />

      <DetailDrawer
        stack={details.stack}
        readOnly={readOnlyFiber}
        onOpen={details.push}
        onBack={details.back}
        onClose={details.close}
        onCentre={(point) => centreRef.current?.(point)}
        onEditFiber={(fiber) => router.push(`/admin/fiber?edit=${fiber.id}`)}
        onEditPop={(pop) => router.push(`/admin/pops?edit=${pop.id}`)}
      />

      <SelectedBuildingCard building={selected} onClose={() => setSelected(null)} />
      <FilterSheet
        open={filtersOpen}
        filters={filters}
        onApply={setFilters}
        onClose={() => setFiltersOpen(false)}
      />
      {!selected && !details.current && <Fab href="/buildings/add" label="Add Building" />}
    </div>
  )
}
