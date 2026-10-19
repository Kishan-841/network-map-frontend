'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import {
  connectionLabel,
  connectionTone,
  droppedText,
  formatOnuSignal,
} from '@/lib/connection'

const DOT = { ok: 'bg-ok', bad: 'bg-bad', warn: 'bg-warn', muted: 'bg-faint' }
const TEXT = { ok: 'text-ok', bad: 'text-bad', warn: 'text-warn', muted: 'text-muted' }

/** Status dot + word. The word is always shown, so colour is never the only signal. */
export function ConnectionStatus({ connection, className = '' }) {
  const tone = connectionTone(connection)
  return (
    <span className={`inline-flex items-center gap-2 text-sm font-medium ${TEXT[tone]} ${className}`}>
      <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${DOT[tone]}`} />
      {connectionLabel(connection)}
    </span>
  )
}

const lastSeenFmt = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Kolkata',
})

function Row({ label, value }) {
  if (value == null || value === '') return null
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="shrink-0 text-sm font-normal text-muted">{label}</span>
      <span className="break-all text-right text-sm font-medium">{value}</span>
    </div>
  )
}

function OnuBlock({ connection, onu, isAdmin, first }) {
  const signal = formatOnuSignal(onu)
  const dropped = droppedText(connection, onu)
  const customerIps = Array.isArray(onu.customerIps) ? onu.customerIps.join(', ') : onu.customerIps
  return (
    <div className={first ? '' : 'border-t border-line/60'}>
      <Row label="Signal" value={signal} />
      {dropped && <p className="pb-1 text-right text-xs text-warn">{dropped}</p>}
      <Row label="OLT" value={onu.olt} />
      <Row label="PON" value={onu.pon} />
      <Row label="ONU" value={onu.onu} />
      <Row label="Distance" value={onu.distanceM != null ? `${onu.distanceM} m` : null} />
      <Row label="Last seen" value={onu.lastSeen ? lastSeenFmt.format(new Date(onu.lastSeen)) : null} />
      {isAdmin && (
        <>
          <Row label="Serial" value={onu.serial} />
          <Row label="Session IP" value={onu.sessionIp} />
          <Row label="Customer IPs" value={customerIps} />
          <Row label="ONU index" value={onu.onuIndex} />
          <Row label="ONU ID" value={onu.onuId} />
          <Row label="OLT ID" value={onu.oltId} />
        </>
      )}
    </div>
  )
}

/**
 * Live connection of one customer (status, signal, OLT/PON/ONU). Renders
 * nothing when the feature is off; shows "Status unavailable" if the request fails.
 */
export function ConnectionCard({ customerId, isAdmin = false }) {
  const [state, setState] = useState({ loading: true, enabled: false, connection: null, failed: false })

  useEffect(() => {
    let alive = true
    apiClient
      .get(`/customers/${customerId}/connection`)
      .then((res) => {
        if (!alive) return
        const d = res.data.data
        setState({ loading: false, enabled: Boolean(d?.enabled), connection: d?.connection ?? null, failed: false })
      })
      .catch((err) => {
        if (!alive) return
        // 404: the customer is gone or out of scope: show nothing.
        if (err?.response?.status === 404) setState({ loading: false, enabled: false, connection: null, failed: false })
        else setState({ loading: false, enabled: true, connection: null, failed: true })
      })
    return () => {
      alive = false
    }
  }, [customerId])

  // Nothing until the first answer: no flash of a card that then vanishes when the feature is off.
  if (state.loading || !state.enabled) return null

  const { connection, failed } = state
  const onus = connection?.onus ?? []

  return (
    <section className="mt-5">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">Connection status</p>
      <div className="rounded-card bg-card px-5 py-3 shadow-soft">
        {failed ? (
          <p className="text-sm text-muted">Status unavailable</p>
        ) : (
          <>
            <div className="py-1">
              <ConnectionStatus connection={connection} />
            </div>
            {onus.map((onu, i) => (
              <OnuBlock
                key={`${onu.olt}-${onu.pon}-${onu.onu}-${i}`}
                connection={connection}
                onu={onu}
                isAdmin={isAdmin}
                first={i === 0}
              />
            ))}
          </>
        )}
      </div>
    </section>
  )
}
