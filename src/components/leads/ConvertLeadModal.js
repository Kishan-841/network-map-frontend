'use client'

import { useMemo, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

const PERIODS = [
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'HALF_YEARLY', label: 'Half-yearly' },
  { value: 'YEARLY', label: 'Yearly' },
]

const rupees = (n) => `₹${n.toLocaleString('en-IN')}`

/**
 * What the customer actually bought.
 *
 * Converting a lead is the moment the partner's money is decided, and the
 * lead only ever recorded what the customer ASKED for — the rate card is
 * keyed on speed AND billing period, so neither can be assumed. The speed is
 * prefilled with the ask because it is usually right; the period never is,
 * because nobody has been asked for it before now.
 *
 * The amount is shown live, from the same rate card the calculator quotes, so
 * the person converting sees what the partner will be paid before committing.
 *
 * Mounted only while a lead is being converted, and keyed on that lead — so
 * opening it for a second customer starts genuinely blank rather than
 * inheriting the last one's answers. Resetting by remount beats resetting in
 * an effect: there is no frame where the previous lead's plan is on screen.
 */
export function ConvertLeadModal({ lead, rates, onCancel, onConfirm }) {
  const [speedMbps, setSpeedMbps] = useState(lead?.requirementMbps ?? null)
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
  const ready = speedMbps != null && billingPeriod != null

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await onConfirm({ speedMbps, billingPeriod })
    } catch (err) {
      setError(err?.message ?? 'Could not convert this lead')
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={busy ? () => {} : onCancel}
      title="What plan did they take?"
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-normal text-muted">
            {ready && amount != null ? (
              <>
                Partner earns <span className="font-bold text-ink">{rupees(amount)}</span>
              </>
            ) : ready ? (
              <span className="text-bad">We do not sell that combination</span>
            ) : (
              'Pick a speed and a billing period'
            )}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={confirm} disabled={!ready || amount == null || busy}>
              {busy ? 'Converting…' : 'Confirm'}
            </Button>
          </div>
        </div>
      }
    >
      <p className="text-sm font-normal text-muted">
        {lead?.customerName} signed up. This is what {lead?.partner?.name ?? 'the partner'} will be
        paid, so record the plan they actually took.
      </p>

      <fieldset className="mt-5">
        <legend className="text-xs font-medium uppercase tracking-wide text-faint">Speed</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {speeds.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setSpeedMbps(value)}
              className={`rounded-btn px-3.5 py-2 text-sm font-medium transition-colors ${
                speedMbps === value
                  ? 'bg-primary text-primary-content'
                  : 'bg-paper text-muted hover:text-ink'
              }`}
            >
              {value} Mbps
            </button>
          ))}
        </div>
        {lead?.requirementMbps != null && (
          <p className="mt-2 text-xs font-normal text-faint">
            They asked for {lead.requirementMbps} Mbps
            {speedMbps !== lead.requirementMbps && speedMbps != null
              ? ' — changed to what they signed for'
              : ''}
          </p>
        )}
      </fieldset>

      <fieldset className="mt-5">
        <legend className="text-xs font-medium uppercase tracking-wide text-faint">Billing</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {PERIODS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setBillingPeriod(value)}
              className={`rounded-btn px-3.5 py-2 text-sm font-medium transition-colors ${
                billingPeriod === value
                  ? 'bg-primary text-primary-content'
                  : 'bg-paper text-muted hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      {error && (
        <p className="mt-4 rounded-btn bg-bad-tint px-3 py-2 text-sm font-normal text-bad">
          {error}
        </p>
      )}
    </Modal>
  )
}
