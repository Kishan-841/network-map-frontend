'use client'

import { Suspense, use } from 'react'
import { CustomersSection } from '@/components/customers/CustomersSection'
import { useAuthStore } from '@/stores/auth-store'

/** A building's customers — wing chips, search and table. Only ADMIN can write. */
export default function BuildingCustomersPage({ params }) {
  const { id } = use(params)
  const isAdmin = useAuthStore((s) => s.user?.role) === 'ADMIN'

  return (
    <main className="mx-auto max-w-5xl">
      {/* useSearchParams (the ?wing= filter) needs a Suspense boundary. */}
      <Suspense fallback={<div className="h-48 animate-pulse rounded-card bg-line/40" />}>
        <CustomersSection buildingId={id} canWrite={isAdmin} />
      </Suspense>
    </main>
  )
}
