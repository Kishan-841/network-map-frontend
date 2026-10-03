'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { partnerApi, getPartnerApiError } from '@/lib/partner-api-client'
import { usePartnerAuthStore } from '@/stores/partner-auth-store'
import { uploadFile } from '@/lib/upload'
import { Button } from '@/components/ui/Button'
import { IconDoc, IconOkCircle } from '@/components/ui/icons'
import { BankDetailsForm } from '@/components/partners/BankDetailsForm'

const DOC_META = {
  AADHAAR: { label: 'Aadhaar card', hint: 'Front and back in one image, or a PDF' },
  PAN: { label: 'PAN card', hint: 'A clear photo of the card' },
  CANCELLED_CHEQUE: { label: 'Cancelled cheque', hint: 'A cheque from this account with "CANCELLED" written across it' },
}

const STATUS_COPY = {
  REGISTERED: {
    tone: 'bg-doc-tint text-doc',
    title: 'Upload your documents',
    body: 'We verify every partner before they can refer customers. Upload the documents below and we will review them.',
  },
  PENDING_APPROVAL: {
    tone: 'bg-doc-tint text-doc',
    title: 'With us for review',
    body: 'Your documents are in. Someone from our team will check them shortly — you will be able to start referring customers as soon as they do.',
  },
  REJECTED: {
    tone: 'bg-bad-tint text-bad',
    title: 'We need these again',
    body: 'Please replace the documents below and submit once more.',
  },
  APPROVED: {
    tone: 'bg-ok-tint text-ok',
    title: 'Verified',
    body: 'Your documents have been approved.',
  },
}

function DocumentSlot({ type, uploaded, busy, onPick }) {
  const inputRef = useRef(null)
  const meta = DOC_META[type]
  return (
    <div className="flex items-center gap-3 rounded-card border border-line bg-card p-4">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
          uploaded ? 'bg-ok-tint text-ok' : 'bg-paper text-faint'
        }`}
      >
        {uploaded ? <IconOkCircle className="h-5 w-5" /> : <IconDoc className="h-5 w-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{meta.label}</p>
        <p className="truncate text-xs font-normal text-muted">
          {uploaded ? 'Uploaded' : meta.hint}
        </p>
      </div>
      <input
        ref={inputRef}
        id={`doc-${type}`}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) onPick(type, file)
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="shrink-0 rounded-btn border border-line px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:border-faint hover:text-ink disabled:opacity-50"
      >
        {uploaded ? 'Replace' : 'Upload'}
      </button>
    </div>
  )
}

export default function PartnerDocumentsPage() {
  const router = useRouter()
  const partner = usePartnerAuthStore((s) => s.partner)
  const setPartner = usePartnerAuthStore((s) => s.setPartner)
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [tick, setTick] = useState(0)
  const [savingBank, setSavingBank] = useState(false)

  useEffect(() => {
    let cancelled = false
    partnerApi
      .get('/partner/onboarding')
      .then((res) => !cancelled && setData(res.data.data))
      .catch((err) => !cancelled && setError(getPartnerApiError(err, 'Could not load your documents')))
    return () => {
      cancelled = true
    }
  }, [tick])

  async function pick(type, file) {
    setBusy(true)
    setError(null)
    try {
      const url = await uploadFile(file, partnerApi)
      await partnerApi.post('/partner/documents', { type, url })
      setTick((t) => t + 1)
    } catch (err) {
      setError(getPartnerApiError(err, 'That upload did not go through'))
    } finally {
      setBusy(false)
    }
  }

  /**
   * TESTING ONLY — approve without uploading anything.
   *
   * Shown only when the SERVER says the shortcut is on (`bypassAvailable`),
   * never inferred in the browser: the flag is a server fact, and `env.js`
   * refuses to boot with it set in production, so this button cannot exist
   * there however the page is built.
   */
  async function bypass() {
    setBusy(true)
    setError(null)
    try {
      const res = await partnerApi.post('/partner/documents/bypass')
      setPartner({ ...partner, status: res.data.data.status })
      setTick((t) => t + 1)
    } catch (err) {
      setError(getPartnerApiError(err, 'Could not skip approval'))
    } finally {
      setBusy(false)
    }
  }

  async function saveBank(payload) {
    setSavingBank(true)
    setError(null)
    try {
      await partnerApi.put('/partner/bank-account', payload)
      setTick((t) => t + 1)
    } catch (err) {
      setError(getPartnerApiError(err, 'Could not save your bank details'))
    } finally {
      setSavingBank(false)
    }
  }

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const res = await partnerApi.post('/partner/documents/submit')
      setPartner({ ...partner, status: res.data.data.status })
      setTick((t) => t + 1)
    } catch (err) {
      setError(getPartnerApiError(err, 'Could not submit for approval'))
    } finally {
      setBusy(false)
    }
  }

  if (!data) {
    return <p className="text-sm font-normal text-muted">{error ?? 'Loading…'}</p>
  }

  const have = new Set(data.documents.map((d) => d.type))
  const complete = data.required.every((t) => have.has(t)) && Boolean(data.bankAccount)
  const status = STATUS_COPY[data.status] ?? STATUS_COPY.REGISTERED
  const editable = data.status === 'REGISTERED' || data.status === 'REJECTED'

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Your documents</h1>

      <div className="mt-4 rounded-card bg-card p-5 shadow-soft">
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${status.tone}`}>
          {status.title}
        </span>
        <p className="mt-3 text-sm font-normal text-muted">{status.body}</p>
        {data.status === 'REJECTED' && data.rejectionReason && (
          <p className="mt-3 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">
            {data.rejectionReason}
          </p>
        )}
        {data.status === 'APPROVED' && (
          <Button className="mt-4" onClick={() => router.replace('/partner')}>
            Go to my portal
          </Button>
        )}
      </div>

      {editable && (
        <>
          <div className="mt-4 flex flex-col gap-3">
            {data.required.map((type) => (
              <DocumentSlot
                key={type}
                type={type}
                uploaded={have.has(type)}
                busy={busy}
                onPick={pick}
              />
            ))}
          </div>
        </>
      )}

      {(editable || data.bankAccount || data.bankEditable) && (
        <section className="mt-4 rounded-card bg-card p-5 shadow-soft">
          <h2 className="font-bold">Bank account</h2>
          <p className="mt-1 text-sm font-normal text-muted">Where we pay your commission.</p>
          {data.bankAccount && (
            <p className="mt-3 text-sm font-medium">
              {data.bankAccount.accountHolderName} · {data.bankAccount.accountNumberMasked} · {data.bankAccount.ifsc}
              {data.bankAccount.bankName ? ` · ${data.bankAccount.bankName}` : ''}
            </p>
          )}
          {data.bankEditable ? (
            <div className="mt-4">
              <BankDetailsForm
                key={data.bankAccount?.accountNumberMasked ?? 'new'}
                initial={data.bankAccount}
                client={partnerApi}
                lookupPath="/partner/ifsc"
                busy={savingBank}
                submitLabel={data.bankAccount ? 'Update bank details' : 'Save bank details'}
                onSubmit={saveBank}
              />
            </div>
          ) : (
            <p className="mt-3 text-xs font-normal text-muted">Locked — contact your partner manager to change it.</p>
          )}
        </section>
      )}

      {error && (
        <p className="mt-3 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">
          {error}
        </p>
      )}

      {editable && (
        <>
          <Button
            className="mt-4"
            fullWidth
            loading={busy}
            disabled={!complete}
            onClick={submit}
          >
            {complete ? 'Submit for approval' : 'Add all documents and bank details to continue'}
          </Button>

          {/* Deliberately styled as scaffolding rather than a feature: dashed,
              muted, and labelled for what it is, so nobody mistakes it for
              part of the product. */}
          {data.bypassAvailable && (
            <div className="mt-6 rounded-card border border-dashed border-warn/50 bg-warn-tint/40 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-warn">
                Testing only
              </p>
              <p className="mt-1.5 text-sm font-normal text-muted">
                Approve this account without uploading anything, so testing does not put real
                identity documents in the bucket.
              </p>
              <button
                type="button"
                onClick={bypass}
                disabled={busy}
                className="mt-3 w-full rounded-btn border border-warn/60 px-4 py-2.5 text-sm font-medium text-warn transition-colors hover:bg-warn/10 disabled:opacity-50"
              >
                Skip documents and approve me
              </button>
            </div>
          )}
        </>
      )}
    </>
  )
}
