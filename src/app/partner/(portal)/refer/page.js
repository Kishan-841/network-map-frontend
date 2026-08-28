'use client'

import { useEffect, useRef, useState } from 'react'
import { partnerApi, getPartnerApiError } from '@/lib/partner-api-client'
import { getMapProvider } from '@/lib/map-providers'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { IconSearch, IconOkCircle } from '@/components/ui/icons'

const SEARCH_DEBOUNCE_MS = 350

const VERDICT = {
  SERVICEABLE: {
    tone: 'bg-ok-tint text-ok',
    title: 'We can serve this building',
    body: 'Go ahead and share the customer’s details.',
  },
  NOT_SERVICEABLE: {
    tone: 'bg-doc-tint text-doc',
    title: 'Not available here yet',
    body: 'We know this building but do not serve it today. We have noted your interest.',
  },
  NOT_SURVEYED: {
    tone: 'bg-doc-tint text-doc',
    title: 'Not available here yet',
    body: 'We have not covered this building. We have noted your interest — it helps us decide where to build next.',
  },
}

/**
 * Refer a customer.
 *
 * The building search reuses the shared Places provider, session token and
 * all: one billed session per search rather than one per keystroke.
 */
export default function ReferPage() {
  const provider = useRef(null)
  const sessionRef = useRef(null)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [place, setPlace] = useState(null)
  const [verdict, setVerdict] = useState(null)
  const [form, setForm] = useState({ customerName: '', customerMobile: '', customerEmail: '', note: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)

  useEffect(() => {
    provider.current = getMapProvider()
    sessionRef.current = crypto.randomUUID()
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    if (debounced.length < 3 || place) return
    let cancelled = false
    provider.current
      ?.autocomplete({ input: debounced, sessionToken: sessionRef.current })
      .then((rows) => !cancelled && setSuggestions(rows.slice(0, 6)))
      .catch(() => !cancelled && setSuggestions([]))
    return () => {
      cancelled = true
    }
  }, [debounced, place])

  async function choose(suggestion) {
    setBusy(true)
    setError(null)
    setSuggestions([])
    try {
      const details = await provider.current.getPlaceDetails({
        placeId: suggestion.placeId,
        sessionToken: sessionRef.current,
      })
      // The session is spent; the next search starts a new one.
      sessionRef.current = crypto.randomUUID()
      setPlace(details)
      setQuery(details.name ?? suggestion.primaryText)

      const res = await partnerApi.post('/partner/feasibility', {
        placeId: details.placeId ?? suggestion.placeId,
        latitude: details.latitude,
        longitude: details.longitude,
        name: details.name ?? suggestion.primaryText,
      })
      setVerdict(res.data.data.verdict)
    } catch (err) {
      setError(getPartnerApiError(err, 'Could not check that building'))
    } finally {
      setBusy(false)
    }
  }

  const validCustomer =
    form.customerName.trim() && /^[6-9]\d{9}$/.test(form.customerMobile.trim())

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const res = await partnerApi.post('/partner/leads', {
        customerName: form.customerName.trim(),
        customerMobile: form.customerMobile.trim(),
        customerEmail: form.customerEmail.trim() || undefined,
        address: place?.formattedAddress ?? undefined,
        note: form.note.trim() || undefined,
      })
      setDone(res.data.data)
    } catch (err) {
      setError(getPartnerApiError(err, 'Could not send that referral'))
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setQuery('')
    setDebounced('')
    setSuggestions([])
    setPlace(null)
    setVerdict(null)
    setForm({ customerName: '', customerMobile: '', customerEmail: '', note: '' })
    setDone(null)
    sessionRef.current = crypto.randomUUID()
  }

  if (done) {
    return (
      <>
        <div className="rounded-card bg-card p-6 text-center shadow-soft">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ok-tint text-ok">
            <IconOkCircle className="h-6 w-6" />
          </span>
          <p className="mt-3 font-bold">
            {done.status === 'DUPLICATE' ? 'We already have this one' : 'Referral sent'}
          </p>
          <p className="mt-1 text-sm font-normal text-muted">
            {done.status === 'DUPLICATE'
              ? 'This customer is already in our system, so it will not be counted twice. Thanks for letting us know.'
              : `Thanks — our team will get in touch with ${done.customerName}.`}
          </p>
          <Button className="mt-4" onClick={reset}>
            Refer someone else
          </Button>
        </div>
      </>
    )
  }

  const meta = verdict ? VERDICT[verdict] : null

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Refer a customer</h1>
      <p className="mt-1 text-sm font-normal text-muted">
        Find their building first — we will tell you whether we can serve it.
      </p>

      <div className="mt-4 rounded-card bg-card p-5 shadow-soft">
        <div className="relative">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            id="refer-search"
            value={query}
            placeholder="Building, society or address…"
            onChange={(e) => {
              setQuery(e.target.value)
              setPlace(null)
              setVerdict(null)
            }}
            className="w-full rounded-btn border border-line bg-card py-3 pl-9 pr-3 text-sm outline-none focus:border-fiber"
          />
        </div>

        {suggestions.length > 0 && (
          <ul className="mt-2 flex flex-col overflow-hidden rounded-btn border border-line">
            {suggestions.map((s) => (
              <li key={s.placeId}>
                <button
                  type="button"
                  onClick={() => choose(s)}
                  className="w-full px-3 py-2.5 text-left transition-colors hover:bg-primary/5"
                >
                  <p className="truncate text-sm font-medium">{s.primaryText}</p>
                  <p className="truncate text-xs font-normal text-muted">{s.secondaryText}</p>
                </button>
              </li>
            ))}
          </ul>
        )}

        {meta && (
          <div className="mt-4">
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${meta.tone}`}>
              {meta.title}
            </span>
            <p className="mt-2 text-sm font-normal text-muted">{meta.body}</p>
          </div>
        )}
      </div>

      {verdict === 'SERVICEABLE' && (
        <div className="mt-4 flex flex-col gap-3 rounded-card bg-card p-5 shadow-soft">
          <p className="font-bold">Customer details</p>
          <Input
            id="lead-name"
            label="Their name"
            value={form.customerName}
            onChange={(e) => setForm({ ...form, customerName: e.target.value })}
          />
          <Input
            id="lead-mobile"
            label="Mobile number"
            inputMode="numeric"
            maxLength={10}
            value={form.customerMobile}
            onChange={(e) => setForm({ ...form, customerMobile: e.target.value.replace(/\D/g, '') })}
          />
          <Input
            id="lead-email"
            label="Email (optional)"
            inputMode="email"
            value={form.customerEmail}
            onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
          />
          <Input
            id="lead-note"
            label="Anything we should know? (optional)"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
          <div className="rounded-btn bg-paper px-3 py-2.5">
            <p className="text-xs font-medium uppercase tracking-wide text-faint">Address</p>
            <p className="mt-0.5 text-sm">{place?.formattedAddress ?? '—'}</p>
          </div>
          {error && (
            <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>
          )}
          <Button fullWidth loading={busy} disabled={!validCustomer} onClick={submit}>
            Send referral
          </Button>
        </div>
      )}

      {error && verdict !== 'SERVICEABLE' && (
        <p className="mt-3 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>
      )}
    </>
  )
}
