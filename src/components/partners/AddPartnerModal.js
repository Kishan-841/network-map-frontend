'use client'

import { useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Field } from '@/components/ui/Input'

const TYPES = [
  { value: 'AGENT', label: 'Agent' },
  { value: 'SOCIETY_REPRESENTATIVE', label: 'Society rep' },
  { value: 'RETAIL_SHOP', label: 'Retail shop' },
  { value: 'DSA', label: 'DSA' },
]

/**
 * Add a partner you already know, without sending a link.
 *
 * The account exists the moment this saves, and they sign in with the mobile
 * entered here — no link to lose, no signup to complete. Which is why the
 * number is the field worth being careful about: it is their identity rather
 * than a contact detail, and a typo creates an account nobody can reach.
 */
export function AddPartnerModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', type: '', mobile: '', email: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const ready = form.name.trim() && form.type && /^[6-9]\d{9}$/.test(form.mobile)

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await apiClient.post('/partners', {
        name: form.name,
        type: form.type,
        mobile: form.mobile,
        ...(form.email.trim() && { email: form.email.trim() }),
      })
      onCreated(res.data.data)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not add that partner'))
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title="Add a partner"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!ready || busy}>
            {busy ? 'Adding…' : 'Add partner'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <Input
          id="add-partner-name"
          label="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          autoComplete="off"
        />

        <Field label="Type" htmlFor="add-partner-type">
          <div className="flex flex-wrap gap-2" id="add-partner-type">
            {TYPES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                aria-pressed={form.type === value}
                onClick={() => setForm({ ...form, type: value })}
                className={`rounded-btn px-3.5 py-2 text-sm font-medium transition-colors ${
                  form.type === value
                    ? 'bg-primary text-primary-content'
                    : 'bg-paper text-muted hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Mobile number" htmlFor="add-partner-mobile">
          <div className="flex items-stretch">
            <span className="flex items-center rounded-l-btn border border-r-0 border-line bg-paper px-3 text-sm font-medium text-muted">
              +91
            </span>
            <input
              id="add-partner-mobile"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="00000 00000"
              value={form.mobile}
              onChange={(e) =>
                setForm({ ...form, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })
              }
              className="w-full rounded-r-btn border border-line bg-card px-3 py-2.5 text-base tabular-nums outline-none transition-colors focus:border-primary"
            />
          </div>
          <p className="text-xs font-normal text-muted">
            They sign in with this number — check it before saving.
          </p>
        </Field>

        <Input
          id="add-partner-email"
          label="Email (optional)"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          autoComplete="off"
        />

        {error && (
          <p className="rounded-btn bg-bad-tint px-3 py-2 text-sm font-normal text-bad">{error}</p>
        )}
      </div>
    </Modal>
  )
}
