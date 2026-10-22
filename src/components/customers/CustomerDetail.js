'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Toast } from '@/components/ui/Toast'
import {
  IconArrowLeft,
  IconCopy,
  IconEdit,
  IconMessage,
  IconNavigate,
  IconPhone,
  IconRefresh,
  IconWarn,
  IconChevronDown,
  IconExternal,
} from '@/components/ui/icons'
import { useAuthStore } from '@/stores/auth-store'
import { CustomerFormModal } from '@/components/customers/CustomerFormModal'
import { ConnectionCard } from '@/components/customers/ConnectionCard'
import { checkedAgo, connShort, connTone } from '@/lib/customer-filters'
import {
  customerAlerts,
  directionsUrl,
  effectiveConnection,
  planProgress,
  planTimeText,
  telUrl,
  whatsappUrl,
} from '@/lib/customer-detail'

const dateOnly = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
})
const fmtDate = (iso) => (iso ? dateOnly.format(new Date(iso)) : null)
const rupees = (n) => `₹${Number(n).toLocaleString('en-IN')}`
const days = (n) => (n == null ? null : `${n} day${n === 1 ? '' : 's'}`)
const capitalise = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

const TEXT = { ok: 'text-ok', bad: 'text-bad', warn: 'text-warn', muted: 'text-muted' }
const DOT = { ok: 'bg-ok', bad: 'bg-bad', warn: 'bg-warn', muted: 'bg-faint' }
const CHIP = { bad: 'bg-bad-tint text-bad', warn: 'bg-warn-tint text-warn', muted: 'bg-line/60 text-muted' }
const BAR = { bad: 'bg-bad', warn: 'bg-warn' }

const COOLDOWN_MS = 30000
const REFRESH_NOTE = {
  limited: 'Too many refreshes — try again in a minute',
  failed: 'Could not refresh — try again',
  pending: 'Not checked yet — try again in a minute',
}

/** Copy text: the async clipboard where allowed, else a hidden textarea + execCommand. */
async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to the old way (insecure origin, denied permission)
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}

function SectionTitle({ children }) {
  return <p className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">{children}</p>
}

function Row({ label, children }) {
  if (children == null || children === '') return null
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-line/60 py-3 first:border-t-0">
      <span className="shrink-0 text-sm font-normal text-muted">{label}</span>
      <span className="min-w-0 break-words text-right text-sm font-medium">{children}</span>
    </div>
  )
}

/** One of the three facts under the name: small label, a value line, a muted second line. */
function Fact({ label, value, sub, tone, dot }) {
  return (
    <div className="min-w-0 px-3 py-3 first:pl-4 last:pr-4 sm:px-5 sm:first:pl-5 sm:last:pr-5 xl:px-4 xl:py-2.5 xl:first:pl-4 xl:last:pr-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-faint">{label}</p>
      <p className={`mt-1 flex items-center gap-1.5 text-sm font-semibold leading-snug ${tone ? TEXT[tone] : ''}`}>
        {dot && <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${DOT[dot]}`} />}
        <span className="min-w-0">{value}</span>
      </p>
      {sub && <p className="mt-0.5 truncate text-xs text-muted">{sub}</p>}
    </div>
  )
}

/** A quick action: icon over a short label, as a link or a button. */
function Action({ icon: Icon, label, href, onClick, external, disabled, spinning, primary, className = '' }) {
  const cls = `flex min-h-[72px] min-w-0 flex-1 flex-col items-center justify-center gap-1.5 rounded-card bg-card px-2 py-3 text-xs font-medium shadow-soft xl:min-h-[68px] xl:rounded-btn xl:border xl:border-line xl:py-2.5 xl:shadow-none transition-colors duration-200 ${
    disabled ? 'cursor-not-allowed text-faint' : 'text-ink hover:text-fiber xl:hover:bg-paper'
  } ${primary ? 'xl:border-fiber/30 xl:bg-fiber-tint' : ''} ${className}`
  const inner = (
    <>
      <Icon
        className={`h-5 w-5 ${disabled ? '' : 'text-fiber'} ${spinning ? 'animate-spin' : ''}`}
        strokeWidth={1.8}
        aria-hidden="true"
      />
      <span className="max-w-full text-center leading-tight">{label}</span>
    </>
  )
  if (href) {
    return (
      <a href={href} className={cls} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        {inner}
      </a>
    )
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      {inner}
    </button>
  )
}

/** The phone's sticky bar button. */
function BarButton({ icon: Icon, label, href, external, primary }) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={`btn h-11 min-h-11 flex-1 gap-2 rounded-btn px-2 text-sm font-medium normal-case ${
        primary ? 'btn-primary' : 'btn-outline'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
      {label}
    </a>
  )
}

/**
 * One customer: a summary header (facts + alert chips), quick actions, live connection with
 * the rest of its PON, plan progress and location. Shared by the building route and the
 * Customers-tab route; each passes its own back link. Edit (ADMIN) opens the form modal.
 */
export function CustomerDetail(props) {
  // A different customer starts from a clean slate (no stale connection or cooldown).
  return <CustomerPage key={props.customerId} {...props} />
}

function CustomerPage({ customerId, backHref, backLabel = 'Customers' }) {
  const [customer, setCustomer] = useState(null)
  const [loadedAt, setLoadedAt] = useState(null)
  const [error, setError] = useState(null)
  const [conn, setConn] = useState({ loading: true, enabled: false, connection: null, samePon: null, failed: false })
  const [editOpen, setEditOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const [refresh, setRefresh] = useState({ busy: false, cooldown: false, note: null })
  const cooldownTimer = useRef(null)
  const alive = useRef(true)
  const isAdmin = useAuthStore((s) => s.user?.role) === 'ADMIN'

  // `quiet` (the re-fetch after a refresh) never turns the page into "Not found".
  const loadCustomer = useCallback(
    (quiet = false) =>
      apiClient
        .get(`/customers/${customerId}`)
        .then((res) => {
          if (!alive.current) return
          setCustomer(res.data.data)
          setLoadedAt(Date.now())
        })
        .catch((err) => alive.current && !quiet && setError(getApiErrorMessage(err, 'Customer not found'))),
    [customerId],
  )

  const loadConnection = useCallback(
    () =>
      apiClient
        .get(`/customers/${customerId}/connection`)
        .then((res) => {
          if (!alive.current) return
          const d = res.data.data
          setConn({
            checkedAt: Date.now(),
            loading: false,
            enabled: Boolean(d?.enabled),
            connection: d?.connection ?? null,
            samePon: d?.samePon ?? null,
            failed: false,
          })
        })
        .catch((err) => {
          if (!alive.current) return
          // 404: the customer is gone or out of scope: show no card.
          if (err?.response?.status === 404) setConn({ loading: false, enabled: false, connection: null, samePon: null, failed: false })
          else setConn({ loading: false, enabled: true, connection: null, samePon: null, failed: true })
        }),
    [customerId],
  )

  useEffect(() => {
    alive.current = true
    loadCustomer()
    loadConnection()
    return () => {
      alive.current = false
      clearTimeout(cooldownTimer.current)
    }
  }, [loadCustomer, loadConnection])

  const startCooldown = (ms) => {
    clearTimeout(cooldownTimer.current)
    cooldownTimer.current = setTimeout(
      () => alive.current && setRefresh((r) => ({ ...r, cooldown: false, note: null })),
      ms,
    )
  }

  const runRefresh = async () => {
    setRefresh((r) => ({ ...r, busy: true, note: null }))
    try {
      const res = await apiClient.post('/customers/refresh', { ids: [customerId], force: true })
      const pending = (res.data.data?.pending ?? []).includes(customerId)
      await Promise.all([loadConnection(), loadCustomer(true)])
      if (!alive.current) return
      setRefresh({ busy: false, cooldown: true, note: pending ? 'pending' : null })
      startCooldown(COOLDOWN_MS)
    } catch (err) {
      if (!alive.current) return
      const limited = err?.response?.status === 429
      setRefresh({ busy: false, cooldown: limited, note: limited ? 'limited' : 'failed' })
      if (limited) {
        const secs = Number(err.response?.headers?.['retry-after'])
        startCooldown(Number.isFinite(secs) && secs > 0 ? secs * 1000 : COOLDOWN_MS)
      }
    }
  }

  const copyUsername = async () => {
    const ok = await copyText(customer.username)
    setToast(ok ? { message: 'Username copied', tone: 'ok' } : { message: `Could not copy — ${customer.username}`, tone: 'info' })
  }

  if (error) {
    return (
      <main className="mx-auto max-w-2xl">
        <PageHeader backHref={backHref} backLabel={backLabel} title="Not found" sub={error} />
      </main>
    )
  }

  if (!customer) {
    return (
      <main className="mx-auto max-w-2xl">
        <div className="animate-pulse">
          <div className="h-4 w-24 rounded bg-line/70" />
          <div className="mt-6 h-7 w-1/2 rounded bg-line" />
          <div className="mt-3 h-4 w-3/4 rounded bg-line/70" />
          <div className="mt-6 h-20 rounded-card bg-line/40" />
          <div className="mt-4 h-20 rounded-card bg-line/40" />
          <div className="mt-6 h-48 rounded-card bg-line/40" />
        </div>
      </main>
    )
  }

  const now = loadedAt
  const building = customer.building
  const live = conn.enabled && !conn.failed ? conn.connection : null
  const eff = effectiveConnection(customer, live)
  const alerts = customerAlerts(customer, live, now)

  // Facts
  const short = connShort(
    {
      state: eff?.state,
      lastSeen: eff?.best?.lastSeen,
      checkedAt: eff?.live ? conn.checkedAt : customer.connCheckedAt,
      oltReachable: eff?.oltReachable,
    },
    now,
  )
  const checked = conn.failed ? null : eff?.live ? conn.checkedAt : customer.connCheckedAt
  const tone = eff ? connTone({ connState: eff.state }) : 'muted'
  const rx = eff?.best?.rxDbm
  const planTime = planTimeText(customer.planExpiresAt, now)
  const progress = planProgress(customer.planActivatedAt, customer.planExpiresAt, now)

  // Actions
  const hasUsername = Boolean(customer.username && String(customer.username).trim())
  const tel = telUrl(customer.mobile)
  const wa = whatsappUrl(customer.mobile)
  const dir = directionsUrl(building?.latitude, building?.longitude)
  const canRefresh = hasUsername && conn.enabled
  const hasBar = Boolean(tel || wa || dir)
  const refreshLabel = refresh.busy ? 'Checking…' : refresh.cooldown ? (refresh.note === 'limited' ? 'Wait a moment' : 'Refreshed') : 'Refresh status'

  const buildingCustomersHref = building ? `/buildings/${building.id}/customers` : null
  const place = [building?.buildingName, customer.wing?.name].filter(Boolean).join(' · ')
  const amount = Number(customer.planAmount) > 0 ? rupees(customer.planAmount) : null
  const statusTone = /^active$/i.test(customer.status ?? '') ? 'bg-ok-tint text-ok' : 'bg-line/60 text-muted'

  return (
    <main
      className={`mx-auto max-w-2xl xl:grid xl:max-w-6xl xl:grid-cols-[320px_minmax(0,1fr)] xl:items-start xl:gap-8 ${
        hasBar ? 'pb-20 sm:pb-0' : ''
      }`}
    >
      {/* Left (laptop): fixed summary column. Below lg it is just the top of the page. */}
      <div className="xl:sticky xl:top-9 xl:-m-3 xl:flex xl:max-h-[calc(100dvh-3rem)] xl:flex-col xl:self-start xl:overflow-y-auto xl:p-3">
      {/* Header */}
      <header className="mb-5 xl:contents">
        <Link
          href={backHref}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors duration-200 hover:text-fiber"
        >
          <IconArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
        <h1 className="break-words text-2xl font-bold tracking-tight lg:text-[28px]">{customer.name}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
          {hasUsername ? (
            <button
              type="button"
              onClick={copyUsername}
              title="Copy username"
              className="inline-flex items-center gap-1.5 font-mono text-[13px] transition-colors duration-200 hover:text-fiber"
            >
              {customer.username}
              <IconCopy className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
            </button>
          ) : (
            <span>No username</span>
          )}
          {place && (
            <>
              <span aria-hidden="true" className="text-faint">
                ·
              </span>
              {buildingCustomersHref ? (
                <Link href={buildingCustomersHref} className="font-medium text-ink transition-colors duration-200 hover:text-fiber">
                  {place}
                </Link>
              ) : (
                <span className="font-medium text-ink">{place}</span>
              )}
            </>
          )}
        </p>

        <div className="mt-4 grid grid-cols-3 divide-x divide-line/60 rounded-card xl:grid-cols-1 xl:divide-x-0 xl:divide-y bg-card shadow-soft">
          <Fact
            label="Connection"
            value={eff ? short.word : '—'}
            sub={eff ? (eff.live && eff.state !== 'not_seen' ? 'Live' : short.note) : null}
            tone={eff ? tone : 'muted'}
            dot={eff ? tone : null}
          />
          <Fact
            label="Signal"
            value={rx != null ? `${Number(rx).toFixed(1)} dBm` : '—'}
            sub={capitalise(eff?.best?.rxQuality)}
            tone={rx == null ? 'muted' : eff?.weak ? 'warn' : null}
          />
          <Fact
            label="Plan"
            value={planTime?.text ?? '—'}
            sub={customer.planName}
            tone={planTime ? planTime.tone : 'muted'}
          />
        </div>

        {alerts.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2 xl:order-3" aria-label="Alerts">
            {alerts.map((a) => (
              <li
                key={a.id}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${CHIP[a.tone]}`}
              >
                {a.tone !== 'muted' && <IconWarn className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />}
                {a.text}
              </li>
            ))}
          </ul>
        )}
      </header>

      {/* Quick actions — Call / WhatsApp / Directions move to the sticky bar on phones */}
      {toast && (
        <Toast key={toast.message} message={toast.message} tone={toast.tone} onDone={() => setToast(null)} />
      )}
      <div className="flex gap-2 sm:gap-3 xl:order-2 xl:mt-4 xl:grid xl:grid-cols-2 xl:gap-2">
        {tel && <Action icon={IconPhone} label="Call" href={tel} primary className="hidden sm:flex" />}
        {wa && <Action icon={IconMessage} label="WhatsApp" href={wa} external className="hidden sm:flex" />}
        {dir && <Action icon={IconNavigate} label="Directions" href={dir} external className="hidden sm:flex" />}
        {hasUsername && <Action icon={IconCopy} label="Copy username" onClick={copyUsername} />}
        {canRefresh && (
          <Action
            icon={IconRefresh}
            label={refreshLabel}
            onClick={runRefresh}
            disabled={refresh.busy || refresh.cooldown}
            spinning={refresh.busy}
          />
        )}
        {isAdmin && <Action icon={IconEdit} label="Edit" onClick={() => setEditOpen(true)} />}
      </div>
      {refresh.note && <p className="mt-2 text-sm text-muted xl:order-2">{REFRESH_NOTE[refresh.note]}</p>}
      </div>

      {/* Right (laptop): the rest, scrolls with the page. -mt-6 cancels the first section's top margin. */}
      <div className="min-w-0 xl:-mt-6">
      <ConnectionCard
        state={conn}
        checked={checked ? capitalise(checkedAgo(checked, now)) : null}
      />

      {/* Plan */}
      {(customer.planName || progress || customer.status || amount) && (
        <section className="mt-6">
          <SectionTitle>Plan</SectionTitle>
          <div className="rounded-card bg-card px-5 py-4 shadow-soft">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="break-words text-base font-semibold">{customer.planName ?? 'No plan recorded'}</p>
                <p className="mt-0.5 text-sm text-muted">
                  {[days(customer.planValidityDays), amount].filter(Boolean).join(' · ') || null}
                </p>
              </div>
              {customer.status && (
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${statusTone}`}>{customer.status}</span>
              )}
            </div>

            {progress && (
              <div className="mt-4">
                <p className={`text-sm font-semibold ${progress.tone ? TEXT[progress.tone] : ''}`}>{progress.label}</p>
                {progress.pct != null && (
                  <div
                    className="mt-2 h-2 overflow-hidden rounded-full bg-line/70"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(progress.pct)}
                    aria-label="Plan used"
                  >
                    <div
                      className={`h-full rounded-full ${BAR[progress.tone] ?? 'bg-fiber'}`}
                      style={{ width: `${Math.max(progress.pct, 2)}%` }}
                    />
                  </div>
                )}
                <div className="mt-2 flex justify-between gap-4 text-xs text-muted">
                  <span>{customer.planActivatedAt ? `Activated ${fmtDate(customer.planActivatedAt)}` : ''}</span>
                  <span className="text-right">
                    {progress.expired ? 'Expired' : 'Expires'} {fmtDate(customer.planExpiresAt)}
                  </span>
                </div>
              </div>
            )}

            {(customer.autoRenewal != null || customer.ageingDays != null) && (
              <div className="mt-3 border-t border-line/60">
                <Row label="Auto renewal">{customer.autoRenewal == null ? null : customer.autoRenewal ? 'Yes' : 'No'}</Row>
                <Row label="Customer ageing">
                  {customer.ageingDays == null ? null : (
                    <>
                      {days(customer.ageingDays)} <span className="font-normal text-muted">(from sheet)</span>
                    </>
                  )}
                </Row>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Location */}
      <section className="mt-6">
        <SectionTitle>Location</SectionTitle>
        <div className="rounded-card bg-card px-5 py-2 shadow-soft">
          <Row label="Building">
            {building && (
              <span className="inline-flex flex-wrap items-baseline justify-end gap-x-3 gap-y-1">
                <Link href={buildingCustomersHref} className="text-fiber hover:underline">
                  {building.buildingName}
                </Link>
                <Link
                  href={`/buildings/${building.id}`}
                  className="inline-flex items-center gap-1 text-xs font-normal text-muted hover:text-fiber"
                >
                  Building page
                  <IconExternal className="h-3 w-3" strokeWidth={1.8} aria-hidden="true" />
                </Link>
              </span>
            )}
          </Row>
          <Row label="Wing">{customer.wing?.name ?? 'No wing'}</Row>
          <Row label="Address">{customer.address}</Row>
          {dir && (
            <div className="border-t border-line/60 py-3">
              <a
                href={dir}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline h-11 min-h-11 w-full gap-2 rounded-btn text-sm font-medium normal-case sm:w-auto"
              >
                <IconNavigate className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                Directions
              </a>
            </div>
          )}
        </div>

        <details className="group mt-3 rounded-card bg-card shadow-soft">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
            More details
            <IconChevronDown
              className="h-4 w-4 text-muted transition-transform duration-200 group-open:rotate-180"
              strokeWidth={1.8}
              aria-hidden="true"
            />
          </summary>
          <div className="border-t border-line/60 px-5 py-1">
            <Row label="Site">{customer.site}</Row>
            <Row label="Operator">{customer.operator}</Row>
            <Row label="Network zone">{customer.networkZone}</Row>
            <Row label="E-Mail">{customer.email}</Row>
            <Row label="PON (sheet)">{customer.ponNumber}</Row>
            <Row label="OLT (sheet)">{customer.olt}</Row>
            <Row label="Mobile">{customer.mobile}</Row>
            <Row label="Added">{fmtDate(customer.createdAt)}</Row>
          </div>
        </details>
      </section>

      {/* Phone: the three field actions, sticky above the bottom navigation (72 px + safe area). */}
      {hasBar && (
        <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 border-t border-line/70 bg-card/90 px-4 py-2 backdrop-blur-md sm:hidden">
          <div className="mx-auto flex max-w-lg gap-2">
            {tel && <BarButton icon={IconPhone} label="Call" href={tel} primary />}
            {dir && <BarButton icon={IconNavigate} label="Directions" href={dir} external />}
            {wa && <BarButton icon={IconMessage} label="WhatsApp" href={wa} external />}
          </div>
        </div>
      )}

      {editOpen && (
        <CustomerFormModal
          buildingId={building.id}
          customer={customer}
          wings={customer.wings ?? []}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false)
            loadCustomer()
          }}
        />
      )}
      </div>
    </main>
  )
}
