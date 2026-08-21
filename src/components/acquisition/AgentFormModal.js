'use client'

import { useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { useCities } from '@/hooks/useCities'

/**
 * Create or edit an acquisition agent. Shared by the lead's dashboard and the
 * Users tab, so the city + pincode territory rules are written down once.
 *
 * Pass `initial` (a user row) to edit. In edit mode the password field is
 * optional — blank means "keep the current one" — because a lead changing a
 * territory should never be forced to reset someone's login.
 */
export function AgentFormModal({ initial, onClose, onSaved }) {
  const { cities } = useCities()
  const editing = Boolean(initial)
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    email: initial?.email ?? '',
    password: '',
    cityId: initial?.pincodes?.[0]?.cityId ?? '',
    pincodes: (initial?.pincodes ?? []).map((p) => p.pincode).join(', '),
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const pincodeList = form.pincodes
    .split(/[,\s]+/)
    .map((p) => p.trim())
    .filter(Boolean)
  const passwordOk = editing
    ? form.password === '' || (form.password.length >= 8 && /[a-zA-Z]/.test(form.password) && /[0-9]/.test(form.password))
    : form.password.length >= 8
  const valid =
    form.name.trim() &&
    form.email.trim() &&
    passwordOk &&
    form.cityId &&
    pincodeList.length > 0 &&
    pincodeList.every((p) => /^[1-9][0-9]{5}$/.test(p))

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        cityId: form.cityId,
        pincodes: pincodeList,
        ...(form.password ? { password: form.password } : {}),
      }
      if (editing) {
        await apiClient.patch(`/users/${initial.id}`, payload)
      } else {
        await apiClient.post('/users', { ...payload, role: 'ACQUISITION_AGENT' })
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(
        getApiErrorMessage(err, `Could not ${editing ? 'update' : 'create'} the agent`),
      )
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? `Edit ${initial.name}` : 'Add acquisition agent'}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button className="flex-1" loading={busy} disabled={!valid} onClick={save}>
            {editing ? 'Save changes' : 'Create agent'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <Input
          id="agent-name"
          label="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <Input
          id="agent-email"
          label="Email"
          inputMode="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <Input
          id="agent-password"
          label={editing ? 'New password' : 'Password'}
          type="password"
          placeholder={editing ? 'Leave blank to keep current' : undefined}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <p className="-mt-1 text-xs font-normal text-muted">
          At least 8 characters, with a letter and a number.
        </p>
        <Select
          id="agent-city"
          label="City"
          value={form.cityId}
          onChange={(e) => setForm({ ...form, cityId: e.target.value })}
        >
          <option value="">Select city…</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Input
          id="agent-pincodes"
          label="Pincodes"
          placeholder="411014, 411057"
          value={form.pincodes}
          onChange={(e) => setForm({ ...form, pincodes: e.target.value })}
        />
        <p className="-mt-1 text-xs font-normal text-muted">
          Comma-separated 6-digit PIN codes the agent covers.
        </p>
        {error && (
          <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>
        )}
      </div>
    </Modal>
  )
}
