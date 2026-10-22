'use client'

import { use, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { invalidateBuildingMarkers } from '@/hooks/useBuildingMarkers'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { IconPin, IconNavigate, IconArrowLeft } from '@/components/ui/icons'
import { PhotoManager } from '@/components/buildings/PhotoManager'
import { LiveToggle } from '@/components/buildings/LiveToggle'
import { EditBuildingModal } from '@/components/buildings/EditBuildingModal'
import { WingsSection } from '@/components/buildings/WingsSection'
import { wingSummary } from '@/lib/building-wings'
import { LocateWingsModal } from '@/components/buildings/LocateWingsModal'
import { Button } from '@/components/ui/Button'
import { IconEdit, IconTrash } from '@/components/ui/icons'
import { useAuthStore } from '@/stores/auth-store'
import { canEditBuilding, canLocateWings, canManageBuildings } from '@/lib/roles'
import { isSociety } from '@/lib/society'
import { SocietyBadge } from '@/components/societies/SocietyBadge'
import Link from 'next/link'
import { CustomersLink, CustomersStat, useCustomerSummary } from '@/components/customers/CustomersLink'

/** Card section of label/value rows. Hides rows without values, and itself when empty. */
function Section({ title, rows }) {
  const visible = rows.filter(([, value]) => value != null && value !== '')
  if (visible.length === 0) return null
  return (
    <section className="mt-5">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">{title}</p>
      <div className="rounded-card bg-card px-5 py-2 shadow-soft">
        {visible.map(([label, value], i) => (
          <div
            key={label}
            className={`flex items-baseline justify-between gap-4 py-3 ${
              i > 0 ? 'border-t border-line/60' : ''
            }`}
          >
            <span className="shrink-0 text-sm font-normal text-muted">{label}</span>
            <span className="text-right text-sm font-medium">{value}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

/** Laptop stat tile: label, big value, small line. A missing value shows "—", never collapses. */
function Stat({ label, value, sub }) {
  return (
    <div className="min-w-0 rounded-card bg-card p-5 shadow-soft">
      <p className="text-xs font-medium uppercase tracking-wide text-faint">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value == null || value === '' ? '—' : value}</p>
      <p className="mt-0.5 min-h-4 truncate text-xs text-muted">{sub}</p>
    </div>
  )
}

/** Laptop Details card: groups of label/value rows in two columns; empty rows and groups are omitted. */
function DetailsCard({ groups }) {
  const shown = groups
    .map((g) => ({ ...g, rows: g.rows.filter(([, v]) => v != null && v !== '') }))
    .filter((g) => g.rows.length > 0)
  if (shown.length === 0) return null
  return (
    <section className="rounded-card bg-card p-5 shadow-soft">
      <p className="text-xs font-medium uppercase tracking-wide text-faint">Details</p>
      {shown.map((g, i) => (
        <div key={g.title} className={i === 0 ? 'mt-3' : 'mt-4 border-t border-line/60 pt-4'}>
          <p className="mb-2 text-xs font-medium text-muted">{g.title}</p>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3">
            {g.rows.map(([label, value, wide]) => (
              <div key={label} className={`min-w-0 ${wide ? 'col-span-2' : ''}`}>
                <dt className="text-xs font-normal text-muted">{label}</dt>
                <dd className="mt-0.5 break-words text-sm font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </section>
  )
}

export default function BuildingDetailPage({ params }) {
  const { id } = use(params)
  const user = useAuthStore((s) => s.user)
  const role = user?.role
  const isAdmin = role === 'ADMIN'
  const router = useRouter()
  const [building, setBuilding] = useState(null)
  const [error, setError] = useState(null)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  // The add-building flow lands here with ?locateWings=1 to place the wings.
  const wantsLocate = useSearchParams().get('locateWings') === '1'
  const [locating, setLocating] = useState(wantsLocate)
  // Depends on the building too: a granted surveyor edits only what they
  // logged, so this is false until the row has loaded.
  const canEdit = canEditBuilding(user, building)
  // Wings: editors, and the surveyor who added the building (tick or not).
  const canLocate = canLocateWings(user, building)
  // A surveyor's grant covers the building's own details, never the legal
  // permission record or the live flag — the API refuses those outright.
  const editRestricted = !canManageBuildings(role)
  const [deleting, setDeleting] = useState(false)
  // Closing the locator also drops ?locateWings=1 so reload/back don't reopen it.
  const closeLocator = () => {
    setLocating(false)
    if (wantsLocate) router.replace(`/buildings/${id}`)
  }
  const [deleteError, setDeleteError] = useState(null)
  // One customer fetch for both the phone row and the laptop stat tile.
  const customers = useCustomerSummary(building?.id)

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      await apiClient.delete(`/buildings/${id}`)
      // The map draws from a session-cached marker set — drop it, or the
      // deleted building keeps its pin until the tab is reloaded.
      invalidateBuildingMarkers()
      router.push('/buildings')
    } catch (err) {
      setDeleting(false)
      setDeleteError(getApiErrorMessage(err, 'Failed to delete the building. Please try again.'))
    }
  }

  const fetchBuilding = useCallback(() => {
    return apiClient
      .get(`/buildings/${id}`)
      .then((res) => setBuilding(res.data.data))
      .catch(() => setError('Building not found'))
  }, [id])

  useEffect(() => {
    fetchBuilding()
  }, [fetchBuilding])

  if (error) {
    return (
      <main className="mx-auto max-w-2xl">
        <PageHeader backHref="/buildings" backLabel="Buildings" title="Not found" sub={error} />
      </main>
    )
  }

  if (!building) {
    return (
      <main className="mx-auto max-w-2xl">
        <div className="animate-pulse">
          <div className="h-4 w-24 rounded bg-line/70" />
          <div className="mt-6 h-7 w-1/2 rounded bg-line" />
          <div className="mt-3 h-4 w-3/4 rounded bg-line/70" />
          <div className="mt-8 h-48 rounded-card bg-line/40" />
        </div>
      </main>
    )
  }

  const wing = wingSummary(building)
  const societyRow = isSociety(building)
  const societyLink = (isAdmin || role === 'SURVEYOR') && (
    <Link
      href={`/societies/${building.id}`}
      className="text-sm font-medium text-fiber underline-offset-2 hover:underline"
    >
      {isAdmin ? 'Permission history' : 'Site survey & materials'}
    </Link>
  )

  return (
    <main className="stagger mx-auto max-w-2xl xl:grid xl:max-w-6xl xl:grid-cols-[320px_minmax(0,1fr)] xl:items-start xl:gap-8">
      {/* Left (xl): fixed identity card. Below xl it is just the top of the page. */}
      <div className="xl:sticky xl:top-10 xl:-m-4 xl:max-h-[calc(100dvh-3rem)] xl:self-start xl:overflow-y-auto xl:p-4">
        <Link
          href="/buildings"
          className="mb-4 hidden items-center gap-1.5 text-sm font-medium text-muted transition-colors duration-200 hover:text-fiber xl:inline-flex"
        >
          <IconArrowLeft className="h-4 w-4" />
          Buildings
        </Link>

        <div className="xl:rounded-card xl:bg-card xl:p-5 xl:shadow-soft">
          {/* Below xl: the page as it always was. */}
          <div className="xl:hidden">
            <PageHeader
              backHref="/buildings"
              backLabel="Buildings"
              title={building.buildingName}
              sub={building.formattedAddress}
              action={
                canEdit && (
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => setEditOpen(true)}>
                      <IconEdit className="h-4 w-4" strokeWidth={1.8} />
                      Edit
                    </Button>
                    {isAdmin && (
                      <Button variant="dangerGhost" onClick={() => setDeleteOpen(true)}>
                        <IconTrash className="h-4 w-4" strokeWidth={1.8} />
                        Delete
                      </Button>
                    )}
                  </div>
                )
              }
            />

            {/* An approved society: say where it came from; the admin can open its
                permission visits and approval trail. */}
            {societyRow && (
              <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card bg-card px-5 py-3 shadow-soft">
                <SocietyBadge />
                <span className="text-sm font-normal text-muted">Added by a permission executive</span>
                {societyLink && <span className="ml-auto">{societyLink}</span>}
              </div>
            )}

            {building.latitude != null && (
              <div className="flex items-center gap-2 rounded-card bg-card px-5 py-3.5 shadow-soft">
                <IconPin className="h-4.5 w-4.5 shrink-0 text-fiber" strokeWidth={1.8} />
                <p className="text-sm tabular-nums text-muted">
                  {Number(building.latitude).toFixed(6)}, {Number(building.longitude).toFixed(6)}
                </p>
              </div>
            )}
          </div>

          {/* At xl: name, address, place and society inside the identity card. */}
          <div className="hidden xl:block">
            <h1 className="break-words text-xl font-bold tracking-tight">{building.buildingName}</h1>
            {building.formattedAddress && (
              <p className="mt-1 text-sm font-normal text-muted">{building.formattedAddress}</p>
            )}
            {building.latitude != null && (
              <div className="mt-3 flex items-center gap-2">
                <IconPin className="h-4 w-4 shrink-0 text-fiber" strokeWidth={1.8} />
                <p className="min-w-0 flex-1 truncate text-sm tabular-nums text-muted">
                  {Number(building.latitude).toFixed(6)}, {Number(building.longitude).toFixed(6)}
                </p>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${building.latitude},${building.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-fiber underline-offset-2 hover:underline"
                >
                  <IconNavigate className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
                  Directions
                </a>
              </div>
            )}
            {societyRow && (
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                <SocietyBadge />
                <span className="text-sm font-normal text-muted">Added by a permission executive</span>
                {societyLink}
              </div>
            )}
          </div>

          <LiveToggle building={building} onChanged={fetchBuilding} inCardAtXl />

          {canEdit && (
            <div className="mt-4 hidden gap-2 border-t border-line/60 pt-4 xl:flex">
              <Button variant="secondary" className="flex-1" onClick={() => setEditOpen(true)}>
                <IconEdit className="h-4 w-4" strokeWidth={1.8} />
                Edit
              </Button>
              {isAdmin && (
                <Button variant="dangerGhost" className="flex-1" onClick={() => setDeleteOpen(true)}>
                  <IconTrash className="h-4 w-4" strokeWidth={1.8} />
                  Delete
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="xl:hidden">
          <Section
            title="Structure"
            rows={[
              ['Type', building.details?.buildingType],
              ['Wings', building.details?.wings],
              ['Floors', building.details?.floors],
              ['Home pass', building.details?.homePass],
            ]}
          />
        </div>
      </div>

      {/* Right: below xl the original stack; at xl a stat strip, Details, Wings and Documents cards. */}
      <div className="min-w-0 xl:flex xl:flex-col xl:gap-5">
        <div className="xl:hidden">
          <WingsSection building={building} canEdit={canLocate} onLocate={() => setLocating(true)} />

          <Section title="Permission" rows={[['Amount paid', building.permission?.amountPaid]]} />

          <Section
            title="Survey"
            rows={[
              ['Zone', building.zone?.name],
              ['Added by', building.createdBy?.name],
              ['Remarks', building.details?.remarks],
            ]}
          />

          {/* Filled in bulk from the Buildings tab — Zone → OLT → PON at a glance. */}
          <Section
            title="OLT mapping"
            rows={[
              ['OLT', building.olt?.name],
              ['PON ports', building.ponPorts?.length ? building.ponPorts.join(', ') : null],
              ['On POP', building.olt?.pop?.name],
            ]}
          />
        </div>

        <div className="hidden xl:flex xl:flex-col xl:gap-5">
          <div className="grid auto-cols-fr grid-flow-col gap-4">
            <CustomersStat buildingId={building.id} data={customers} />
            <Stat
              label="Wings"
              value={wing.total ? `${wing.placed} of ${wing.total}` : wing.placed || null}
              sub={wing.total || wing.placed ? 'located' : null}
            />
            <Stat label="Home pass" value={building.details?.homePass} sub={building.details?.buildingType} />
            <Stat label="Floors" value={building.details?.floors} />
          </div>
          <DetailsCard
            groups={[
              {
                title: 'Survey',
                rows: [
                  ['Zone', building.zone?.name],
                  ['Added by', building.createdBy?.name],
                  ['Remarks', building.details?.remarks, true],
                ],
              },
              {
                title: 'OLT mapping',
                rows: [
                  ['OLT', building.olt?.name],
                  ['PON ports', building.ponPorts?.length ? building.ponPorts.join(', ') : null],
                  ['On POP', building.olt?.pop?.name],
                ],
              },
              { title: 'Permission', rows: [['Amount paid', building.permission?.amountPaid]] },
            ]}
          />
          <WingsSection card building={building} canEdit={canLocate} onLocate={() => setLocating(true)} />
        </div>

        <PhotoManager building={building} onChanged={fetchBuilding} cardAtXl />

        <CustomersLink buildingId={building.id} className="mt-5 xl:hidden" data={customers} />

      {locating && canLocate && (
        <LocateWingsModal
          building={building}
          onClose={closeLocator}
          onSaved={() => {
            closeLocator()
            fetchBuilding()
          }}
        />
      )}

      {editOpen && (
        <EditBuildingModal
          building={building}
          restricted={editRestricted}
          onClose={() => setEditOpen(false)}
          onLocate={() => {
            setEditOpen(false)
            setLocating(true)
          }}
          onSaved={fetchBuilding}
        />
      )}

      <Modal
        open={deleteOpen}
        onClose={() => !deleting && setDeleteOpen(false)}
        title="Delete building"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" disabled={deleting} onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleting} onClick={handleDelete}>
              <IconTrash className="h-4 w-4" strokeWidth={1.8} />
              Delete
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted">
          Delete <span className="font-semibold text-ink">“{building.buildingName}”</span>? This
          permanently removes the building, its details, and all uploaded photos. This cannot be
          undone.
        </p>
        {deleteError && <p className="mt-3 text-sm text-error">{deleteError}</p>}
      </Modal>
      </div>
    </main>
  )
}
