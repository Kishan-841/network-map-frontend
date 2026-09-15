'use client'

import { useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { IconEdit, IconTrash, IconPlus } from '@/components/ui/icons'

/** Inline name+ports form: used both for "add new" and "edit existing". */
function OltEditForm({ initial, onSave, onCancel, saveLabel }) {
  const [name, setName] = useState(() => initial.name)
  const [ports, setPorts] = useState(() => String(initial.ponPortCount))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const portsNum = Number(ports)
  const canSave = name.trim() && Number.isInteger(portsNum) && portsNum >= 1 && portsNum <= 256

  async function handleSave() {
    setBusy(true)
    setError(null)
    try {
      await onSave({ name: name.trim(), ponPortCount: portsNum })
    } catch (err) {
      setError(getApiErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-btn border border-line p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Input
          id="olt-name"
          placeholder="OLT name e.g. OLT-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          id="olt-ports"
          type="number"
          min={1}
          max={256}
          placeholder="PON ports"
          value={ports}
          onChange={(e) => setPorts(e.target.value)}
        />
      </div>
      {error && (
        <p className="rounded-btn bg-bad-tint px-3 py-2 text-sm font-normal text-bad">{error}</p>
      )}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          className="h-11 min-h-11 flex-1"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className="h-11 min-h-11 flex-1"
          disabled={!canSave}
          loading={busy}
          onClick={handleSave}
        >
          {saveLabel}
        </Button>
      </div>
    </div>
  )
}

function OltRow({ olt, canManage, busy, onEdit, onDelete }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-btn border border-line px-3 py-2">
      <p className="min-w-0 truncate text-sm font-medium text-ink">
        {olt.name} · {olt.ponPortCount} ports · {olt._count?.fibers ?? 0} fibers
      </p>
      {canManage && (
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            aria-label="Edit OLT"
            disabled={busy}
            onClick={() => onEdit(olt)}
            className="flex h-9 w-9 min-h-11 items-center justify-center rounded-btn text-muted transition-colors hover:bg-paper hover:text-ink disabled:opacity-50"
          >
            <IconEdit className="h-4 w-4" strokeWidth={1.8} />
          </button>
          <button
            type="button"
            aria-label="Delete OLT"
            disabled={busy}
            onClick={() => onDelete(olt)}
            className="flex h-9 w-9 min-h-11 items-center justify-center rounded-btn text-muted transition-colors hover:bg-bad-tint hover:text-bad disabled:opacity-50"
          >
            <IconTrash className="h-4 w-4" strokeWidth={1.8} />
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * OLT sub-table for one POP's expanded row: list of OLTs with edit/delete,
 * plus an inline "add OLT" form. Renders straight from the `olts` prop —
 * every mutation calls `onMutated()` (→ `invalidatePops(); invalidateFibers()`)
 * and relies on `useSessionResource`'s mounted-consumer refetch to bring the
 * POP list (and this component, re-rendered with fresh `olts`) up to date.
 */
export default function OltList({ popId, olts, canManage, onMutated }) {
  // undefined = no form open, null = adding, an id = editing that OLT.
  const [editingId, setEditingId] = useState(undefined)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)

  const closeForm = () => setEditingId(undefined)

  async function handleSave(oltId, values) {
    if (oltId) {
      await apiClient.patch(`/pops/${popId}/olts/${oltId}`, values)
    } else {
      await apiClient.post(`/pops/${popId}/olts`, values)
    }
    onMutated()
    closeForm()
  }

  async function handleDelete(olt) {
    if (!window.confirm(`Delete OLT "${olt.name}"?`)) return
    setBusyId(olt.id)
    setError(null)
    try {
      await apiClient.delete(`/pops/${popId}/olts/${olt.id}`)
      onMutated()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not delete this OLT'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p className="rounded-btn bg-bad-tint px-3 py-2 text-sm font-normal text-bad">{error}</p>
      )}

      {olts.length === 0 && editingId === undefined && (
        <p className="text-sm font-normal text-muted">No OLTs yet.</p>
      )}

      {olts.map((olt) =>
        editingId === olt.id ? (
          <OltEditForm
            key={olt.id}
            initial={olt}
            saveLabel="Save changes"
            onCancel={closeForm}
            onSave={(values) => handleSave(olt.id, values)}
          />
        ) : (
          <OltRow
            key={olt.id}
            olt={olt}
            canManage={canManage}
            busy={busyId === olt.id}
            onEdit={(o) => setEditingId(o.id)}
            onDelete={handleDelete}
          />
        ),
      )}

      {canManage && editingId === null && (
        <OltEditForm
          initial={{ name: '', ponPortCount: 8 }}
          saveLabel="Add OLT"
          onCancel={closeForm}
          onSave={(values) => handleSave(null, values)}
        />
      )}

      {canManage && editingId === undefined && (
        <Button
          type="button"
          variant="secondary"
          className="h-11 min-h-11"
          onClick={() => setEditingId(null)}
        >
          <IconPlus className="h-4 w-4" strokeWidth={1.8} />
          Add OLT
        </Button>
      )}
    </div>
  )
}
