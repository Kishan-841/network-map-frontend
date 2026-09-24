'use client'

import { useEffect, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { ROLE_LABELS } from '@/lib/roles'

/**
 * Assign / distribute the selected buildings to one person on the actor's team.
 * The picker is the actor's own reports (fetched from GET /sales/team); the API
 * re-checks both the target and that every building is in the actor's pool.
 */
export function AssignToTeamModal({ buildingIds, onClose, onDone }) {
  const [team, setTeam] = useState(null) // null = loading
  const [assignedToId, setAssignedToId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const count = buildingIds.length

  useEffect(() => {
    let alive = true
    apiClient
      .get('/sales/team')
      .then((res) => alive && setTeam(res.data.data))
      .catch((err) => alive && (setTeam([]), setError(getApiErrorMessage(err, 'Could not load your team'))))
    return () => {
      alive = false
    }
  }, [])

  const target = (team ?? []).find((u) => u.id === assignedToId) ?? null

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      const res = await apiClient.post('/sales/assignments', { buildingIds, assignedToId })
      onDone(res.data.data)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not assign those buildings'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title="Assign buildings"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button className="flex-1" loading={busy} disabled={!target || busy} onClick={confirm}>
            Assign {count}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm font-normal text-muted">
          {count} building{count === 1 ? '' : 's'} selected.
        </p>

        <Select
          id="assign-target"
          label="Assign to"
          value={assignedToId}
          disabled={team === null}
          onChange={(e) => setAssignedToId(e.target.value)}
        >
          <option value="">{team === null ? 'Loading your team…' : 'Choose a team member…'}</option>
          {(team ?? []).map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} · {ROLE_LABELS[u.role] ?? u.role}
            </option>
          ))}
        </Select>
        {team !== null && team.length === 0 && (
          <p className="text-sm font-normal text-muted">You have no team members to assign to yet.</p>
        )}

        {target && (
          <div className="rounded-btn bg-paper px-4 py-3 text-sm font-normal text-muted">
            You are about to hand <span className="font-medium text-ink">{count}</span> building
            {count === 1 ? '' : 's'} to <span className="font-medium text-ink">{target.name}</span>.
          </div>
        )}

        {error && <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>}
      </div>
    </Modal>
  )
}
