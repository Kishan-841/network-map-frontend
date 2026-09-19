'use client'

import { useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { DataTable } from '@/components/ui/DataTable'
import { IconPlus, IconEdit, IconTrash } from '@/components/ui/icons'
import { usePops, invalidatePops } from '@/hooks/usePops'
import { invalidateFibers } from '@/hooks/useFibers'
import { canManageFiber } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'
import PopForm from '@/components/fiber/PopForm'
import { rackSummary } from '@/lib/fiber/pop-sheet'

const emptyForm = {
  name: '',
  zoneId: '',
  latitude: '',
  longitude: '',
  notes: '',
  serverLocation: '',
  rackSize: '',
  rackCondition: '',
  upsBatteryCount: '',
  images: [],
  olts: [],
  devices: [],
}

const toForm = (pop) => ({
  name: pop.name,
  zoneId: pop.zoneId ?? '',
  latitude: String(pop.latitude),
  longitude: String(pop.longitude),
  notes: pop.notes ?? '',
  serverLocation: pop.serverLocation ?? '',
  rackSize: pop.rackSize ?? '',
  rackCondition: pop.rackCondition ?? '',
  upsBatteryCount: pop.upsBatteryCount == null ? '' : String(pop.upsBatteryCount),
  images: pop.images ?? [],
  olts: (pop.olts ?? []).map((olt) => ({
    id: olt.id,
    name: olt.name,
    ponPortCount: String(olt.ponPortCount),
    ipAddress: olt.ipAddress ?? '',
    type: olt.type ?? '',
    model: olt.model ?? '',
  })),
  devices: (pop.devices ?? []).map((device) => ({
    id: device.id,
    kind: device.kind,
    label: device.label ?? '',
    ipAddress: device.ipAddress ?? '',
    portCount: device.portCount ?? undefined,
    speed: device.speed ?? '',
    model: device.model ?? '',
  })),
})

const DEVICE_SECTIONS = [
  { kind: 'SWITCH', title: 'Switches' },
  { kind: 'MIKROTIK', title: 'Mikrotiks' },
  { kind: 'FMS', title: 'FMS units' },
]

const deviceLine = (device) =>
  [
    device.label,
    device.speed,
    device.model,
    device.ipAddress,
    device.portCount != null ? `${device.portCount} port` : null,
  ]
    .filter(Boolean)
    .join(' · ')

/**
 * What is in the rack, read-only. Editing happens in the POP form, where the
 * whole site is recorded in one save — a second place to change the same rows
 * would be two sources of truth for one rack.
 */
function PopEquipment({ pop }) {
  const sections = [
    {
      title: 'OLTs',
      lines: (pop.olts ?? []).map((olt) =>
        [
          olt.name,
          olt.type,
          olt.model,
          `${olt.ponPortCount} ports`,
          olt.ipAddress,
          `${olt._count?.fibers ?? 0} fibers`,
        ]
          .filter(Boolean)
          .join(' · '),
      ),
    },
    ...DEVICE_SECTIONS.map(({ kind, title }) => ({
      title,
      lines: (pop.devices ?? []).filter((d) => d.kind === kind).map(deviceLine),
    })),
  ]

  return (
    <div className="flex flex-col gap-4">
      {sections.map((section) => (
        <div key={section.title} className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wide text-faint">{section.title}</p>
          {section.lines.length === 0 ? (
            <p className="text-sm font-normal text-muted">None recorded.</p>
          ) : (
            section.lines.map((line) => (
              <p key={line} className="text-sm font-normal">
                {line}
              </p>
            ))
          )}
        </div>
      ))}
      <p className="text-xs font-normal text-faint">Use Edit to change any of this.</p>
    </div>
  )
}

const oltSummary = (pop) =>
  pop.olts?.length ? pop.olts.map((o) => `${o.name} (${o.ponPortCount})`).join(' · ') : '—'

function RowActions({ pop, onEdit, onDelete }) {
  return (
    <div className="flex justify-end gap-1">
      <button
        type="button"
        aria-label="Edit"
        onClick={(e) => {
          e.stopPropagation()
          onEdit(pop)
        }}
        className="flex h-9 w-9 min-h-11 items-center justify-center rounded-btn text-muted transition-colors hover:bg-paper hover:text-ink"
      >
        <IconEdit className="h-4 w-4" strokeWidth={1.8} />
      </button>
      <button
        type="button"
        aria-label="Delete"
        onClick={(e) => {
          e.stopPropagation()
          onDelete(pop)
        }}
        className="flex h-9 w-9 min-h-11 items-center justify-center rounded-btn text-muted transition-colors hover:bg-bad-tint hover:text-bad"
      >
        <IconTrash className="h-4 w-4" strokeWidth={1.8} />
      </button>
    </div>
  )
}

export default function AdminPopsPage() {
  const user = useAuthStore((s) => s.user)
  const canManage = canManageFiber(user)
  // Only the maker and an ADMIN see a row, so say whose list this is.
  const isAdmin = user?.role === 'ADMIN'
  const { pops, loading } = usePops()
  const [listError, setListError] = useState(null)
  // undefined = closed, null = new POP, object = edit that POP.
  const [editingPop, setEditingPop] = useState(undefined)
  const [expandedId, setExpandedId] = useState(null)

  const closeForm = () => setEditingPop(undefined)
  const toggleExpand = (pop) => setExpandedId((id) => (id === pop.id ? null : pop.id))
  async function handleSave(values) {
    if (editingPop) {
      await apiClient.patch(`/pops/${editingPop.id}`, values)
    } else {
      await apiClient.post('/pops', values)
    }
    invalidatePops()
    invalidateFibers()
    closeForm()
  }

  async function handleDelete(pop) {
    if (!window.confirm(`Delete POP "${pop.name}"?`)) return
    setListError(null)
    try {
      await apiClient.delete(`/pops/${pop.id}`)
      invalidatePops()
      invalidateFibers()
      if (expandedId === pop.id) setExpandedId(null)
    } catch (err) {
      setListError(getApiErrorMessage(err, 'Could not delete this POP'))
    }
  }

  const columns = [
    { key: 'name', header: 'Name', render: (p) => <span className="font-bold">{p.name}</span> },
    {
      key: 'zone',
      header: 'Zone',
      render: (p) => p.zone?.name ?? <span className="text-faint">No zone</span>,
    },
    {
      key: 'rack',
      header: 'Rack',
      render: (p) => rackSummary(p) ?? <span className="text-faint">—</span>,
    },
    {
      key: 'position',
      header: 'Position',
      className: 'font-mono text-xs text-muted',
      render: (p) => `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`,
    },
    { key: 'olts', header: 'OLTs', render: oltSummary },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: '',
            headerClassName: 'text-right',
            className: 'text-right',
            render: (p) => <RowActions pop={p} onEdit={setEditingPop} onDelete={handleDelete} />,
          },
        ]
      : []),
  ]

  const renderCard = (p) => (
    <div className="rounded-card bg-card p-4 shadow-soft">
      <div
        onClick={() => toggleExpand(p)}
        className="cursor-pointer transition-transform active:scale-[0.99]"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="truncate font-bold">{p.name}</span>
        </div>
        <p className="mt-1 font-mono text-xs text-muted">
          {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}
        </p>
        <p className="mt-1 text-sm font-normal text-muted">
          {p.zone?.name ?? 'No zone'} · {oltSummary(p)}
        </p>
      </div>
      {canManage && (
        <div className="mt-3 border-t border-line/60 pt-3">
          <RowActions pop={p} onEdit={setEditingPop} onDelete={handleDelete} />
        </div>
      )}
      {expandedId === p.id && (
        <div className="mt-3 border-t border-line/60 pt-3">
          <PopEquipment key={p.id} pop={p} />
        </div>
      )}
    </div>
  )

  const expandedPop = pops.find((p) => p.id === expandedId) ?? null

  return (
    <main className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Administration"
        title="POPs"
        sub={isAdmin ? 'Every site and its OLTs' : 'The sites you added — only you and admins see them'}
        backHref="/dashboard"
        backLabel="Dashboard"
        action={
          canManage && (
            <Button type="button" onClick={() => setEditingPop(null)}>
              <IconPlus className="h-4.5 w-4.5" />
              New POP
            </Button>
          )
        }
      />

      {listError && (
        <p className="mb-3 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">
          {listError}
        </p>
      )}

      {editingPop !== undefined && (
        <div className="mb-4">
          <PopForm
            key={editingPop?.id ?? 'new'}
            initial={editingPop ? toForm(editingPop) : emptyForm}
            saveLabel={editingPop ? 'Save changes' : 'Add POP'}
            onCancel={closeForm}
            onSave={handleSave}
          />
        </div>
      )}

      <DataTable
        columns={columns}
        rows={pops}
        loading={loading}
        keyField="id"
        onRowClick={toggleExpand}
        renderCard={renderCard}
        emptyState={<p className="text-sm font-normal text-muted">No POPs yet — add the first one.</p>}
      />

      {/* Desktop-only — the mobile card above renders its sub-table inline. */}
      {expandedPop && (
        <div className="mt-4 hidden rounded-card bg-card p-5 shadow-soft lg:block">
          <h3 className="mb-3 text-sm font-bold text-ink">{expandedPop.name} · equipment</h3>
          <PopEquipment key={expandedPop.id} pop={expandedPop} />
        </div>
      )}
    </main>
  )
}
