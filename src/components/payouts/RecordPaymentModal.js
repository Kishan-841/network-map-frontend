'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Field, Textarea } from '@/components/ui/Input'

export const METHODS = [
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'UPI', label: 'UPI' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'CASH', label: 'Cash' },
  { value: 'OTHER', label: 'Other' },
]
/** Cash is the only route with nothing to quote back. */
const NEEDS_REFERENCE = ['BANK_TRANSFER', 'UPI', 'CHEQUE']

const rupees = (n) => `₹${(n ?? 0).toLocaleString('en-IN')}`
const today = () => new Date().toISOString().slice(0, 10)

const monthLabel = (key) => {
  const [y, m] = String(key).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/**
 * The payment entry.
 *
 * Not a confirmation — a record. What moved, by what route, and the reference
 * the partner can check against their bank; "paid" without those is a claim
 * nobody can verify.
 *
 * The amount is prefilled with what is owed but stays editable, so a part
 * payment is recorded as one rather than being rounded away. The difference
 * is shown as you type, because a mismatch should be a deliberate act.
 */
export function RecordPaymentModal({ row, onClose, onRecorded, submit }) {
  const [form, setForm] = useState({
    amountPaid: String(row.amount),
    method: 'BANK_TRANSFER',
    reference: '',
    paidOn: today(),
    note: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const amount = Number(form.amountPaid)
  const validAmount = Number.isFinite(amount) && amount > 0
  const needsRef = NEEDS_REFERENCE.includes(form.method)
  const ready = validAmount && form.paidOn && (!needsRef || form.reference.trim())
  const difference = validAmount ? row.amount - amount : 0

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      await submit({
        partnerId: row.partnerId,
        month: row.month,
        amountPaid: amount,
        method: form.method,
        ...(form.reference.trim() && { reference: form.reference.trim() }),
        ...(form.note.trim() && { note: form.note.trim() }),
        paidOn: form.paidOn,
      })
      onRecorded()
    } catch (err) {
      setError(err?.message ?? 'Could not record that payment')
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title={`Pay ${row.partnerName}`}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 text-sm font-normal text-muted">
            {difference > 0 ? (
              <span className="text-warn">{rupees(difference)} short of what is owed</span>
            ) : difference < 0 ? (
              <span className="text-warn">{rupees(-difference)} more than is owed</span>
            ) : (
              ''
            )}
          </span>
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!ready || busy}>
              {busy ? 'Saving…' : 'Save payment'}
            </Button>
          </div>
        </div>
      }
    >
      <dl className="rounded-btn bg-paper px-3.5 py-3 text-sm">
        {[
          ['Month', monthLabel(row.month)],
          ['Customers', String(row.count)],
          ['Owed', rupees(row.amount)],
          ['Mobile', row.partnerMobile ? `+91 ${row.partnerMobile}` : null],
          ['Pay to', row.bankAccount?.accountHolderName ?? 'No bank details on file'],
          ['Account', row.bankAccount?.accountNumber ?? null],
          ['IFSC', row.bankAccount ? [row.bankAccount.ifsc, row.bankAccount.bankName, row.bankAccount.branchName].filter(Boolean).join(' · ') : null],
        ]
          .filter(([, v]) => v)
          .map(([label, value]) => (
            <div key={label} className="flex gap-3 py-0.5">
              <dt className="w-24 shrink-0 font-normal text-faint">{label}</dt>
              <dd className="min-w-0 flex-1 truncate">{value}</dd>
            </div>
          ))}
      </dl>

      <div className="mt-5 flex flex-col gap-5">
        <Field label="Amount paid" htmlFor="pay-amount">
          <div className="flex items-stretch">
            <span className="flex items-center rounded-l-btn border border-r-0 border-line bg-paper px-3 text-sm font-medium text-muted">
              ₹
            </span>
            <input
              id="pay-amount"
              inputMode="numeric"
              value={form.amountPaid}
              onChange={(e) =>
                setForm({ ...form, amountPaid: e.target.value.replace(/[^\d]/g, '') })
              }
              className="w-full rounded-r-btn border border-line bg-card px-3 py-2.5 text-base font-bold tabular-nums outline-none transition-colors focus:border-primary"
            />
          </div>
        </Field>

        <Field label="How it was paid" htmlFor="pay-method">
          <div className="flex flex-wrap gap-2" id="pay-method">
            {METHODS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                aria-pressed={form.method === value}
                onClick={() => setForm({ ...form, method: value })}
                className={`rounded-btn px-3.5 py-2 text-sm font-medium transition-colors ${
                  form.method === value
                    ? 'bg-primary text-primary-content'
                    : 'bg-paper text-muted hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>

        <Input
          id="pay-reference"
          label={needsRef ? 'Reference' : 'Reference (optional)'}
          placeholder={
            form.method === 'CHEQUE' ? 'Cheque number' : form.method === 'UPI' ? 'UPI transaction id' : 'UTR / transaction id'
          }
          value={form.reference}
          onChange={(e) => setForm({ ...form, reference: e.target.value })}
          autoComplete="off"
        />
        {needsRef && (
          <p className="-mt-3 text-xs font-normal text-muted">
            So the partner can check it against their statement.
          </p>
        )}

        <Input
          id="pay-date"
          label="Paid on"
          type="date"
          max={today()}
          value={form.paidOn}
          onChange={(e) => setForm({ ...form, paidOn: e.target.value })}
        />

        <Textarea
          id="pay-note"
          label="Note (optional)"
          rows={2}
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
        />

        {error && (
          <p className="rounded-btn bg-bad-tint px-3 py-2 text-sm font-normal text-bad">{error}</p>
        )}
      </div>
    </Modal>
  )
}
