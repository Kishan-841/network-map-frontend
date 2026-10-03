'use client'

import { useEffect, useState } from 'react'
import { partnerApi, getPartnerApiError, partnerTypeLabel } from '@/lib/partner-api-client'
import { Button } from '@/components/ui/Button'
import { Input, Field } from '@/components/ui/Input'
import { IconUserPlus, IconOkCircle } from '@/components/ui/icons'

const TYPES = ['AGENT', 'SOCIETY_REPRESENTATIVE', 'RETAIL_SHOP', 'DSA']

const STATUS_LABEL = {
  NEW: 'Passed on',
  CONTACTED: 'We called them',
  JOINED: 'They joined',
  DECLINED: 'Not going ahead',
}
const STATUS_STYLE = {
  NEW: 'bg-fiber-tint text-fiber',
  CONTACTED: 'bg-scan-tint text-scan',
  JOINED: 'bg-ok-tint text-ok',
  DECLINED: 'bg-paper text-muted',
}

const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' })
const blank = { name: '', type: '', mobile: '', email: '', note: '' }

/**
 * Refer a partner (partner-network.md §7).
 *
 * The form is four fields because every field removed is a partner who
 * finishes — the same reasoning as the lead form in §0. What happens after an
 * introduction is still open (§7.1: who follows up, whether the referrer earns
 * anything, chains), so this page promises nothing it cannot keep: it says we
 * will call them, and never that there is money in it.
 */
export default function IntroducePartnerPage() {
  const [form, setForm] = useState(blank)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)
  const [made, setMade] = useState(null)

  const load = () =>
    partnerApi
      .get('/partner/partner-referrals')
      .then((res) => setMade(res.data.data))
      .catch(() => setMade([]))

  useEffect(() => {
    load()
  }, [])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await partnerApi.post('/partner/partner-referrals', {
        name: form.name,
        type: form.type,
        mobile: form.mobile,
        ...(form.email && { email: form.email }),
        ...(form.note && { note: form.note }),
      })
      setDone(res.data.data.name)
      setForm(blank)
      load()
    } catch (err) {
      setError(getPartnerApiError(err, 'Could not send that in'))
    } finally {
      setBusy(false)
    }
  }

  const ready = form.name.trim() && form.type && /^[6-9][0-9]{9}$/.test(form.mobile)

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Refer a partner</h1>
      <p className="mt-1 text-sm font-normal text-muted">
        Know someone who could also send us customers? Pass on their name and we will call them.
      </p>

      {done && (
        <div className="mt-4 flex items-start gap-3 rounded-card bg-ok-tint p-4">
          <IconOkCircle className="mt-0.5 h-5 w-5 shrink-0 text-ok" strokeWidth={2} />
          <p className="text-sm font-normal text-ok">
            Thank you — we have {done}&rsquo;s details and will get in touch with them.
          </p>
        </div>
      )}

      <form
        onSubmit={submit}
        className="mt-6 flex flex-col gap-5 rounded-card bg-card p-5 shadow-soft"
      >
        <Input
          id="ref-name"
          label="Name"
          value={form.name}
          onChange={set('name')}
          autoComplete="off"
        />

        <Field label="Type" htmlFor="ref-type">
          <div className="flex flex-wrap gap-2" id="ref-type">
            {TYPES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, type: value }))}
                className={`rounded-btn px-3.5 py-2 text-sm font-medium transition-colors ${
                  form.type === value
                    ? 'bg-primary text-primary-content'
                    : 'bg-paper text-muted hover:text-ink'
                }`}
              >
                {partnerTypeLabel(value)}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Mobile number" htmlFor="ref-mobile">
          <div className="flex items-stretch">
            <span className="flex items-center rounded-l-btn border border-r-0 border-line bg-paper px-3 text-sm font-medium text-muted">
              +91
            </span>
            <input
              id="ref-mobile"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={form.mobile}
              onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value.replace(/\D/g, '') }))}
              className="w-full rounded-r-btn border border-line bg-card px-3 py-2.5 text-base tabular-nums outline-none transition-colors focus:border-primary"
            />
          </div>
        </Field>

        <Input
          id="ref-email"
          label="Email (optional)"
          type="email"
          value={form.email}
          onChange={set('email')}
          autoComplete="off"
        />

        {error && (
          <p className="rounded-btn bg-bad-tint px-3 py-2 text-sm font-normal text-bad">
            {error}
          </p>
        )}

        <Button type="submit" disabled={!ready || busy} className="w-full">
          {busy ? 'Sending…' : 'Send their details'}
        </Button>
      </form>

      <h2 className="mt-8 text-sm font-bold">People you have passed on</h2>
      <div className="mt-3 overflow-hidden rounded-card bg-card shadow-soft">
        {made === null ? (
          <p className="px-4 py-8 text-center text-sm font-normal text-muted">Loading…</p>
        ) : made.length ? (
          <ul>
            {made.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 border-b border-line/70 px-4 py-3.5 last:border-b-0"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.name}</span>
                  <span className="block truncate text-xs font-normal text-muted">
                    {partnerTypeLabel(r.type)} · {dateFormat.format(new Date(r.createdAt))}
                  </span>
                </span>
                <span
                  className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
                    STATUS_STYLE[r.status] ?? 'bg-paper text-muted'
                  }`}
                >
                  {STATUS_LABEL[r.status] ?? r.status}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-6 py-10 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-fiber-tint text-fiber">
              <IconUserPlus className="h-6 w-6" strokeWidth={1.8} />
            </span>
            <p className="mt-3 text-sm font-normal text-muted">
              Nobody yet. Anyone you pass on will show up here.
            </p>
          </div>
        )}
      </div>
    </>
  )
}
