'use client'

import { useRouter } from 'next/navigation'
import { useBuildings } from '@/hooks/useBuildings'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable } from '@/components/ui/DataTable'
import { permissionStatusLabel } from '@/lib/society'

const fmtDate = (v) => (v ? new Date(v).toLocaleDateString([], { dateStyle: 'medium' }) : '—')

/**
 * A Permission Executive's own societies (the API scopes the list to them).
 * A row opens the capture form prefilled for editing.
 */
export default function SocietiesPage() {
  const router = useRouter()
  const { buildings, loading } = useBuildings({ pageSize: 200 })

  const open = (b) => router.push(`/societies/add?edit=${b.id}`)

  const columns = [
    { key: 'society', header: 'Society', render: (b) => <span className="font-medium text-ink">{b.buildingName}</span> },
    { key: 'zone', header: 'Zone', render: (b) => b.zone?.name ?? '—' },
    { key: 'status', header: 'Permission', render: (b) => permissionStatusLabel(b.permission?.permissionStatus) || '—' },
    { key: 'added', header: 'Added', render: (b) => fmtDate(b.createdAt) },
  ]

  const renderCard = (b) => (
    <div className="rounded-card border border-line bg-card p-3">
      <p className="font-medium text-ink">{b.buildingName}</p>
      <p className="text-sm font-normal text-muted">
        {b.zone?.name ?? 'No zone'}
        {b.permission?.permissionStatus ? ` · ${permissionStatusLabel(b.permission.permissionStatus)}` : ''}
      </p>
    </div>
  )

  return (
    <main className="mx-auto max-w-4xl">
      <PageHeader eyebrow="Permission" title="My societies" sub="Societies you added — tap one to edit it" />
      <DataTable
        columns={columns}
        rows={buildings}
        loading={loading}
        onRowClick={open}
        renderCard={renderCard}
        emptyState={<p className="py-8 text-center text-sm font-normal text-muted">No societies yet. Use “Add society”.</p>}
      />
    </main>
  )
}
