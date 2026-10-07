'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { VisitDetailBody } from '@/components/sales/VisitDetailBody'
import { PageHeader } from '@/components/ui/PageHeader'

/** Everything about one field visit — the whole record in one place. */
export default function VisitDetailPage() {
  const { id } = useParams()
  const [visit, setVisit] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    apiClient
      .get(`/sales/visits/${id}`)
      .then((res) => alive && (setVisit(res.data.data), setLoading(false)))
      .catch((err) => alive && (setError(getApiErrorMessage(err, 'Could not load this visit')), setLoading(false)))
    return () => {
      alive = false
    }
  }, [id])

  return (
    <main className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Field sales"
        title="Visit"
        sub={visit ? `${visit.user?.name} · ${visit.building?.buildingName}` : ''}
        backHref="/sales/dashboard"
        backLabel="Dashboard"
      />

      {loading && <p className="text-sm font-normal text-muted">Loading…</p>}
      {error && <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>}

      {visit && <VisitDetailBody visit={visit} />}
    </main>
  )
}
