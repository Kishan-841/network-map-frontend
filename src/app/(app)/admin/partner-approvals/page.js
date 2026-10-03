'use client'

import { useEffect, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { IconOkCircle } from '@/components/ui/icons'
import { BankAccountPanel } from '@/components/partners/BankAccountPanel'

const TYPE_LABEL = {
  AGENT: 'Agent',
  SOCIETY_REPRESENTATIVE: 'Society representative',
  RETAIL_SHOP: 'Retail shop',
  DSA: 'DSA',
}
const DOC_LABEL = { AADHAAR: 'Aadhaar card', PAN: 'PAN card', CANCELLED_CHEQUE: 'Cancelled cheque' }
const isPdf = (url = '') => url.split('?')[0].toLowerCase().endsWith('.pdf')

/** Documents arrive as short-lived signed URLs; they are not public links. */
function PartnerCard({ partner, onDone, setError }) {
  const [docs, setDocs] = useState(null)
  const [busy, setBusy] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [docsTick, setDocsTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    apiClient
      .get(`/partners/${partner.id}/documents`)
      .then((res) => !cancelled && setDocs(res.data.data))
      .catch(() => !cancelled && setDocs([]))
    return () => {
      cancelled = true
    }
  }, [partner.id, docsTick])

  async function decide(action, body) {
    setBusy(true)
    setError(null)
    try {
      await apiClient.post(`/partners/${partner.id}/${action}`, body)
      setRejecting(false)
      onDone()
    } catch (err) {
      setError(getApiErrorMessage(err, `Could not ${action} this partner`))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-card bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold">{partner.name}</p>
          <p className="truncate text-sm font-normal text-muted">
            {TYPE_LABEL[partner.type] ?? partner.type}
            {partner.companyName ? ` · ${partner.companyName}` : ''}
          </p>
          <p className="mt-1 truncate text-xs font-normal text-faint">
            {partner.email} · {partner.mobile}
            {partner.onboardedBy ? ` · onboarded by ${partner.onboardedBy.name}` : ' · unattributed'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="dangerGhost" disabled={busy} onClick={() => setRejecting(true)}>
            Reject
          </Button>
          <Button loading={busy} onClick={() => decide('approve')}>
            Approve
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {(docs ?? []).map((doc) => (
          <a
            key={doc.id}
            href={doc.url}
            target="_blank"
            rel="noreferrer"
            className="group overflow-hidden rounded-card border border-line transition-colors hover:border-fiber"
          >
            {isPdf(doc.url) ? (
              <span className="flex h-28 items-center justify-center text-sm font-normal text-muted">
                PDF
              </span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={doc.url} alt={DOC_LABEL[doc.type]} className="h-28 w-full object-cover" />
            )}
            <span className="block border-t border-line px-2 py-1.5 text-xs font-medium">
              {DOC_LABEL[doc.type] ?? doc.type}
            </span>
          </a>
        ))}
        {docs?.length === 0 && (
          <p className="col-span-full text-sm font-normal text-muted">No documents uploaded.</p>
        )}
      </div>

      <div className="mt-4">
        <BankAccountPanel partnerId={partner.id} onChanged={() => setDocsTick((t) => t + 1)} />
      </div>

      {rejecting && (
        <Modal
          open
          onClose={() => !busy && setRejecting(false)}
          title={`Reject ${partner.name}?`}
          footer={
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" disabled={busy} onClick={() => setRejecting(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                loading={busy}
                disabled={reason.trim().length < 3}
                onClick={() => decide('reject', { reason: reason.trim() })}
              >
                Reject
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-3">
            <p className="text-sm font-normal text-muted">
              They will see this reason and can upload again, so say what was wrong.
            </p>
            <Input
              id="reject-reason"
              label="Reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </Modal>
      )}
    </section>
  )
}

export default function PartnerApprovalsPage() {
  const [pending, setPending] = useState(null)
  const [error, setError] = useState(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    apiClient
      .get('/partners?status=PENDING_APPROVAL')
      .then((res) => !cancelled && setPending(res.data.data))
      .catch((err) => !cancelled && setError(getApiErrorMessage(err, 'Could not load the queue')))
    return () => {
      cancelled = true
    }
  }, [tick])

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 lg:px-8">
      <PageHeader
        title="Partner approvals"
        sub="Verify documents before a partner can refer customers"
        backHref="/dashboard"
        backLabel="Dashboard"
      />

      {error && (
        <p className="mb-3 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>
      )}

      {pending === null && <p className="text-sm font-normal text-muted">Loading…</p>}

      {pending?.length === 0 && (
        <div className="flex flex-col items-center rounded-card bg-card px-6 py-16 text-center shadow-soft">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ok-tint text-ok">
            <IconOkCircle className="h-7 w-7" strokeWidth={1.8} />
          </span>
          <p className="mt-4 font-bold">Nothing waiting</p>
          <p className="mt-1 text-sm font-normal text-muted">
            Every partner who has submitted documents has been reviewed.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {(pending ?? []).map((partner) => (
          <PartnerCard
            key={partner.id}
            partner={partner}
            setError={setError}
            onDone={() => setTick((t) => t + 1)}
          />
        ))}
      </div>
    </main>
  )
}
