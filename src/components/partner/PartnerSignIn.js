'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { partnerApi, getPartnerApiError, PARTNER_TYPES } from '@/lib/partner-api-client'
import { usePartnerAuthStore } from '@/stores/partner-auth-store'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { OtpInput } from '@/components/partner/OtpInput'
import { StepRail } from '@/components/partner/StepRail'
import { NodeMark, IconArrowLeft } from '@/components/ui/icons'

/**
 * Signing in is two steps; signing up is three.
 *
 * A partner signs up once and signs in forever after, so promising a
 * returning partner a "Details" step they will never see is the common case
 * got wrong. We only learn which path this is when the number is submitted,
 * so until then the rail promises the two steps everybody does.
 */
const LOGIN_STEPS = ['Number', 'Code']
const SIGNUP_STEPS = ['Number', 'Code', 'Details']

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
  // null until the number is submitted — distinct from false, which means we
  // asked and this number is new to us.
  const [known, setKnown] = useState(null)
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

  // An invite is only ever handed to someone who does not have an account, so
  // that path is a signup from the first screen and can say so.
  const signingUp = Boolean(inviteToken) || known === false

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
      // Only the server knows whether this was a fresh send or the resend
      // cooldown; with real SMS on, `devCode` is absent either way.
      setNotice(
        data.cooldown ? 'We have already sent you a code — please use that one.' : null,
      )
      setStep('code')
    })

  /**
   * `entered` is passed by the OTP field when the sixth digit lands. It must
   * be used rather than `code` from state: the auto-submit fires in the same
   * tick as the setState, so the closure still holds five digits and the
   * request would go out one short.
   */
  const submitCode = (entered) =>
    run(async () => {
      const res = await partnerApi.post('/partner-auth/otp/verify', {
        mobile,
        code: entered ?? code,
      })
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
    <main className="min-h-dvh bg-paper">
      {/* A solid band anchors the page, so the card sits ON something rather
          than floating in the middle of an empty screen. */}
      <header className="bg-neutral px-5 pb-16 pt-10 text-neutral-content">
        <div className="mx-auto w-full max-w-md">
          <span className="flex h-12 w-12 items-center justify-center rounded-btn bg-primary text-primary-content">
            <NodeMark className="h-7 w-7" />
          </span>
          <h1 className="mt-4 text-2xl font-bold leading-tight tracking-tight">
            {invitedBy ? `${invitedBy} invited you` : 'Partner portal'}
          </h1>
          <p className="mt-1 text-sm font-normal text-neutral-content/70">
            Send us customers from your area. Earn on every one that signs up.
          </p>
        </div>
      </header>

      <div className="mx-auto -mt-10 w-full max-w-md px-5 pb-10">
      <div className="rounded-card bg-card p-6 shadow-lift">
        <div className="mb-5">
          <StepRail
            steps={signingUp ? SIGNUP_STEPS : LOGIN_STEPS}
            current={step === 'mobile' ? 0 : step === 'code' ? 1 : 2}
          />
        </div>

        {/* ---- step 1: the number ------------------------------------- */}
        {step === 'mobile' && (
          <>
            <p className="mb-1 text-lg font-bold">Enter your mobile number</p>
            <p className="mb-4 text-sm font-normal text-muted">
              We will send you a 6-digit code. No password needed.
            </p>
            {/* The country code is fixed and shown, not typed — an Indian
                number field without +91 reads as somebody else's form. */}
            <label htmlFor="partner-mobile" className="mb-1.5 block text-sm font-medium">
              Mobile number
            </label>
            <div className="flex items-stretch overflow-hidden rounded-btn border-2 border-line focus-within:border-primary">
              <span className="flex shrink-0 items-center gap-1 border-r border-line bg-paper px-3.5 text-lg font-bold tabular-nums text-muted">
                +91
              </span>
              <input
                id="partner-mobile"
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={10}
                placeholder="00000 00000"
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                onKeyDown={(e) => e.key === 'Enter' && MOBILE.test(mobile) && sendCode()}
                className="h-14 w-full min-w-0 bg-card px-3.5 text-lg font-bold tabular-nums tracking-wide outline-none"
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
              <button
                type="button"
                onClick={() => setCode(devCode)}
                className="mb-4 block w-full rounded-btn border border-dashed border-primary/50 bg-primary/5 px-4 py-3 text-center transition-colors hover:bg-primary/10"
              >
                <span className="block text-xs font-medium uppercase tracking-wide text-primary">
                  Testing — tap to fill
                </span>
                <span
                  id="dev-otp"
                  className="mt-0.5 block text-2xl font-bold tabular-nums tracking-[0.3em] text-primary"
                >
                  {devCode}
                </span>
              </button>
            )}

            <OtpInput
              value={code}
              onChange={setCode}
              onComplete={(entered) => {
                // Six digits in means they are done typing — do not make them
                // hunt for a button as well.
                submitCode(entered)
              }}
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
              onClick={() => submitCode()}
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
      </div>
    </main>
  )
}
