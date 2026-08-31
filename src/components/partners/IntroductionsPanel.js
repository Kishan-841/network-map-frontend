'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { IconChevronDown } from '@/components/ui/icons'

const STATUSES = ['NEW', 'CONTACTED', 'JOINED', 'DECLINED']
const LABEL = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  JOINED: 'Joined',
  DECLINED: 'Declined',
}
const STYLE = {
  NEW: 'bg-fiber-tint text-fiber',
  CONTACTED: 'bg-scan-tint text-scan',
  JOINED: 'bg-ok-tint text-ok',
  DECLINED: 'bg-paper text-faint',
}
const TYPE_LABEL = {
  AGENT: 'Agent',
  SOCIETY_REPRESENTATIVE: 'Society rep',
  RETAIL_SHOP: 'Retail shop',
  DSA: 'DSA',
}

const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' })

/**
 * People your partners have introduced (partner-network.md §7).
 *
 * They sit above the partners table rather than on a page of their own,
 * because that is what they are: partners who have not agreed yet. The panel
 * disappears entirely once every introduction is closed out, so it never
 * becomes permanent furniture.
 */
export function IntroductionsPanel() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(null)

  useEffect(() => {
    let cancelled = false
    apiClient
      .get('/partner-referrals')
      .then((res) => !cancelled && setRows(res.data.data))
      .catch(() => !cancelled && setRows([]))
    return () => {
      cancelled = true
    }
  }, [])

  const update = useCallback(async (row, next) => {
    if (next === row.status) return
    setError(null)
    setSaving(row.id)
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: next } : r)))
    try {
      await apiClient.patch(`/partner-referrals/${row.id}/status`, { status: next })
    } catch (err) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: row.status } : r)))
      setError(getApiErrorMessage(err, 'Could not update that introduction'))
    } finally {
      setSaving(null)
    }
  }, [])

  // An introduction that has joined or been declined is finished business.
  const open = (rows ?? []).filter((r) => r.status === 'NEW' || r.status === 'CONTACTED')
  if (!rows || !open.length) return null

  return (
    <section className="mb-4 rounded-card bg-card p-4 shadow-soft">
      <p className="text-xs font-medium uppercase tracking-wide text-faint">
        Introduced by your partners
      </p>

      {error && (
        <p className="mt-2 rounded-btn bg-bad-tint px-3 py-2 text-sm font-normal text-bad">
          {error}
        </p>
      )}

      <ul className="mt-2 flex flex-col divide-y divide-line/70">
        {open.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{r.name}</span>
              <span className="block truncate text-xs font-normal text-muted">
                {TYPE_LABEL[r.type] ?? r.type} · {r.mobile} · from{' '}
                {r.referredBy?.name ?? 'a partner'} · {dateFormat.format(new Date(r.createdAt))}
              </span>
            </span>
            <span
              className={`relative inline-flex shrink-0 items-center rounded-full transition-opacity ${
                STYLE[r.status] ?? 'bg-paper text-muted'
              } ${saving === r.id ? 'opacity-50' : ''}`}
            >
              <select
                value={r.status}
                disabled={saving === r.id}
                aria-label={`Status for ${r.name}`}
                onChange={(e) => update(r, e.target.value)}
                className="cursor-pointer appearance-none rounded-full bg-transparent py-1 pl-2.5 pr-7 text-xs font-medium text-inherit outline-none ring-inset transition-shadow hover:ring-1 hover:ring-current/30 focus-visible:ring-2 focus-visible:ring-current/50 disabled:cursor-wait"
              >
                {STATUSES.map((value) => (
                  <option key={value} value={value} className="bg-card text-ink">
                    {LABEL[value]}
                  </option>
                ))}
              </select>
              <IconChevronDown
                className="pointer-events-none absolute right-2 h-3 w-3 opacity-70"
                strokeWidth={2.4}
              />
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
