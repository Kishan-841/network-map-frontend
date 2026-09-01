'use client'

import { useMemo, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { LEAD_STATUSES, leadStatusClass, STAFF_LEAD_STATUS_LABEL } from '@/lib/lead-status'

const PERIODS = [
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'HALF_YEARLY', label: 'Half-yearly' },
  { value: 'YEARLY', label: 'Yearly' },
]

const rupees = (n) => `₹${n.toLocaleString('en-IN')}`
const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

const chip = (selected) =>
  `rounded-btn px-3 py-2 text-sm font-medium transition-colors ${
    selected ? 'bg-primary text-primary-content' : 'bg-paper text-muted hover:text-ink'
  }`

/**
 * Working a lead after a call.
 *
 * One place to record what happened, rather than a dropdown that changes the
 * status the instant it is touched: a status change is usually the *outcome*
 * of a conversation, and the note is the part that tells the next person why.
 * Nothing is saved until Save, so a mis-tap costs nothing.
 *
 * Converting folds in here too, because that is when the plan has to be
 * recorded — the earning cannot be priced without it.
 *
 * Mounted only while a lead is open and keyed on it, so the next lead starts
 * blank rather than inheriting this one's note.
 */
export function EditLeadModal({ lead, rates, onCancel, onSave }) {
  const [status, setStatus] = useState(lead.status)
  const [note, setNote] = useState('')
  const [speedMbps, setSpeedMbps] = useState(lead.requirementMbps ?? null)
  const [billingPeriod, setBillingPeriod] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const speeds = useMemo(
    () => [...new Set((rates ?? []).map((r) => r.speedMbps))].sort((a, b) => a - b),
    [rates],
  )
  const amount = useMemo(
    () =>
      rates?.find((r) => r.speedMbps === speedMbps && r.billingPeriod === billingPeriod)?.amount ??
      null,
    [rates, speedMbps, billingPeriod],
  )

  // A plan is needed only when this lead is heading to Converted without an
  // earning already behind it.
  const needsPlan = status === 'CONVERTED' && !lead.earning
  const ready = !needsPlan || (speedMbps != null && billingPeriod != null && amount != null)
  const changed = status !== lead.status || note.trim() !== '' || needsPlan

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      await onSave({
        status,
        note: note.trim() || undefined,
        ...(needsPlan && { plan: { speedMbps, billingPeriod } }),
      })
    } catch (err) {
      setError(err?.message ?? 'Could not save that')
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={busy ? () => {} : onCancel}
      title={lead.customerName}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 text-sm font-normal text-muted">
            {needsPlan && amount != null ? (
              <>
                Partner earns <span className="font-bold text-ink">{rupees(amount)}</span>
              </>
            ) : needsPlan ? (
              'Record the plan they took'
            ) : (
              ''
            )}
          </span>
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!ready || !changed || busy}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      }
    >
      {/* Who this is, so the status is never changed on the wrong row. */}
      <dl className="rounded-btn bg-paper px-3.5 py-3 text-sm">
        {[
          ['Mobile', lead.customerMobile],
          ['Referred by', lead.partner?.name],
          ['Building', lead.building?.buildingName ?? lead.address],
          ['Received', lead.createdAt ? dateFormat.format(new Date(lead.createdAt)) : null],
          lead.earning ? ['Earning', `${rupees(lead.earning.amount)} · ${lead.earning.status === 'PAID' ? 'paid' : 'awaiting payment'}`] : null,
        ]
          .filter((row) => row && row[1])
          .map(([label, value]) => (
            <div key={label} className="flex gap-3 py-0.5">
              <dt className="w-24 shrink-0 font-normal text-faint">{label}</dt>
              <dd className="min-w-0 flex-1 truncate">{value}</dd>
            </div>
          ))}
      </dl>

      <fieldset className="mt-5">
        <legend className="text-xs font-medium uppercase tracking-wide text-faint">Status</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {LEAD_STATUSES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={status === value}
              onClick={() => setStatus(value)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${leadStatusClass(
                value,
              )} ${
                status === value
                  ? 'ring-2 ring-current/60 ring-offset-1 ring-offset-card'
                  : 'opacity-55 hover:opacity-100'
              }`}
            >
              {STAFF_LEAD_STATUS_LABEL[value]}
            </button>
          ))}
        </div>
      </fieldset>

      {needsPlan && (
        <>
          <fieldset className="mt-5">
            <legend className="text-xs font-medium uppercase tracking-wide text-faint">
              Speed they took
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {speeds.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSpeedMbps(value)}
                  className={chip(speedMbps === value)}
                >
                  {value} Mbps
                </button>
              ))}
            </div>
            {lead.requirementMbps != null && (
              <p className="mt-2 text-xs font-normal text-faint">
                They asked for {lead.requirementMbps} Mbps
              </p>
            )}
          </fieldset>

          <fieldset className="mt-5">
            <legend className="text-xs font-medium uppercase tracking-wide text-faint">
              Billing
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {PERIODS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setBillingPeriod(value)}
                  className={chip(billingPeriod === value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
        </>
      )}

      <div className="mt-5">
        <Textarea
          id="lead-note"
          label="What happened on the call? (optional)"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Asked to call back after Diwali"
        />
      </div>

      {error && (
        <p className="mt-2 rounded-btn bg-bad-tint px-3 py-2 text-sm font-normal text-bad">
          {error}
        </p>
      )}
    </Modal>
  )
}
