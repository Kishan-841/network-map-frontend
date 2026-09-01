'use client'

import { useEffect, useRef, useState } from 'react'
import { partnerApi, getPartnerApiError } from '@/lib/partner-api-client'
import { getMapProvider } from '@/lib/map-providers'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { StepRail } from '@/components/partner/StepRail'
import { IconSearch, IconOkCircle, IconArrowLeft } from '@/components/ui/icons'

const SEARCH_DEBOUNCE_MS = 350
const MIN_QUERY = 3
const SPEEDS = [100, 200, 300, 400]
const STEPS = ['Building', 'Customer']

/**
 * What we tell the partner about the building they picked.
 *
 * Three states, not two: a building can be surveyed and viable but not yet
 * lit, and "coming soon" is both true and a better thing for a partner to
 * tell their neighbour than "no" (partner-network.md §4.3).
 */
const SIGNAL = {
  LIVE: {
    dot: 'bg-ok',
    tone: 'border-ok/30 bg-ok-tint',
    title: 'We serve this building',
    body: 'Your customer can be connected here.',
  },
  IN_REGISTRY: {
    dot: 'bg-warn',
    tone: 'border-warn/30 bg-warn-tint',
    title: 'Coming soon here',
    body: 'We have surveyed this building and are working on it. Send the lead — we will call them.',
  },
  NOT_FOUND: {
    dot: 'bg-bad',
    tone: 'border-bad/30 bg-bad-tint',
    title: 'Not in our network yet',
    body: 'Send the lead anyway. Interest here helps us decide where to build next.',
  },
}

export default function AddLeadPage() {
  const provider = useRef(null)
  const sessionRef = useRef(null)

  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [results, setResults] = useState(null)
  const [place, setPlace] = useState(null)
  const [signal, setSignal] = useState(null)
  const [form, setForm] = useState({ customerName: '', customerMobile: '', requirementMbps: '' })
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
    if (place || debounced.length < MIN_QUERY) return
    let cancelled = false
    provider.current
      ?.autocomplete({ input: debounced, sessionToken: sessionRef.current })
      .then((rows) => !cancelled && setResults({ key: debounced, rows: rows.slice(0, 6) }))
      .catch(() => !cancelled && setResults({ key: debounced, rows: [] }))
    return () => {
      cancelled = true
    }
  }, [debounced, place])

  const rows = results?.key === debounced ? results.rows : null

  async function choose(suggestion) {
    setBusy(true)
    setError(null)
    setResults(null)
    try {
      const details = await provider.current.getPlaceDetails({
        placeId: suggestion.placeId,
        sessionToken: sessionRef.current,
      })
      // The session is spent; the next search starts a new one.
      sessionRef.current = crypto.randomUUID()
      const picked = {
        placeId: details.placeId ?? suggestion.placeId,
        placeName: details.name ?? suggestion.primaryText,
        address: details.formattedAddress ?? suggestion.secondaryText,
        latitude: details.latitude,
        longitude: details.longitude,
      }
      setPlace(picked)
      setQuery(picked.placeName)
      const res = await partnerApi.post('/partner/building-signal', {
        placeId: picked.placeId,
        placeName: picked.placeName,
        latitude: picked.latitude,
        longitude: picked.longitude,
      })
      setSignal(res.data.data.match)
    } catch (err) {
      setError(getPartnerApiError(err, 'Could not check that building. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  // Speed is optional: a partner standing with a customer usually has a name
  // and a number before any plan has been discussed, and refusing the lead
  // over a missing speed loses the whole lead.
  const customerValid =
    form.customerName.trim() && /^[6-9]\d{9}$/.test(form.customerMobile.trim())

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const res = await partnerApi.post('/partner/leads', {
        customerName: form.customerName.trim(),
        customerMobile: form.customerMobile.trim(),
        ...(form.requirementMbps && { requirementMbps: Number(form.requirementMbps) }),
        ...place,
      })
      setDone(res.data.data)
    } catch (err) {
      setError(getPartnerApiError(err, 'Could not send that lead. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setQuery('')
    setDebounced('')
    setResults(null)
    setPlace(null)
    setSignal(null)
    setForm({ customerName: '', customerMobile: '', requirementMbps: '' })
    setDone(null)
    setError(null)
    sessionRef.current = crypto.randomUUID()
  }

  if (done) {
    return (
      <div className="rounded-card bg-card p-6 text-center shadow-soft">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ok-tint text-ok">
          <IconOkCircle className="h-6 w-6" />
        </span>
        <p className="mt-3 text-lg font-bold">
          {done.status === 'DUPLICATE' ? 'We already have this one' : 'Lead sent'}
        </p>
        <p className="mt-1 text-sm font-normal text-muted">
          {done.status === 'DUPLICATE'
            ? 'Someone has already told us about this customer, so it will not be counted twice. Thanks anyway.'
            : `Our team will call ${done.customerName}. You can follow it in My leads.`}
        </p>
        <Button className="mt-4" onClick={reset}>
          Add another lead
        </Button>
      </div>
    )
  }

  const meta = signal ? SIGNAL[signal] : null

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Add a lead</h1>
      <p className="mt-1 text-sm font-normal text-muted">
        Someone who wants an internet connection.
      </p>

      <div className="mt-4">
        <StepRail steps={STEPS} current={place ? 1 : 0} />
      </div>

      {/* ---- step 1: which building ---------------------------------- */}
      {/* relative: the coverage dot sits in this card's top corner. */}
      <div className="relative mt-4 rounded-card bg-card p-5 shadow-soft">
        {!place ? (
          <>
            <label htmlFor="refer-search" className="mb-1.5 block text-sm font-medium">
              Which building do they live in?
            </label>
            <div className="relative">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
              <input
                id="refer-search"
                value={query}
                placeholder="Building or society name"
                onChange={(e) => {
                  setQuery(e.target.value)
                  setError(null)
                }}
                className="h-14 w-full rounded-btn border-2 border-line bg-card pl-9 pr-3 text-base outline-none focus:border-primary"
              />
            </div>

            {debounced.length > 0 && debounced.length < MIN_QUERY && (
              <p className="mt-3 text-sm font-normal text-muted">
                Keep typing — at least {MIN_QUERY} letters.
              </p>
            )}
            {rows?.length === 0 && (
              <p className="mt-3 text-sm font-normal text-muted">
                Nothing found. Try the society name, or the road it is on.
              </p>
            )}
            {rows?.length > 0 && (
              <ul className="mt-3 flex flex-col overflow-hidden rounded-btn border border-line">
                {rows.map((s) => (
                  <li key={s.placeId} className="border-b border-line last:border-b-0">
                    <button
                      type="button"
                      onClick={() => choose(s)}
                      className="w-full px-3 py-3 text-left transition-colors hover:bg-primary/5"
                    >
                      <span className="block truncate text-sm font-medium">{s.primaryText}</span>
                      <span className="block truncate text-xs font-normal text-muted">
                        {s.secondaryText}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                setPlace(null)
                setSignal(null)
                setQuery('')
                setError(null)
              }}
              className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-primary"
            >
              <IconArrowLeft className="h-4 w-4" />
              Pick a different building
            </button>
            <p className="font-bold">{place.placeName}</p>
            <p className="mt-0.5 text-sm font-normal text-muted">{place.address}</p>

            {/* The verdict is a dot in the corner rather than a paragraph.
                The words are kept for a screen reader and on hover: a colour
                alone carries nothing to someone who cannot separate green
                from red, and these three sit close under protanopia. */}
            {meta && (
              <span
                title={meta.title}
                className={`absolute right-4 top-4 flex h-3 w-3 items-center justify-center rounded-full ${meta.dot}`}
              >
                <span className="sr-only">{meta.title}</span>
              </span>
            )}
            {busy && !meta && <p className="mt-3 text-sm font-normal text-muted">Checking…</p>}
          </>
        )}
      </div>

      {/* ---- step 2: who ---------------------------------------------- */}
      {place && signal && (
        <div className="mt-4 flex flex-col gap-3 rounded-card bg-card p-5 shadow-soft">
          <p className="font-bold">Who wants the connection?</p>
          <Input
            id="lead-name"
            label="Name"
            value={form.customerName}
            onChange={(e) => setForm({ ...form, customerName: e.target.value })}
          />
          <div>
            <label htmlFor="lead-mobile" className="mb-1.5 block text-sm font-medium">
              Their mobile number
            </label>
            <div className="flex items-stretch overflow-hidden rounded-btn border-2 border-line focus-within:border-primary">
              <span className="flex shrink-0 items-center border-r border-line bg-paper px-3.5 text-base font-bold tabular-nums text-muted">
                +91
              </span>
              <input
                id="lead-mobile"
                inputMode="numeric"
                maxLength={10}
                placeholder="00000 00000"
                value={form.customerMobile}
                onChange={(e) =>
                  setForm({ ...form, customerMobile: e.target.value.replace(/\D/g, '').slice(0, 10) })
                }
                className="h-14 w-full min-w-0 bg-card px-3.5 text-base font-bold tabular-nums outline-none"
              />
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium">
              Speed <span className="font-normal text-faint">(optional)</span>
            </p>
            {/* Buttons, not a dropdown — four choices are easier to tap than
                to open, scroll and pick. */}
            <div className="grid grid-cols-2 gap-2">
              {SPEEDS.map((mbps) => {
                const picked = Number(form.requirementMbps) === mbps
                return (
                  <button
                    key={mbps}
                    id={`speed-${mbps}`}
                    type="button"
                    aria-pressed={picked}
                    onClick={() => setForm({ ...form, requirementMbps: mbps })}
                    className={`h-14 rounded-btn border-2 text-base font-bold transition-colors ${
                      picked
                        ? 'border-primary bg-primary text-primary-content'
                        : 'border-line bg-card hover:border-faint'
                    }`}
                  >
                    {mbps} Mbps
                  </button>
                )
              })}
            </div>
          </div>

          {error && (
            <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>
          )}
          <Button fullWidth loading={busy} disabled={!customerValid} onClick={submit}>
            Send lead
          </Button>
        </div>
      )}

      {error && !place && (
        <p className="mt-3 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>
      )}
    </>
  )
}
