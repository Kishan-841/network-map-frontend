'use client'

import { useMemo, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { oltOptionsFromPops, zonesOfSelection, parsePonPorts } from '@/lib/olt-mapping'

/**
 * Bulk-map the ticked buildings to one OLT + PON port (olt-mapping.md).
 *
 * The zone rule is the feature: a non-admin may only map buildings that all sit
 * in one zone, to an OLT in that same zone — so if the selection spans zones we
 * stop here and ask them to split it. An admin may cross zones. Whatever the UI
 * allows, the API validates it again, so this is a usability aid, not the guard.
 */
export function AssignOltModal({ selectedIds, rows, pops, isAdmin = false, onClose, onDone }) {
  const zones = useMemo(() => zonesOfSelection(rows, selectedIds), [rows, selectedIds])
  const count = selectedIds.size
  // Non-admins must land on exactly one real zone.
  const blocked = !isAdmin && (zones.length !== 1 || !zones[0]?.id)
  const scopeZoneId = zones.length === 1 ? zones[0].id : null
  const oltOptions = useMemo(() => oltOptionsFromPops(pops, scopeZoneId), [pops, scopeZoneId])

  const [oltId, setOltId] = useState('')
  const [ponText, setPonText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const olt = oltOptions.find((o) => o.id === oltId) ?? null
  const parsed = olt ? parsePonPorts(ponText, olt.ponPortCount) : { ports: [], error: null }
  const portsValid = olt && parsed.error === null && parsed.ports.length > 0
  const canConfirm = Boolean(olt) && portsValid && !busy

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      const res = await apiClient.patch('/buildings/bulk-olt', {
        ids: [...selectedIds],
        oltId,
        ponPorts: parsed.ports,
      })
      onDone(res.data.data)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not map those buildings'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title="Assign OLT & PON port"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={busy}>
            {blocked ? 'Close' : 'Cancel'}
          </Button>
          {!blocked && (
            <Button className="flex-1" loading={busy} disabled={!canConfirm} onClick={confirm}>
              Confirm assignment
            </Button>
          )}
        </div>
      }
    >
      {blocked ? (
        <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">
          Please select buildings from the same zone to assign an OLT. Do one zone at a time.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm font-normal text-muted">
            {count} building{count === 1 ? '' : 's'} selected
            {scopeZoneId && zones[0]?.name && (
              <>
                {' '}
                in <span className="font-medium text-ink">{zones[0].name}</span>
              </>
            )}
            .
          </p>

          <Select
            id="assign-olt"
            label="OLT"
            value={oltId}
            onChange={(e) => {
              setOltId(e.target.value)
              setPonText('')
            }}
          >
            <option value="">Choose an OLT…</option>
            {oltOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
                {isAdmin && option.zoneName ? ` · ${option.zoneName}` : ''} ({option.ponPortCount} ports)
              </option>
            ))}
          </Select>
          {oltOptions.length === 0 && (
            <p className="text-sm font-normal text-muted">No OLTs are recorded in this zone yet.</p>
          )}

          <Input
            id="assign-pon"
            label="PON ports"
            inputMode="numeric"
            placeholder={olt ? `e.g. 1,2,3 (1–${olt.ponPortCount})` : 'Choose an OLT first'}
            value={ponText}
            disabled={!olt}
            error={olt && ponText.trim() !== '' ? parsed.error ?? undefined : undefined}
            onChange={(e) => setPonText(e.target.value)}
          />

          {canConfirm && (
            <div className="rounded-btn bg-paper px-4 py-3 text-sm font-normal text-muted">
              You are about to map <span className="font-medium text-ink">{count}</span> building
              {count === 1 ? '' : 's'} to <span className="font-medium text-ink">{olt.name}</span>,
              PON port{parsed.ports.length === 1 ? '' : 's'}{' '}
              <span className="font-medium text-ink">{parsed.ports.join(', ')}</span>.
            </div>
          )}

          {error && (
            <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>
          )}
        </div>
      )}
    </Modal>
  )
}
