'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiClient } from '@/lib/api-client'
import { summaryLine, worstTone } from '@/lib/connection'
import { IconChevronRight, IconUsers } from '@/components/ui/icons'

const DOT = { ok: 'bg-ok', bad: 'bg-bad', warn: 'bg-warn', muted: 'bg-faint' }

/**
 * One row on a building (page or map drawer) that opens its customers page.
 * Shows the customer count; renders nothing when the user can't read the
 * building's customers (404/403). When live OLT status is enabled and the building
 * has customers, a muted health line (dot + words) sits under the label.
 */
export function CustomersLink({ buildingId, className = '' }) {
  const [count, setCount] = useState(null) // null = loading
  const [hidden, setHidden] = useState(false)
  const [counts, setCounts] = useState(null) // live connection counts; null = none to show

  useEffect(() => {
    let live = true
    apiClient
      .get('/customers', { params: { buildingId } })
      .then((res) => {
        if (!live) return
        setHidden(false)
        const n = (res.data?.data?.customers ?? []).length
        setCount(n)
        if (n === 0) return null
        // One request for the whole building; any failure just means no health line.
        return apiClient
          .get('/customers/connections', { params: { buildingId } })
          .then((r) => {
            const d = r.data?.data
            if (live) setCounts(d?.enabled ? d.counts : null)
          })
          .catch(() => {})
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
  const line = summaryLine(counts)
  return (
    <Link
      href={`/buildings/${buildingId}/customers`}
      className={`${className} flex min-h-11 items-center gap-3 rounded-card bg-card p-4 shadow-soft transition-colors hover:bg-paper`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper text-muted">
        <IconUsers className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-ink">Customers</span>
        {line && (
          <span className="mt-0.5 flex items-start gap-2 text-xs text-muted">
            <span
              aria-hidden="true"
              className={`mt-1 h-2 w-2 shrink-0 rounded-full ${DOT[worstTone(counts)]}`}
            />
            <span>{line}</span>
          </span>
        )}
      </span>
      <span className="shrink-0 text-sm text-muted">{count == null ? '—' : count}</span>
      <IconChevronRight className="h-4 w-4 text-faint" />
    </Link>
  )
}
