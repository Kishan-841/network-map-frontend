'use client'

import { connectionLabel, connectionTone, isOltDown, oltDownTitle, formatOnuSignal } from '@/lib/connection'
import { signalVsUsual, samePonLine } from '@/lib/customer-detail'
import { IconUsers } from '@/components/ui/icons'

const DOT = { ok: 'bg-ok', bad: 'bg-bad', warn: 'bg-warn', muted: 'bg-faint' }
const TEXT = { ok: 'text-ok', bad: 'text-bad', warn: 'text-warn', muted: 'text-muted' }

/** Status dot + word. The word is always shown, so colour is never the only signal. */
export function ConnectionStatus({ connection, className = '' }) {
  const tone = connectionTone(connection)
  return (
    <span
      title={isOltDown(connection) ? oltDownTitle(connection.best?.olt ?? connection.onus?.[0]?.olt) : undefined}
      className={`inline-flex items-center gap-2 text-sm font-medium ${TEXT[tone]} ${className}`}
    >
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

function Row({ label, value, note, noteTone = 'muted' }) {
  if (value == null || value === '') return null
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="shrink-0 text-sm font-normal text-muted">{label}</span>
      <span className="min-w-0 break-words text-right text-sm font-medium">
        {value}
        {note && <span className={`block text-xs font-normal ${TEXT[noteTone]}`}>{note}</span>}
      </span>
    </div>
  )
}

const where = (onu) =>
  [onu.olt, onu.pon != null ? `PON ${onu.pon}` : null, onu.onu != null ? `ONU ${onu.onu}` : null]
    .filter(Boolean)
    .join(' · ')

function OnuBlock({ onu, title, first }) {
  const vs = signalVsUsual(onu)
  const customerIps = Array.isArray(onu.customerIps) ? onu.customerIps.join(', ') : onu.customerIps
  return (
    <div className={first ? 'pt-1' : 'mt-1 border-t border-line/60 pt-2'}>
      {title && <p className="pt-1 text-xs font-medium uppercase tracking-wide text-faint">{title}</p>}
      <Row label="Signal" value={formatOnuSignal(onu)} note={vs?.text} noteTone={vs?.tone} />
      <Row label="Device" value={where(onu)} />
      <Row label="Distance" value={onu.distanceM != null ? `${onu.distanceM} m` : null} />
      <Row label="Last seen" value={onu.lastSeen ? lastSeenFmt.format(new Date(onu.lastSeen)) : null} />
      {/* Technical fields: the server strips them for everyone but ADMIN, so they show only when present. */}
      <Row label="Serial" value={onu.serial} />
      <Row label="Session IP" value={onu.sessionIp} />
      <Row label="Customer IPs" value={customerIps} />
      <Row label="ONU index" value={onu.onuIndex} />
      <Row label="ONU ID" value={onu.onuId} />
      <Row label="OLT ID" value={onu.oltId} />
    </div>
  )
}

/**
 * Live connection of one customer — status, signal against its usual level, device, and how the
 * rest of its PON is doing. Data comes from the page (`state` = { enabled, connection, samePon,
 * failed }); renders nothing while loading or when the feature is off. `checked` is a muted note
 * ("checked 6 min ago").
 */
export function ConnectionCard({ state, checked }) {
  if (!state || state.loading || !state.enabled) return null
  const { connection, failed, samePon } = state
  const onus = connection?.onus ?? []
  const pon = samePonLine(samePon)

  return (
    <section className="mt-6">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">Connection</p>
      <div className="rounded-card bg-card px-5 py-4 shadow-soft">
        {failed ? (
          <p className="text-sm text-muted">Status unavailable</p>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-1">
              <ConnectionStatus connection={connection} className="text-base" />
              {checked && <span className="text-xs text-muted">{checked}</span>}
            </div>
            {connection?.state === 'pending' && <p className="text-xs text-muted">Not checked yet — refresh in a minute</p>}
            {onus.map((onu, i) => (
              <OnuBlock
                key={`${onu.olt}-${onu.pon}-${onu.onu}-${i}`}
                onu={onu}
                title={onus.length > 1 ? `Box ${i + 1}` : null}
                first={i === 0}
              />
            ))}
            {pon && (
              <p className="mt-2 flex items-start gap-2 border-t border-line/60 pt-3 text-sm text-muted">
                <IconUsers className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                <span className="min-w-0">{pon}</span>
              </p>
            )}
          </>
        )}
      </div>
    </section>
  )
}
