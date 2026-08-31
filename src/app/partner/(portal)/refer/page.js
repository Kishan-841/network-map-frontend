'use client'

import { useEffect, useState } from 'react'
import { partnerApi, getPartnerApiError } from '@/lib/partner-api-client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { IconSearch, IconOkCircle, IconArrowLeft } from '@/components/ui/icons'

const SEARCH_DEBOUNCE_MS = 350
const MIN_QUERY = 3

/**
 * Refer a customer.
 *
 * The building comes from OUR registry, not Google. The partner picks a
 * building we actually hold, so there is no coordinate matching to get wrong —
 * and the answer about whether we serve it is a fact about that exact row.
 */
export default function ReferPage() {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  // { key, rows } — keyed to the query it answers, so "no results yet" is
  // DERIVED rather than written back in an effect (react-hooks/set-state-in-effect).
  const [results, setResults] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ customerName: '', customerMobile: '', customerEmail: '', note: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    if (selected || debounced.length < MIN_QUERY) return
    let cancelled = false
    partnerApi
      .get('/partner/buildings/search', { params: { q: debounced } })
      .then((res) => !cancelled && setResults({ key: debounced, rows: res.data.data }))
      .catch((err) => {
        if (cancelled) return
        setResults({ key: debounced, rows: [] })
        setError(getPartnerApiError(err, 'Could not search buildings'))
      })
    return () => {
      cancelled = true
    }
  }, [debounced, selected])

  // Only trust results that answer the query currently typed.
  const rows = results?.key === debounced ? results.rows : null

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
        address: selected?.formattedAddress ?? undefined,
        note: form.note.trim() || undefined,
        buildingId: selected?.id,
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
    setResults(null)
    setSelected(null)
    setForm({ customerName: '', customerMobile: '', customerEmail: '', note: '' })
    setDone(null)
    setError(null)
  }

  if (done) {
    return (
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
    )
  }

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Refer a customer</h1>
      <p className="mt-1 text-sm font-normal text-muted">
        Find their building first — we will tell you whether we can serve it.
      </p>

      {/* ---- step 1: pick a building ---------------------------------- */}
      {!selected && (
        <div className="mt-4 rounded-card bg-card p-5 shadow-soft">
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              id="refer-search"
              value={query}
              placeholder="Search building or society name…"
              onChange={(e) => {
                setQuery(e.target.value)
                setError(null)
              }}
              className="w-full rounded-btn border border-line bg-card py-3 pl-9 pr-3 text-sm outline-none focus:border-fiber"
            />
          </div>

          {debounced.length > 0 && debounced.length < MIN_QUERY && (
            <p className="mt-3 text-sm font-normal text-muted">
              Type at least {MIN_QUERY} characters.
            </p>
          )}

          {rows?.length === 0 && debounced.length >= MIN_QUERY && (
            <p className="mt-3 text-sm font-normal text-muted">
              No building matches “{debounced}”. Check the spelling, or try the society name.
            </p>
          )}

          {rows?.length > 0 && (
            <ul className="mt-3 flex flex-col overflow-hidden rounded-btn border border-line">
              {rows.map((b) => (
                <li key={b.id} className="border-b border-line last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setSelected(b)}
                    className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-primary/5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{b.buildingName}</span>
                      <span className="block truncate text-xs font-normal text-muted">
                        {b.formattedAddress}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                        b.isServiceable ? 'bg-ok-tint text-ok' : 'bg-paper text-muted'
                      }`}
                    >
                      {b.isServiceable ? 'Available' : 'Not yet'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {error && (
            <p className="mt-3 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">
              {error}
            </p>
          )}
        </div>
      )}

      {/* ---- step 2: the verdict, then the customer -------------------- */}
      {selected && (
        <>
          <div className="mt-4 rounded-card bg-card p-5 shadow-soft">
            <button
              type="button"
              onClick={() => {
                setSelected(null)
                setError(null)
              }}
              className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-fiber"
            >
              <IconArrowLeft className="h-4 w-4" />
              Choose a different building
            </button>

            <p className="font-bold">{selected.buildingName}</p>
            <p className="mt-0.5 text-sm font-normal text-muted">{selected.formattedAddress}</p>

            <div className="mt-3">
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                  selected.isServiceable ? 'bg-ok-tint text-ok' : 'bg-doc-tint text-doc'
                }`}
              >
                {selected.isServiceable ? 'We can serve this building' : 'Not available here yet'}
              </span>
              <p className="mt-2 text-sm font-normal text-muted">
                {selected.isServiceable
                  ? 'Go ahead and share the customer’s details.'
                  : 'We know this building but it is not connected yet. We have noted your interest — it helps us decide where to build next.'}
              </p>
            </div>
          </div>

          {selected.isServiceable && (
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
                onChange={(e) =>
                  setForm({ ...form, customerMobile: e.target.value.replace(/\D/g, '') })
                }
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
              {error && (
                <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">
                  {error}
                </p>
              )}
              <Button fullWidth loading={busy} disabled={!validCustomer} onClick={submit}>
                Send referral
              </Button>
            </div>
          )}
        </>
      )}
    </>
  )
}
