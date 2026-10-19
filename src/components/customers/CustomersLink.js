'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiClient } from '@/lib/api-client'
import { IconChevronRight, IconUsers } from '@/components/ui/icons'

/**
 * One row on a building (page or map drawer) that opens its customers page.
 * Shows the customer count; renders nothing when the user can't read the
 * building's customers (404/403).
 */
export function CustomersLink({ buildingId }) {
  const [count, setCount] = useState(null) // null = loading
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    let live = true
    apiClient
      .get('/customers', { params: { buildingId } })
      .then((res) => {
        if (!live) return
        setHidden(false)
        setCount((res.data?.data?.customers ?? []).length)
      })
      .catch((err) => {
        const status = err.response?.status
        if (live && (status === 404 || status === 403)) setHidden(true) // other errors keep the "—"
      })
    return () => {
      live = false
    }
  }, [buildingId])

  if (hidden) return null
  return (
    <Link
      href={`/buildings/${buildingId}/customers`}
      className="mt-5 flex min-h-11 items-center gap-3 rounded-card bg-card p-4 shadow-soft transition-colors hover:bg-paper"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper text-muted">
        <IconUsers className="h-4 w-4" />
      </span>
      <span className="flex-1 text-sm font-bold text-ink">Customers</span>
      <span className="text-sm text-muted">{count == null ? '—' : count}</span>
      <IconChevronRight className="h-4 w-4 text-faint" />
    </Link>
  )
}
