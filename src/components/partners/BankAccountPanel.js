'use client'

import { useEffect, useRef, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { uploadFile } from '@/lib/upload'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { BankDetailsForm } from './BankDetailsForm'

/** Admin and sales manager only: the full account number, an edit, and a cheque replace. */
export function BankAccountPanel({ partnerId, onChanged }) {
  const [bank, setBank] = useState(undefined)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [tick, setTick] = useState(0)
  const chequeRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    apiClient
      .get(`/partners/${partnerId}/bank-account`)
      .then((res) => !cancelled && setBank(res.data.data))
      .catch((err) => !cancelled && setError(getApiErrorMessage(err, 'Could not load bank details')))
    return () => {
      cancelled = true
    }
  }, [partnerId, tick])

  async function save(payload) {
    setBusy(true)
    setError(null)
    try {
      await apiClient.put(`/partners/${partnerId}/bank-account`, payload)
      setEditing(false)
      setTick((t) => t + 1)
      onChanged?.()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save bank details'))
    } finally {
      setBusy(false)
    }
  }

  async function replaceCheque(file) {
    setBusy(true)
    setError(null)
    try {
      const url = await uploadFile(file, apiClient)
      await apiClient.post(`/partners/${partnerId}/documents`, { type: 'CANCELLED_CHEQUE', url })
      onChanged?.()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not replace the cheque'))
    } finally {
      setBusy(false)
    }
  }

  const rows = bank
    ? [
        ['Account holder', bank.accountHolderName],
        ['Account number', bank.accountNumber],
        ['IFSC', bank.ifsc],
        ['Bank', bank.bankName],
        ['Branch', bank.branchName],
      ]
    : []

  return (
    <div className="rounded-card border border-line p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold">Bank account</p>
        <div className="flex gap-2">
          <input ref={chequeRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) replaceCheque(f) }} />
          <Button variant="secondary" className="!h-9 !min-h-9 px-3 text-sm" disabled={busy} onClick={() => chequeRef.current?.click()}>Replace cheque</Button>
          <Button variant="secondary" className="!h-9 !min-h-9 px-3 text-sm" disabled={busy || bank === undefined} onClick={() => setEditing(true)}>{bank ? 'Edit' : 'Add'}</Button>
        </div>
      </div>
      {bank === undefined && !error && <p className="mt-2 text-sm font-normal text-muted">Loading…</p>}
      {bank === null && <p className="mt-2 text-sm font-normal text-muted">No bank details yet.</p>}
      {bank && (
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-normal text-muted">{k}</dt>
              <dd className="flex items-center gap-2 font-medium">
                {v || '—'}
                {k === 'Account number' && (
                  <button type="button" className="text-xs font-medium text-fiber" onClick={() => navigator.clipboard?.writeText(v)}>Copy</button>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {error && <p className="mt-2 rounded-btn bg-bad-tint px-3 py-2 text-sm font-normal text-bad">{error}</p>}
      {editing && (
        <Modal open onClose={() => !busy && setEditing(false)} title="Bank details">
          <BankDetailsForm initial={bank} client={apiClient} lookupPath="/partners/ifsc" busy={busy} onSubmit={save} />
        </Modal>
      )}
    </div>
  )
}

/** The roster's entry point: the panel in a modal. */
export function BankAccountModal({ partnerId, partnerName, onClose }) {
  return (
    <Modal open onClose={onClose} title={`${partnerName} — bank account`}>
      <BankAccountPanel partnerId={partnerId} />
    </Modal>
  )
}
