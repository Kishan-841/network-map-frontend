'use client'

import { useEffect, useRef, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Textarea, Field } from '@/components/ui/Input'

const OUTCOMES = [
  { value: 'INTERESTED', label: 'Interested', tone: 'bg-ok-tint text-ok ring-ok/50' },
  { value: 'CALL_LATER', label: 'Call later', tone: 'bg-warn-tint text-warn ring-warn/50' },
  { value: 'NOT_REACHABLE', label: 'Not reachable', tone: 'bg-paper text-muted ring-muted/40' },
  { value: 'WRONG_NUMBER', label: 'Wrong number', tone: 'bg-bad-tint text-bad ring-bad/50' },
]

const two = (n) => String(n).padStart(2, '0')
const clock = (s) => `${two(Math.floor(s / 60))}:${two(s % 60)}`

/** Local datetime string for an <input type="datetime-local"> value. */
const localInput = (d) =>
  `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}T${two(d.getHours())}:${two(
    d.getMinutes(),
  )}`

/**
 * Making a call and recording what happened.
 *
 * Three states, in order: before, during, after. The timer runs in the
 * browser and only the two timestamps are sent — the server derives the
 * duration, so nothing here can claim a call length that did not happen.
 *
 * Nothing is saved until an outcome is chosen. A call with no outcome tells
 * the next person nothing, and a record created at "start" would dangle
 * forever the moment a tab is closed mid-call.
 */
export function CallLeadModal({ lead, onClose, onLogged, submit }) {
  const [startedAt, setStartedAt] = useState(null)
  const [endedAt, setEndedAt] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [outcome, setOutcome] = useState(null)
  const [callbackAt, setCallbackAt] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const timer = useRef(null)

  // Ticks only while the call is running; cleared on end and on unmount.
  useEffect(() => {
    if (!startedAt || endedAt) return undefined
    timer.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000))
    }, 1000)
    return () => clearInterval(timer.current)
  }, [startedAt, endedAt])

  const start = () => {
    setStartedAt(new Date())
    setElapsed(0)
  }
  const end = () => {
    const now = new Date()
    setEndedAt(now)
    setElapsed(Math.floor((now - startedAt.getTime()) / 1000))
    clearInterval(timer.current)
  }

  const needsCallback = outcome === 'CALL_LATER'
  const ready = Boolean(endedAt && outcome && (!needsCallback || callbackAt))

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      await submit({
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        outcome,
        ...(needsCallback && { callbackAt: new Date(callbackAt).toISOString() }),
        ...(note.trim() && { note: note.trim() }),
      })
      onLogged(outcome)
    } catch (err) {
      setError(err?.message ?? 'Could not save that call')
      setBusy(false)
    }
  }

  // A sensible default: tomorrow, same time, rounded to the minute.
  const defaultCallback = () => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return localInput(d)
  }

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title={`Call ${lead.customerName}`}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-normal tabular-nums text-muted">
            {startedAt && `${endedAt ? 'Call lasted' : 'On call'} ${clock(elapsed)}`}
          </span>
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              {endedAt ? 'Cancel' : 'Close'}
            </Button>
            {!startedAt && <Button onClick={start}>Start call</Button>}
            {startedAt && !endedAt && <Button onClick={end}>End call</Button>}
            {endedAt && (
              <Button onClick={save} disabled={!ready || busy}>
                {busy ? 'Saving…' : 'Save'}
              </Button>
            )}
          </div>
        </div>
      }
    >
      {/* A real tel: link — on a laptop it hands off to the phone, and on a
          handset it dials. Reading a number off the screen invites a misdial. */}
      <a
        href={`tel:+91${lead.customerMobile}`}
        className="flex items-center justify-between gap-3 rounded-btn bg-paper px-4 py-3 transition-colors hover:bg-primary/10"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{lead.customerName}</span>
          <span className="block truncate text-xs font-normal text-muted">
            {lead.partner?.name ? `from ${lead.partner.name}` : 'Customer'}
          </span>
        </span>
        <span className="shrink-0 text-lg font-bold tabular-nums text-primary">
          +91 {lead.customerMobile}
        </span>
      </a>

      {!startedAt && (
        <p className="mt-4 text-sm font-normal text-muted">
          Press start when the call connects. Nothing is saved until you record what happened.
        </p>
      )}

      {startedAt && !endedAt && (
        <div className="mt-6 text-center">
          <p className="text-5xl font-bold tabular-nums">{clock(elapsed)}</p>
          <p className="mt-1 text-sm font-normal text-muted">Call in progress</p>
        </div>
      )}

      {endedAt && (
        <>
          <fieldset className="mt-5">
            <legend className="text-xs font-medium uppercase tracking-wide text-faint">
              What happened?
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {OUTCOMES.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={outcome === o.value}
                  onClick={() => {
                    setOutcome(o.value)
                    if (o.value === 'CALL_LATER' && !callbackAt) setCallbackAt(defaultCallback())
                  }}
                  className={`rounded-btn px-3 py-2.5 text-sm font-medium transition-all ${o.tone} ${
                    outcome === o.value ? 'ring-2 ring-offset-1 ring-offset-card' : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </fieldset>

          {needsCallback && (
            <div className="mt-5">
              <Field label="Call back on" htmlFor="callback-at">
                <input
                  id="callback-at"
                  type="datetime-local"
                  min={localInput(new Date())}
                  value={callbackAt}
                  onChange={(e) => setCallbackAt(e.target.value)}
                  className="w-full rounded-btn border border-line bg-card px-3 py-2.5 text-base outline-none transition-colors focus:border-primary"
                />
                <p className="text-xs font-normal text-muted">
                  They stay on your list and show as due at this time.
                </p>
              </Field>
            </div>
          )}

          <div className="mt-5">
            <Textarea
              id="call-note"
              label="Note (optional)"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Wants 200 Mbps, asked about installation"
            />
          </div>
        </>
      )}

      {error && (
        <p className="mt-4 rounded-btn bg-bad-tint px-3 py-2 text-sm font-normal text-bad">
          {error}
        </p>
      )}
    </Modal>
  )
}
