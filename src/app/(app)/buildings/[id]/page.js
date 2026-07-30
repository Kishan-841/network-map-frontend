'use client'

import { use, useCallback, useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { PageHeader } from '@/components/ui/PageHeader'
import { IconPin } from '@/components/ui/icons'
import { PhotoManager } from '@/components/buildings/PhotoManager'
import { LiveToggle } from '@/components/buildings/LiveToggle'

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

export default function BuildingDetailPage({ params }) {
  const { id } = use(params)
  const [building, setBuilding] = useState(null)
  const [error, setError] = useState(null)

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

  return (
    <main className="stagger mx-auto max-w-2xl">
      <PageHeader
        backHref="/buildings"
        backLabel="Buildings"
        title={building.buildingName}
        sub={building.formattedAddress}
      />

      {building.latitude != null && (
        <div className="flex items-center gap-2 rounded-card bg-card px-5 py-3.5 shadow-soft">
          <IconPin className="h-4.5 w-4.5 shrink-0 text-fiber" strokeWidth={1.8} />
          <p className="text-sm tabular-nums text-muted">
            {Number(building.latitude).toFixed(6)}, {Number(building.longitude).toFixed(6)}
          </p>
        </div>
      )}

      <LiveToggle building={building} onChanged={fetchBuilding} />

      <Section
        title="Structure"
        rows={[
          ['Type', building.details?.buildingType],
          ['Wings', building.details?.wings],
          ['Floors', building.details?.floors],
          ['Home pass', building.details?.homePass],
        ]}
      />

      <Section title="Permission" rows={[['Amount paid', building.permission?.amountPaid]]} />

      <Section
        title="Survey"
        rows={[
          ['Zone', building.zone?.name],
          ['Added by', building.createdBy?.name],
          ['Remarks', building.details?.remarks],
        ]}
      />

      <PhotoManager building={building} onChanged={fetchBuilding} />
    </main>
  )
}
