'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useBuildings } from '@/hooks/useBuildings'
import { useCities } from '@/hooks/useCities'
import { useUsers } from '@/hooks/useUsers'
import { useAuthStore } from '@/stores/auth-store'
import { Select } from '@/components/ui/Input'
import { isLead, designationLabel } from '@/lib/roles'
import { IconSearch, IconBuildings } from '@/components/ui/icons'

// Same pooled map component the coverage map uses — one billable Google map
// load per tab session, kept alive across tab switches.
const BuildingsMap = dynamic(() => import('@/components/map/BuildingsMap'), { ssr: false })

/** Compact detail card for an acquisition building (contact person included). */
function AcquisitionCard({ building, onClose }) {
  if (!building) return null
  const contact = building.contact
  return (
    <div className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 rounded-2xl border border-line bg-card p-4 shadow-xl lg:bottom-6 lg:left-auto lg:right-6 lg:w-96">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">{building.buildingName}</p>
          <p className="truncate text-sm text-muted">{building.formattedAddress}</p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="p-1 text-faint transition-colors hover:text-ink"
        >
          ✕
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium">
        {building.pincode && (
          <span className="rounded-full bg-paper px-2.5 py-0.5 text-muted">{building.pincode}</span>
        )}
        {building.city?.name && (
          <span className="rounded-full bg-paper px-2.5 py-0.5 text-muted">
            {building.city.name}
          </span>
        )}
        {building.details?.homePass != null && (
          <span className="rounded-full bg-paper px-2.5 py-0.5 text-muted">
            {building.details.homePass} home pass
          </span>
        )}
      </div>

      {contact && (
        <div className="mt-3 rounded-btn bg-paper px-3 py-2">
          <p className="text-xs font-medium uppercase tracking-wide text-faint">Contact person</p>
          <p className="mt-0.5 text-sm font-medium">{contact.contactName}</p>
          <p className="text-xs text-muted">
            {contact.designation === 'OTHER'
              ? contact.designationOther
              : designationLabel(contact.designation)}
            {contact.contactPhone ? ` · ${contact.contactPhone}` : ''}
          </p>
          {contact.contactEmail && <p className="text-xs text-muted">{contact.contactEmail}</p>}
        </div>
      )}
    </div>
  )
}

/**
 * Map for the acquisition team. The API already scopes rows (agents see only
 * their own), so this only adds the lead's agent/city filters on top.
 */
export function AcquisitionMap() {
  const role = useAuthStore((s) => s.user?.role)
  const lead = isLead(role)
  const [agentId, setAgentId] = useState('')
  const [cityId, setCityId] = useState('')
  const [selected, setSelected] = useState(null)

  // Only leads may list users/cities — agents skip both requests entirely.
  const { users } = useUsers(lead)
  const { cities } = useCities()
  const agents = useMemo(
    () => users.filter((u) => u.role === 'ACQUISITION_AGENT'),
    [users],
  )

  const { buildings, loading } = useBuildings({
    pageSize: 500,
    createdById: lead && agentId ? agentId : undefined,
    cityId: cityId || undefined,
  })

  return (
    <div className="fixed inset-x-0 top-0 z-50 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] transition-[left] duration-300 lg:bottom-0 lg:left-[var(--sidebar-w)]">
      <BuildingsMap
        buildings={buildings}
        zones={[]}
        fiberRoutes={[]}
        selectedId={selected?.id}
        onSelect={setSelected}
      />

      {/* Filters (lead) / count pill (agent) */}
      <div className="absolute inset-x-3 top-3 z-40 flex flex-wrap gap-2 lg:inset-x-6 lg:top-6">
        {lead && (
          <>
            <div className="w-40 sm:w-52">
              <Select
                id="acq-map-agent"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
              >
                <option value="">All agents</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-36 sm:w-44">
              <Select id="acq-map-city" value={cityId} onChange={(e) => setCityId(e.target.value)}>
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
      </div>

      <p className="absolute left-1/2 top-[7.25rem] z-40 -translate-x-1/2 rounded-full border border-line bg-card px-4 py-1.5 font-mono text-[11px] uppercase tracking-wide text-muted shadow sm:top-20 lg:top-24">
        {loading
          ? 'Loading…'
          : `${buildings.length} building${buildings.length === 1 ? '' : 's'}${
              lead && agentId ? ' · filtered' : ''
            }`}
      </p>

      {!loading && buildings.length === 0 && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-40 w-64 -translate-x-1/2 -translate-y-1/2 rounded-card bg-card/95 p-5 text-center shadow-lift">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-fiber-tint text-fiber">
            <IconBuildings className="h-6 w-6" strokeWidth={1.8} />
          </span>
          <p className="mt-3 font-bold">Nothing logged yet</p>
          <p className="mt-1 text-sm font-normal text-muted">
            {lead
              ? 'Buildings your agents log will appear here.'
              : 'Buildings you log will appear here.'}
          </p>
        </div>
      )}

      <AcquisitionCard building={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
