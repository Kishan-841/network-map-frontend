'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { bankFormErrors, bankPayload, isIfsc, normalizeIfsc } from '@/lib/bank'

/**
 * Bank details, used by the partner portal and by an admin. The account number
 * is never pre-filled (the partner only ever sees it masked); an admin editing
 * re-types it. Errors show after the first Save, then live.
 */
export function BankDetailsForm({ initial, client, lookupPath, onSubmit, submitLabel = 'Save bank details', busy = false }) {
  const [form, setForm] = useState({
    accountHolderName: initial?.accountHolderName ?? '',
    accountNumber: '',
    confirmAccountNumber: '',
    ifsc: initial?.ifsc ?? '',
    branchName: initial?.branchName ?? '',
    bankName: initial?.bankName ?? '',
  })
  const [attempted, setAttempted] = useState(false)
  const [lookup, setLookup] = useState(null) // { text } | { error }
  const errors = attempted ? bankFormErrors(form) : {}
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  async function onIfsc(value) {
    set({ ifsc: value.toUpperCase() })
    setLookup(null)
    // Staff have no lookup route (it is partner-auth): they pass lookupPath={null}.
    if (!isIfsc(value) || !lookupPath) return
    try {
      const res = await client.get(`${lookupPath}/${normalizeIfsc(value)}`)
      const { bank, branch, city } = res.data.data
      setLookup({ text: [bank, branch, city].filter(Boolean).join(', ') })
      setForm((f) => ({ ...f, bankName: bank ?? f.bankName, branchName: f.branchName || branch || '' }))
    } catch (err) {
      setLookup({ error: err?.response?.status === 404 ? 'We could not find this IFSC code' : null })
    }
  }

  async function save(e) {
    e.preventDefault()
    setAttempted(true)
    if (Object.keys(bankFormErrors(form)).length) return
    await onSubmit(bankPayload(form))
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3" noValidate>
      <div>
        <Input id="bank-holder" label="Account holder name" value={form.accountHolderName} error={errors.accountHolderName} onChange={(e) => set({ accountHolderName: e.target.value })} />
        {!errors.accountHolderName && <p className="mt-1 text-xs text-muted">As printed in your passbook</p>}
      </div>
      <Input id="bank-number" label="Account number" inputMode="numeric" autoComplete="off" value={form.accountNumber} error={errors.accountNumber} onChange={(e) => set({ accountNumber: e.target.value })} />
      <Input id="bank-number-2" label="Re-enter account number" inputMode="numeric" autoComplete="off" value={form.confirmAccountNumber} error={errors.confirmAccountNumber} onChange={(e) => set({ confirmAccountNumber: e.target.value })} onPaste={(e) => e.preventDefault()} />
      <div>
        <Input id="bank-ifsc" label="IFSC code" maxLength={11} value={form.ifsc} error={errors.ifsc ?? lookup?.error} onChange={(e) => onIfsc(e.target.value)} />
        {lookup?.text && <p className="mt-1 text-xs font-normal text-ok">{lookup.text}</p>}
      </div>
      <Input id="bank-branch" label="Branch" value={form.branchName} error={errors.branchName} onChange={(e) => set({ branchName: e.target.value })} />
      <Button type="submit" loading={busy} fullWidth>{submitLabel}</Button>
    </form>
  )
}
