'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { partnerApi, getPartnerApiError, PARTNER_TYPES } from '@/lib/partner-api-client'
import { usePartnerAuthStore } from '@/stores/partner-auth-store'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { NodeMark, IconArrowLeft } from '@/components/ui/icons'

const MOBILE = /^[6-9]\d{9}$/

/**
 * Signing in and signing up are the same three steps, because the partner
 * should never have to know which one they are doing (partner-network.md §1):
 *
 *     mobile number  →  6-digit code  →  (new numbers only) a few details
 *
 * No password exists anywhere in this flow. The mobile number is the one
 * thing this audience always knows and never forgets.
 *
 * `inviteToken` is passed when they arrived through an employee's link; it
 * attributes them to that employee once the account is created.
 */
export function PartnerSignIn({ inviteToken, invitedBy }) {
  const router = useRouter()
  const setAuth = usePartnerAuthStore((s) => s.setAuth)

  const [step, setStep] = useState('mobile') // mobile | code | details
  const [mobile, setMobile] = useState('')
  const [code, setCode] = useState('')
  const [known, setKnown] = useState(false)
  const [devCode, setDevCode] = useState(null)
  const [signupToken, setSignupToken] = useState(null)
  const [form, setForm] = useState({ name: '', type: '', companyName: '', email: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const codeRef = useRef(null)

  useEffect(() => {
    if (step === 'code') codeRef.current?.focus()
  }, [step])

  const land = ({ token, partner }) => {
    setAuth({ token, partner })
    router.replace(partner.status === 'APPROVED' ? '/partner' : '/partner/documents')
  }

  async function run(fn) {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(getPartnerApiError(err, 'Something went wrong. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  const sendCode = () =>
    run(async () => {
      const res = await partnerApi.post('/partner-auth/otp/request', { mobile })
      const data = res.data.data
      setKnown(Boolean(data.registered))
      setDevCode(data.devCode ?? null)
      setNotice(
        data.devCode
          ? null
          : 'We have already sent you a code — please use that one.',
      )
      setStep('code')
    })

  const submitCode = () =>
    run(async () => {
      const res = await partnerApi.post('/partner-auth/otp/verify', { mobile, code })
      const data = res.data.data
      if (data.needsSignup) {
        setSignupToken(data.signupToken)
        setStep('details')
        return
      }
      land(data)
    })

  const typeMeta = PARTNER_TYPES.find((t) => t.value === form.type)
  const detailsValid = form.name.trim() && form.type

  const submitDetails = () =>
    run(async () => {
      const res = await partnerApi.post('/partner-auth/register', {
        signupToken,
        mobile,
        name: form.name.trim(),
        type: form.type,
        companyName: form.companyName.trim() || undefined,
        email: form.email.trim() || undefined,
        ...(inviteToken && { inviteToken }),
      })
      land(res.data.data)
    })

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-8 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-btn bg-primary text-primary-content">
          <NodeMark className="h-7 w-7" />
        </span>
        <div className="min-w-0">
          <p className="text-lg font-bold leading-tight tracking-tight">Partner portal</p>
          <p className="truncate text-sm font-normal text-muted">
            {invitedBy ? `Invited by ${invitedBy}` : 'Refer customers, earn on every one'}
          </p>
        </div>
      </div>

      <div className="rounded-card bg-card p-6 shadow-soft">
        {/* ---- step 1: the number ------------------------------------- */}
        {step === 'mobile' && (
          <>
            <p className="mb-1 text-lg font-bold">Enter your mobile number</p>
            <p className="mb-4 text-sm font-normal text-muted">
              We will send you a 6-digit code. No password needed.
            </p>
            <Input
              id="partner-mobile"
              label="Mobile number"
              inputMode="numeric"
              maxLength={10}
              placeholder="10-digit number"
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
              onKeyDown={(e) => e.key === 'Enter' && MOBILE.test(mobile) && sendCode()}
            />
            {error && (
              <p className="mt-3 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">
                {error}
              </p>
            )}
            <Button
              className="mt-5"
              fullWidth
              loading={busy}
              disabled={!MOBILE.test(mobile)}
              onClick={sendCode}
            >
              Send code
            </Button>
          </>
        )}

        {/* ---- step 2: the code --------------------------------------- */}
        {step === 'code' && (
          <>
            <button
              type="button"
              onClick={() => {
                setStep('mobile')
                setCode('')
                setError(null)
                setNotice(null)
              }}
              className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-fiber"
            >
              <IconArrowLeft className="h-4 w-4" />
              Change number
            </button>

            <p className="mb-1 text-lg font-bold">
              {known ? 'Welcome back' : 'Check the code'}
            </p>
            <p className="mb-4 text-sm font-normal text-muted">
              Enter the 6-digit code for <span className="font-medium text-ink">{mobile}</span>.
            </p>

            {/* TESTING ONLY — the server only sends this while
                SHOW_OTP_IN_RESPONSE is on, and refuses to start with it on in
                production. */}
            {devCode && (
              <div className="mb-4 rounded-btn border border-dashed border-fiber/50 bg-fiber-tint px-4 py-3 text-center">
                <p className="text-xs font-medium uppercase tracking-wide text-fiber">
                  Testing — your code
                </p>
                <p
                  id="dev-otp"
                  className="mt-0.5 text-2xl font-bold tabular-nums tracking-[0.3em] text-fiber"
                >
                  {devCode}
                </p>
              </div>
            )}

            <Input
              ref={codeRef}
              id="partner-code"
              label="6-digit code"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => e.key === 'Enter' && code.length === 6 && submitCode()}
            />

            {notice && <p className="mt-3 text-sm font-normal text-muted">{notice}</p>}
            {error && (
              <p className="mt-3 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">
                {error}
              </p>
            )}

            <Button
              className="mt-5"
              fullWidth
              loading={busy}
              disabled={code.length !== 6}
              onClick={submitCode}
            >
              Continue
            </Button>
            <button
              type="button"
              onClick={sendCode}
              className="mt-3 w-full text-sm font-medium text-muted underline-offset-2 hover:text-ink hover:underline"
            >
              Send the code again
            </button>
          </>
        )}

        {/* ---- step 3: a few details, new numbers only ----------------- */}
        {step === 'details' && (
          <>
            <p className="mb-1 text-lg font-bold">Just a few details</p>
            <p className="mb-4 text-sm font-normal text-muted">
              Your number is verified. Tell us who you are and you are done.
            </p>

            <div className="flex flex-col gap-3">
              <Input
                id="signup-name"
                label="Your name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <Select
                id="signup-type"
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
                  id="signup-company"
                  label={`${typeMeta.company} (optional)`}
                  value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                />
              )}
              <Input
                id="signup-email"
                label="Email (optional)"
                inputMode="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            {error && (
              <p className="mt-3 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">
                {error}
              </p>
            )}
            <Button
              className="mt-5"
              fullWidth
              loading={busy}
              disabled={!detailsValid}
              onClick={submitDetails}
            >
              Finish
            </Button>
          </>
        )}
      </div>
    </main>
  )
}
