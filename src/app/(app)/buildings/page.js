'use client'

import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useBuildings } from '@/hooks/useBuildings'
import { useOperators } from '@/hooks/useOperators'
import { useCities } from '@/hooks/useCities'
import { useAuthStore } from '@/stores/auth-store'
import { BuildingCard, BuildingCardSkeleton } from '@/components/buildings/BuildingCard'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Input'
import { DataTable } from '@/components/ui/DataTable'
import { Fab } from '@/components/ui/Fab'
import { IconPlus, IconSearch, IconBuildings, IconUpload } from '@/components/ui/icons'
import { ImportBuildingsModal } from '@/components/buildings/ImportBuildingsModal'
import { invalidateZones } from '@/hooks/useZones'
import { invalidateOperators } from '@/hooks/useOperators'
import { isAgent, isLead, isAcquisition, designationLabel } from '@/lib/roles'
import { useUsers } from '@/hooks/useUsers'

const SEARCH_DEBOUNCE_MS = 350

const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' })

const COLUMNS = [
  {
    key: 'buildingName',
    header: 'Building',
    // Cap the width so long addresses truncate instead of widening the table
    // (which pushed the Added column into a horizontal scroll).
    className: 'max-w-[460px]',
    render: (b) => (
      <div className="min-w-0 max-w-[460px]">
        <p className="truncate font-bold">{b.buildingName}</p>
        <p className="truncate text-xs font-normal text-muted">{b.formattedAddress}</p>
      </div>
    ),
  },
  {
    key: 'zone',
    header: 'Zone',
    render: (b) => <span className="line-clamp-2">{b.zone?.name ?? '—'}</span>,
    className: 'max-w-[160px] text-muted',
  },
  {
    key: 'homePass',
    header: 'Home pass',
    render: (b) => b.details?.homePass ?? '—',
    className: 'tabular-nums text-muted',
  },
  {
    key: 'createdAt',
    header: 'Added',
    render: (b) => dateFormat.format(new Date(b.createdAt)),
    className: 'tabular-nums text-muted',
  },
]

// Acquisition rows carry a contact person + pincode instead of a zone.
const ACQUISITION_COLUMNS = [
  {
    key: 'buildingName',
    header: 'Building',
    className: 'max-w-[380px]',
    render: (b) => (
      <div className="min-w-0 max-w-[380px]">
        <p className="truncate font-bold">{b.buildingName}</p>
        <p className="truncate text-xs font-normal text-muted">{b.formattedAddress}</p>
      </div>
    ),
  },
  {
    key: 'contact',
    header: 'Contact person',
    render: (b) =>
      b.contact ? (
        <div className="min-w-0">
          <p className="truncate">{b.contact.contactName}</p>
          <p className="truncate text-xs text-muted">
            {b.contact.designation === 'OTHER'
              ? b.contact.designationOther
              : designationLabel(b.contact.designation)}
            {b.contact.contactPhone ? ` · ${b.contact.contactPhone}` : ''}
          </p>
        </div>
      ) : (
        '—'
      ),
    className: 'max-w-[220px]',
  },
  {
    key: 'pincode',
    header: 'Pincode',
    render: (b) => b.pincode ?? '—',
    className: 'tabular-nums text-muted',
  },
  {
    key: 'createdAt',
    header: 'Added',
    render: (b) => dateFormat.format(new Date(b.createdAt)),
    className: 'tabular-nums text-muted',
  },
]

// Leads also see WHO logged each building.
const AGENT_COLUMN = {
  key: 'agent',
  header: 'Agent',
  render: (b) => b.createdBy?.name ?? '—',
  className: 'max-w-[160px] text-muted',
}
const LEAD_COLUMNS = [
  ...ACQUISITION_COLUMNS.slice(0, 2),
  AGENT_COLUMN,
  ...ACQUISITION_COLUMNS.slice(2),
]

function BuildingsList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const operatorId = searchParams.get('operatorId') ?? ''
  const cityId = searchParams.get('cityId') ?? ''
  const role = useAuthStore((s) => s.user?.role)
  const acquisition = isAcquisition(role)
  const agentFilter = searchParams.get('createdById') ?? ''
  // Only admins/managers can list operators/cities (both APIs are role-gated).
  const canFilterOperator = role === 'ADMIN' || role === 'MANAGER'
  const { operators } = useOperators()
  const { cities } = useCities()
  // Leads filter their team's registry by agent and city.
  const { users } = useUsers(isLead(role))
  const agents = users.filter((u) => u.role === 'ACQUISITION_AGENT')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // Server-side search: debounce keystrokes, reset to page 1 on a new query.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search])

  const [importOpen, setImportOpen] = useState(false)
  const { buildings, pagination, loading, refetch } = useBuildings({
    search: debouncedSearch || undefined,
    operatorId: operatorId || undefined,
    cityId: cityId || undefined,
    createdById: agentFilter || undefined,
    page,
    pageSize,
  })

  const applyFilters = (nextCityId, nextOperatorId) => {
    setPage(1)
    const params = new URLSearchParams()
    if (nextCityId) params.set('cityId', nextCityId)
    if (nextOperatorId) params.set('operatorId', nextOperatorId)
    const qs = params.toString()
    router.replace(qs ? `/buildings?${qs}` : '/buildings')
  }
  // Changing city resets the operator unless it belongs to the new city.
  const setCity = (id) => {
    const operatorStillValid =
      operatorId && operators.some((o) => o.id === operatorId && (!id || o.city?.id === id))
    applyFilters(id, operatorStillValid ? operatorId : '')
  }
  const setOperator = (id) => applyFilters(cityId, id)
  // Acquisition filters keep both params in the URL so the view is shareable.
  const applyAcquisitionFilters = (nextAgentId, nextCityId) => {
    setPage(1)
    const params = new URLSearchParams()
    if (nextAgentId) params.set('createdById', nextAgentId)
    if (nextCityId) params.set('cityId', nextCityId)
    const qs = params.toString()
    router.replace(qs ? `/buildings?${qs}` : '/buildings')
  }
  const visibleOperators = cityId ? operators.filter((o) => o.city?.id === cityId) : operators

  const emptyState = (
    <div className="flex flex-col items-center rounded-card bg-card px-6 py-16 text-center shadow-soft">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-fiber-tint text-fiber">
        <IconBuildings className="h-7 w-7" strokeWidth={1.8} />
      </span>
      <p className="mt-4 font-bold">
        {debouncedSearch
          ? 'No buildings match your search'
          : isLead(role)
            ? 'Your team hasn’t logged anything yet'
            : acquisition
              ? 'You haven’t logged any buildings yet'
              : 'No buildings surveyed'}
      </p>
      <p className="mt-1 max-w-xs text-sm font-normal text-muted">
        {debouncedSearch
          ? 'Try a different name, address or zone.'
          : isLead(role)
            ? agentFilter || cityId
              ? 'Nothing matches these filters — try clearing them.'
              : 'Buildings your agents log will appear here.'
            : 'Capture your first building from its entrance to start the registry.'}
      </p>
      {!debouncedSearch && (
        <Link
          href="/buildings/add"
          className="mt-5 inline-flex h-12 items-center gap-2 rounded-btn bg-fiber px-5 text-sm font-medium text-white transition-colors duration-200 hover:bg-fiber-deep"
        >
          <IconPlus className="h-4.5 w-4.5" />
          Add building
        </Link>
      )}
    </div>
  )

  return (
    <main>
      <PageHeader
        title={isAgent(role) ? 'My buildings' : 'Buildings'}
        sub={
          pagination
            ? `${pagination.total} ${acquisition ? 'logged' : 'surveyed'}`
            : 'Loading…'
        }
        action={
          <div className="hidden items-center gap-2 lg:flex">
            {role === 'ADMIN' && !acquisition && (
              <button
                onClick={() => setImportOpen(true)}
                className="inline-flex h-12 items-center gap-2 rounded-btn border border-line bg-card px-4 text-sm font-medium transition-colors hover:border-fiber/50"
              >
                <IconUpload className="h-4.5 w-4.5" />
                Bulk upload
              </button>
            )}
            {!isLead(role) && (
              <Link
                href="/buildings/add"
                className="inline-flex h-12 items-center gap-2 rounded-btn bg-fiber px-5 text-sm font-medium text-white transition-colors duration-200 hover:bg-fiber-deep"
              >
                <IconPlus className="h-4.5 w-4.5" />
                Add building
              </Link>
            )}
          </div>
        }
      />

      {/* Sticky search + operator filter */}
      <div className="sticky top-0 z-30 -mx-4 mb-5 flex items-center gap-3 bg-paper/80 px-4 py-2 backdrop-blur-md lg:static lg:mx-0 lg:mb-5 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <div className="relative flex-1 lg:max-w-md">
          <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search building..."
            className="h-12 w-full rounded-full border border-line bg-card pl-11 pr-4 text-[15px] shadow-soft outline-none transition-shadow duration-200 placeholder:text-faint focus:border-fiber focus:ring-2 focus:ring-fiber/15"
          />
        </div>
        {isLead(role) && (
          <>
            <div className="w-40 shrink-0 sm:w-52 lg:ml-auto">
              <Select
                id="buildings-agent"
                value={agentFilter}
                onChange={(e) => applyAcquisitionFilters(e.target.value, cityId)}
              >
                <option value="">All agents</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-36 shrink-0 sm:w-44">
              <Select
                id="buildings-acq-city"
                value={cityId}
                onChange={(e) => applyAcquisitionFilters(agentFilter, e.target.value)}
              >
                <option value="">All cities</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          </>
        )}
        {!acquisition && canFilterOperator && cities.length > 0 && (
          <div className="w-36 shrink-0 sm:w-44 lg:ml-auto">
            <Select id="buildings-city" value={cityId} onChange={(e) => setCity(e.target.value)}>
              <option value="">All cities</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        {!acquisition && canFilterOperator && operators.length > 0 && (
          <div className={`w-44 shrink-0 sm:w-56 ${cities.length > 0 ? '' : 'lg:ml-auto'}`}>
            <Select
              id="buildings-operator"
              value={operatorId}
              onChange={(e) => setOperator(e.target.value)}
            >
              <option value="">All operators</option>
              {visibleOperators.map((operator) => (
                <option key={operator.id} value={operator.id}>
                  {operator.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <DataTable
        columns={isLead(role) ? LEAD_COLUMNS : acquisition ? ACQUISITION_COLUMNS : COLUMNS}
        rows={loading ? null : buildings}
        loading={loading}
        renderCard={(building) => <BuildingCard building={building} />}
        renderCardSkeleton={() => <BuildingCardSkeleton />}
        onRowClick={(building) => router.push(`/buildings/${building.id}`)}
        emptyState={emptyState}
        pageSize={pageSize}
        onPageSizeChange={(size) => {
          setPageSize(size)
          setPage(1)
        }}
        pagination={pagination}
        onPageChange={setPage}
      />

      {importOpen && (
        <ImportBuildingsModal
          onClose={() => setImportOpen(false)}
          onImported={() => {
            // The import may have created new zones/operators.
            invalidateZones()
            invalidateOperators()
            refetch()
          }}
        />
      )}

      {!isLead(role) && <Fab href="/buildings/add" label="Add building" />}
    </main>
  )
}

// useSearchParams must sit inside a Suspense boundary in the App Router.
export default function BuildingsPage() {
  return (
    <Suspense fallback={null}>
      <BuildingsList />
    </Suspense>
  )
}
