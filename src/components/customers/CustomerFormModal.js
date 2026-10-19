'use client'

import { useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Input'
import { customerFormErrors, normaliseMobile } from '@/lib/customers'

const STATUS_OPTIONS = ['Active', 'Inactive', 'Suspended']

// The plan's dates are IST wall-clock (the sheet is IST); the browser's
// datetime-local control works in the browser's zone. Convert both ways so the
// instant stored is the IST time the operator typed, whatever the device zone.
const pad = (n) => String(n).padStart(2, '0')
function instantToInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const ist = new Date(d.getTime() + 5.5 * 3600 * 1000)
  return `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())}T${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}`
}
function inputToInstant(value) {
  if (!value) return null
  const d = new Date(`${value}:00+05:30`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
const numOrNull = (value) => (value === '' || value == null ? null : Number(value))

/** Add or edit one customer. `customer` present = edit. */
export function CustomerFormModal({ buildingId, customer, wings = [], onClose, onSaved }) {
  const editing = Boolean(customer)
  const [form, setForm] = useState({
    name: customer?.name ?? '',
    mobile: customer?.mobile ?? '',
    email: customer?.email ?? '',
    address: customer?.address ?? '',
    username: customer?.username ?? '',
    site: customer?.site ?? '',
    operator: customer?.operator ?? '',
    networkZone: customer?.networkZone ?? '',
    status: customer?.status ?? '',
    planName: customer?.planName ?? '',
    planAmount: customer?.planAmount != null ? String(customer.planAmount) : '',
    planValidityDays: customer?.planValidityDays != null ? String(customer.planValidityDays) : '',
    autoRenewal: customer?.autoRenewal == null ? '' : customer.autoRenewal ? 'yes' : 'no',
    planActivatedAt: instantToInput(customer?.planActivatedAt),
    planExpiresAt: instantToInput(customer?.planExpiresAt),
    ageingDays: customer?.ageingDays != null ? String(customer.ageingDays) : '',
    wingId: customer?.wing?.id ?? '',
    ponNumber: customer?.ponNumber ?? '',
    olt: customer?.olt ?? '',
  })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  async function handleSave() {
    const problems = customerFormErrors(form)
    if (problems.length) return setError(problems[0])
    setBusy(true)
    setError(null)
    const payload = {
      name: form.name.trim(),
      mobile: normaliseMobile(form.mobile),
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      username: form.username.trim() || null,
      site: form.site.trim() || null,
      operator: form.operator.trim() || null,
      networkZone: form.networkZone.trim() || null,
      status: form.status.trim() || null,
      planName: form.planName.trim() || null,
      planAmount: numOrNull(form.planAmount),
      planValidityDays: numOrNull(form.planValidityDays),
      autoRenewal: form.autoRenewal === 'yes' ? true : form.autoRenewal === 'no' ? false : null,
      planActivatedAt: inputToInstant(form.planActivatedAt),
      planExpiresAt: inputToInstant(form.planExpiresAt),
      ageingDays: numOrNull(form.ageingDays),
      ponNumber: form.ponNumber.trim() || null,
      olt: form.olt.trim() || null,
    }
    if (wings.length > 0) payload.wingId = form.wingId || null
    try {
      if (editing) await apiClient.patch(`/customers/${customer.id}`, payload)
      else await apiClient.post('/customers', { ...payload, buildingId })
      onSaved()
    } catch (err) {
      setBusy(false)
      setError(getApiErrorMessage(err, 'Could not save the customer'))
    }
  }

  const footer = (
    <div className="flex justify-end gap-2">
      <Button variant="secondary" disabled={busy} onClick={onClose}>
        Cancel
      </Button>
      <Button loading={busy} onClick={handleSave}>
        {editing ? 'Save changes' : 'Add customer'}
      </Button>
    </div>
  )

  return (
    <Modal open onClose={busy ? undefined : onClose} title={editing ? 'Edit customer' : 'Add customer'} footer={footer}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Name *" value={form.name} onChange={set('name')} autoFocus />
          <Input label="Mobile *" value={form.mobile} onChange={set('mobile')} inputMode="tel" placeholder="10-digit number" />
          <Input label="E-Mail" type="email" value={form.email} onChange={set('email')} />
          <Input label="Username" value={form.username} onChange={set('username')} />
          <Input label="Site" value={form.site} onChange={set('site')} />
          <Input label="Operator" value={form.operator} onChange={set('operator')} />
          <Input label="Network zone" value={form.networkZone} onChange={set('networkZone')} placeholder="As on the bill" />
          <div className="sm:col-span-2">
            <Textarea label="Address" rows={2} value={form.address} onChange={set('address')} />
          </div>
          {wings.length > 0 && (
            <Select label="Wing" value={form.wingId} onChange={set('wingId')}>
              <option value="">No wing</option>
              {wings.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          )}
          <Input label="PON number" value={form.ponNumber} onChange={set('ponNumber')} />
          <Input label="OLT" value={form.olt} onChange={set('olt')} />
        </div>

        <p className="text-xs font-medium uppercase tracking-wide text-faint">Plan</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input label="Plan name" value={form.planName} onChange={set('planName')} />
          </div>
          <Input label="Amount (₹)" type="number" min="0" value={form.planAmount} onChange={set('planAmount')} />
          <Input label="Validity (days)" type="number" min="0" value={form.planValidityDays} onChange={set('planValidityDays')} />
          <Input label="Activation date" type="datetime-local" value={form.planActivatedAt} onChange={set('planActivatedAt')} />
          <Input label="Expiry date" type="datetime-local" value={form.planExpiresAt} onChange={set('planExpiresAt')} />
          <Input label="Ageing (days)" type="number" min="0" value={form.ageingDays} onChange={set('ageingDays')} />
          <Select label="Status" value={form.status} onChange={set('status')}>
            <option value="">—</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
        <Select label="Auto renewal" value={form.autoRenewal} onChange={set('autoRenewal')}>
          <option value="">Not set</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </Select>

        {error && <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>}
      </div>
    </Modal>
  )
}
