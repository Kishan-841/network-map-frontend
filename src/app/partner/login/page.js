'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { partnerApi, getPartnerApiError } from '@/lib/partner-api-client'
import { usePartnerAuthStore } from '@/stores/partner-auth-store'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { NodeMark } from '@/components/ui/icons'

/**
 * Two ways in: the password set at onboarding, or a code emailed on demand.
 *
 * The channel row is built as a set of options with only Email enabled, so
 * adding SMS later is a new option in an existing control rather than a
 * redesign of this screen.
 */
export default function PartnerLoginPage() {
  const router = useRouter()
  const setAuth = usePartnerAuthStore((s) => s.setAuth)
  const [mode, setMode] = useState('password') // password | request | code
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

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
      setError(getPartnerApiError(err, 'Could not sign you in'))
    } finally {
      setBusy(false)
    }
  }

  const signInWithPassword = () =>
    run(async () => {
      const res = await partnerApi.post('/partner-auth/login', { email: email.trim(), password })
      land(res.data.data)
    })

  const sendCode = () =>
    run(async () => {
      await partnerApi.post('/partner-auth/otp/request', { email: email.trim() })
      setMode('code')
      // Deliberately neutral: we do not confirm whether the address is one
      // of ours, so this endpoint cannot be used to discover our partners.
      setNotice(`If ${email.trim()} is registered with us, a 6-digit code is on its way.`)
    })

  const signInWithCode = () =>
    run(async () => {
      const res = await partnerApi.post('/partner-auth/otp/verify', { email: email.trim(), code })
      land(res.data.data)
    })

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-8 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-btn bg-primary text-primary-content">
          <NodeMark className="h-7 w-7" />
        </span>
        <div>
          <p className="text-lg font-bold leading-tight tracking-tight">Partner portal</p>
          <p className="text-sm font-normal text-muted">Refer customers, track your leads</p>
        </div>
      </div>

      <div className="rounded-card bg-card p-6 shadow-soft">
        <Input
          id="partner-email"
          label="Email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={mode === 'code'}
        />

        {mode === 'password' && (
          <div className="mt-3">
            <Input
              id="partner-password"
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && signInWithPassword()}
            />
          </div>
        )}

        {mode === 'code' && (
          <div className="mt-3">
            <Input
              id="partner-code"
              label="6-digit code"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && signInWithCode()}
            />
          </div>
        )}

        {notice && <p className="mt-3 text-sm font-normal text-muted">{notice}</p>}
        {error && (
          <p className="mt-3 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-3">
          {mode === 'password' && (
            <>
              <Button fullWidth loading={busy} disabled={!email || !password} onClick={signInWithPassword}>
                Sign in
              </Button>
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setMode('request')
                }}
                className="text-sm font-medium text-fiber underline-offset-2 hover:underline"
              >
                Email me a code instead
              </button>
            </>
          )}

          {mode === 'request' && (
            <>
              {/* One option today; SMS becomes a second one here later. */}
              <div className="flex gap-2">
                <span className="inline-flex flex-1 items-center justify-center rounded-btn bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
                  Email
                </span>
                <span
                  title="Coming later"
                  className="inline-flex flex-1 cursor-not-allowed items-center justify-center rounded-btn border border-line px-3 py-2 text-sm font-medium text-faint"
                >
                  Mobile (soon)
                </span>
              </div>
              <Button fullWidth loading={busy} disabled={!email} onClick={sendCode}>
                Send code
              </Button>
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setMode('password')
                }}
                className="text-sm font-medium text-muted underline-offset-2 hover:underline"
              >
                Use my password instead
              </button>
            </>
          )}

          {mode === 'code' && (
            <>
              <Button fullWidth loading={busy} disabled={code.length !== 6} onClick={signInWithCode}>
                Sign in
              </Button>
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setNotice(null)
                  setCode('')
                  setMode('request')
                }}
                className="text-sm font-medium text-muted underline-offset-2 hover:underline"
              >
                Send a new code
              </button>
            </>
          )}
        </div>
      </div>

      <p className="mt-6 text-center text-sm font-normal text-muted">
        New here? Ask your contact at the company for an invite link.
      </p>
    </main>
  )
}
