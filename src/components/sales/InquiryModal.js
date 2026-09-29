'use client'

import { useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { LEAD_STATUSES } from '@/lib/sales-lead-status'

/**
 * Raise a customer inquiry from the field. Deliberately short — the calling team
 * collects the rest. Building + address are shown read-only and sent by id; the
 * server snapshots the address.
 */
export function InquiryModal({ building, visitId, onClose, onDone }) {
  const [form, setForm] = useState({ customerName: '', phone: '', email: '', status: 'NOT_CONTACTED', followUpAt: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))
  const needsFollowUp = form.status === 'FOLLOW_UP'
  const valid = form.customerName.trim() && form.phone.trim().length >= 6 && (!needsFollowUp || form.followUpAt)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await apiClient.post('/sales/inquiries', {
        buildingId: building.id,
        customerName: form.customerName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        status: form.status,
        ...(needsFollowUp ? { followUpAt: new Date(form.followUpAt).toISOString() } : {}),
        ...(visitId ? { visitId } : {}),
      })
      onDone()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save the inquiry'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title="New customer inquiry"
      footer={
        <Button type="submit" form="inquiry-form" fullWidth loading={busy} disabled={!valid || busy}>
          Create inquiry
        </Button>
      }
    >
      <form id="inquiry-form" onSubmit={submit} className="flex flex-col gap-3">
        <div className="rounded-btn bg-paper px-4 py-3">
          <p className="text-sm font-medium text-ink">{building.buildingName}</p>
          <p className="text-sm font-normal text-muted">{building.formattedAddress}</p>
        </div>
        <Input id="c-name" label="Customer name" value={form.customerName} onChange={set('customerName')} required />
        <Input
          id="c-phone"
          label="Phone number"
          type="tel"
          inputMode="tel"
          value={form.phone}
          onChange={set('phone')}
          required
        />
        <Input id="c-email" label="Email (optional)" type="email" value={form.email} onChange={set('email')} />
        <Select id="c-status" label="Status" value={form.status} onChange={set('status')}>
          {LEAD_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
        {needsFollowUp && (
          <Input
            id="c-followup"
            label="Follow up on"
            type="datetime-local"
            value={form.followUpAt}
            onChange={set('followUpAt')}
            required
          />
        )}
        {error && <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>}
      </form>
    </Modal>
  )
}
