'use client'

import { useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ZoneMultiSelect } from '@/components/admin/ZoneMultiSelect'

/**
 * Give one team leader their zones. Saving REPLACES the list; the TL then
 * works every building in those zones and sees their fibres and POPs.
 */
export function TeamZonesModal({ leader, zones, onClose, onSaved }) {
  const [zoneIds, setZoneIds] = useState(() => leader.assignedZones.map((z) => z.id))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const res = await apiClient.put(`/sales/team-leaders/${leader.id}/zones`, { zoneIds })
      onSaved(res.data.data)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save the zones'))
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={`Zones for ${leader.name}`}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button className="flex-1" loading={busy} disabled={busy} onClick={save}>
            Save
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm font-normal text-muted">
          {leader.name} works every building in these zones and sees their fibres and POPs. Buildings they already gave
          their executives stay with them if you remove a zone.
        </p>
        <ZoneMultiSelect zones={zones ?? []} selectedIds={zoneIds} onChange={setZoneIds} />
        {error && <p className="rounded-btn bg-bad-tint px-3 py-2 text-sm font-medium text-bad">{error}</p>}
      </div>
    </Modal>
  )
}
