'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { PageHeader } from '@/components/ui/PageHeader'
import { CrudList } from '@/components/admin/CrudList'

export default function AdminCitiesPage() {
  const [cities, setCities] = useState(null)

  const fetchCities = useCallback(
    () =>
      apiClient
        .get('/cities')
        .then((res) => setCities(res.data.data))
        // Empty list (not a permanent "Loading…") when the fetch fails.
        .catch(() => setCities([])),
    [],
  )

  useEffect(() => {
    fetchCities()
  }, [fetchCities])

  return (
    <main className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow="Administration"
        title="Cities"
        sub="Group operators by city — filter the dashboard and buildings by city"
        backHref="/dashboard"
        backLabel="Dashboard"
      />

      <CrudList
        items={cities}
        addLabel="Add"
        fields={[{ name: 'name', placeholder: 'City name e.g. Pune' }]}
        renderItem={(city) => (
          <div>
            <p className="truncate font-bold">{city.name}</p>
            <p className="text-sm font-normal text-muted">
              {city.operatorCount} operator{city.operatorCount === 1 ? '' : 's'}
            </p>
          </div>
        )}
        onCreate={async (draft) => {
          await apiClient.post('/cities', draft)
          await fetchCities()
        }}
        onUpdate={async (id, draft) => {
          await apiClient.patch(`/cities/${id}`, draft)
          await fetchCities()
        }}
        onDelete={async (id) => {
          await apiClient.delete(`/cities/${id}`)
          await fetchCities()
        }}
      />
    </main>
  )
}
