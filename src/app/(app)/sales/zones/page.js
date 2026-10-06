'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import { canManageTeamZones } from '@/lib/roles'
import { useZones } from '@/hooks/useZones'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Toast } from '@/components/ui/Toast'
import { TeamZonesModal } from '@/components/sales/TeamZonesModal'
import { IconEdit } from '@/components/ui/icons'

/**
 * Team zones: a sales manager (or admin) gives each team leader the zones they
 * work. A TL's Sales list and map follow at once (spec 2026-10-06).
 */
export default function TeamZonesPage() {
  const role = useAuthStore((s) => s.user?.role)
  const allowed = canManageTeamZones(role)
  const { zones } = useZones(allowed)
  const [leaders, setLeaders] = useState(null) // null = loading
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null)
  const [toast, setToast] = useState(null)

  const load = useCallback(() => {
    apiClient
      .get('/sales/team-leaders')
      .then((res) => setLeaders(res.data.data))
      .catch((err) => {
        setLeaders([])
        setError(getApiErrorMessage(err, 'Could not load your team leaders'))
      })
  }, [])
  useEffect(() => {
    if (allowed) load()
  }, [allowed, load])

  if (!allowed) {
    return <PageHeader title="Team zones" sub="Only sales managers give team leaders their zones." />
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Team zones" sub="Give each team leader the zones they work" />
      {toast && <Toast key={toast} message={toast} onDone={() => setToast(null)} />}
      {error && <p className="mb-4 rounded-btn bg-bad-tint px-4 py-3 text-sm font-medium text-bad">{error}</p>}

      {leaders === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : leaders.length === 0 ? (
        <div className="rounded-card border border-line bg-card px-4 py-8 text-center text-sm text-muted">
          No team leaders report to you yet.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {leaders.map((leader) => (
            <li key={leader.id} className="flex items-start gap-3 rounded-card border border-line bg-card p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{leader.name}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {leader.assignedZones.length === 0 ? (
                    <span className="text-sm text-muted">No zones yet</span>
                  ) : (
                    leader.assignedZones.map((zone) => (
                      <span key={zone.id} className="rounded-full bg-paper px-2.5 py-1 text-xs font-medium text-ink">
                        {zone.name}
                      </span>
                    ))
                  )}
                </div>
              </div>
              <Button variant="secondary" onClick={() => setEditing(leader)} aria-label={`Edit zones for ${leader.name}`}>
                <IconEdit className="h-4 w-4" /> Edit
              </Button>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <TeamZonesModal
          leader={editing}
          zones={zones}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setLeaders((list) => list.map((l) => (l.id === saved.id ? { ...l, ...saved } : l)))
            setEditing(null)
            setToast(`Zones saved for ${saved.name}`)
          }}
        />
      )}
    </div>
  )
}
