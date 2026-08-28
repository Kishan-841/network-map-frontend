'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  partnerApi,
  getPartnerApiError,
  PARTNER_TYPES,
} from '@/lib/partner-api-client'
import { usePartnerAuthStore } from '@/stores/partner-auth-store'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { NodeMark } from '@/components/ui/icons'

/**
 * Onboarding through an employee's one-use invite link. Signing up here is
 * what attributes the partner to that employee — see partner-network.md §3.1.
 */
export default function PartnerJoinPage({ params }) {
  const { token } = use(params)
  const router = useRouter()
  const setAuth = usePartnerAuthStore((s) => s.setAuth)
  const [invite, setInvite] = useState(null) // { key, employeeName } | { key, error }
  const [form, setForm] = useState({
    name: '', type: '', companyName: '', mobile: '', email: '', password: '', hasGst: false,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    partnerApi
      .get(`/partner-invites/resolve/${token}`)
      .then((res) => !cancelled && setInvite({ key: token, employeeName: res.data.data.employeeName }))
      .catch(
        (err) =>
          !cancelled &&
          setInvite({ key: token, error: getPartnerApiError(err, 'This invite link is not valid') }),
      )
    return () => {
      cancelled = true
    }
  }, [token])

  const typeMeta = PARTNER_TYPES.find((t) => t.value === form.type)
  const valid =
    form.name.trim() &&
    form.type &&
    /^[6-9]\d{9}$/.test(form.mobile.trim()) &&
    form.email.trim() &&
    form.password.length >= 8 &&
    /[a-zA-Z]/.test(form.password) &&
    /\d/.test(form.password)

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const res = await partnerApi.post('/partner-auth/register', {
        name: form.name.trim(),
        type: form.type,
        companyName: form.companyName.trim() || undefined,
        mobile: form.mobile.trim(),
        email: form.email.trim(),
        password: form.password,
        hasGst: form.hasGst,
        inviteToken: token,
      })
      setAuth(res.data.data)
      router.replace('/partner/documents')
    } catch (err) {
      setError(getPartnerApiError(err, 'Could not create your account'))
      setBusy(false)
    }
  }

  if (!invite) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center px-5">
        <p className="text-sm font-normal text-muted">Checking your invite…</p>
      </main>
    )
  }

  if (invite.error) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
        <div className="rounded-card bg-card p-6 text-center shadow-soft">
          <p className="font-bold">This invite link is no longer valid</p>
          <p className="mt-2 text-sm font-normal text-muted">
            Invite links are single-use and expire. Ask your contact at the company to send
            you a fresh one.
          </p>
          <Link
            href="/partner/login"
            className="mt-4 inline-block text-sm font-medium text-fiber underline-offset-2 hover:underline"
          >
            Already have an account? Sign in
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-md px-5 py-10">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-btn bg-primary text-primary-content">
          <NodeMark className="h-7 w-7" />
        </span>
        <div>
          <p className="text-lg font-bold leading-tight tracking-tight">Join as a partner</p>
          {invite.employeeName && (
            <p className="text-sm font-normal text-muted">
              Invited by <span className="font-medium text-ink">{invite.employeeName}</span>
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-card bg-card p-6 shadow-soft">
        <Input
          id="join-name"
          label="Your name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <Select
          id="join-type"
          label="You are a"
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
        >
          <option value="">Select…</option>
          {PARTNER_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
        {typeMeta && (
          <Input
            id="join-company"
            label={typeMeta.company}
            value={form.companyName}
            onChange={(e) => setForm({ ...form, companyName: e.target.value })}
          />
        )}
        <Input
          id="join-mobile"
          label="Mobile number"
          inputMode="numeric"
          maxLength={10}
          value={form.mobile}
          onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, '') })}
        />
        <Input
          id="join-email"
          label="Email"
          inputMode="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <Input
          id="join-password"
          label="Password"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <p className="-mt-1 text-xs font-normal text-muted">
          At least 8 characters, with a letter and a number. You can also sign in with an
          emailed code.
        </p>

        <label className="flex cursor-pointer items-center gap-3 rounded-btn border border-line px-3 py-2.5">
          <input
            id="join-gst"
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={form.hasGst}
            onChange={(e) => setForm({ ...form, hasGst: e.target.checked })}
          />
          <span className="text-sm">I have a GST registration</span>
        </label>
        <p className="-mt-1 text-xs font-normal text-muted">
          Tick this only if it applies — it makes a GST certificate part of your document
          check.
        </p>

        {error && (
          <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>
        )}
        <Button fullWidth loading={busy} disabled={!valid} onClick={submit}>
          Create my account
        </Button>
      </div>
    </main>
  )
}
