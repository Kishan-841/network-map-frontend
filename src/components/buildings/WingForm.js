'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { wingFormErrors, WING_NAME_MAX } from '@/lib/building-wings'

/**
 * Name / home pass / live for one wing. `otherNames`: the building's OTHER wings.
 * `canMarkLive` false (a surveyor — only admins or managers mark live) shows the
 * wing's Live as text instead of a switch; the API keeps it unchanged anyway.
 */
export function WingForm({ initial, otherNames, onSave, onCancel, onDelete, canMarkLive = true }) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    homePass: initial?.homePass != null ? String(initial.homePass) : '',
    isLive: Boolean(initial?.isLive),
  })
  const [errors, setErrors] = useState({})
  const submit = (e) => {
    e.preventDefault()
    const found = wingFormErrors(form, otherNames)
    setErrors(found)
    if (Object.keys(found).length) return
    onSave({ name: form.name.trim(), homePass: Number(form.homePass), isLive: form.isLive })
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Input id="wing-name" label="Wing name" placeholder="e.g. A" maxLength={WING_NAME_MAX} value={form.name}
        error={errors.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
      <Input id="wing-homepass" label="Home pass" type="number" inputMode="numeric" min={0} value={form.homePass}
        error={errors.homePass} onChange={(e) => setForm((f) => ({ ...f, homePass: e.target.value }))} />
      {canMarkLive ? (
        <label className="flex min-h-11 items-center justify-between gap-3 rounded-btn border border-line px-3 text-sm">
          <span className="font-medium text-ink">Live</span>
          <input type="checkbox" className="toggle toggle-success" checked={form.isLive}
            onChange={(e) => setForm((f) => ({ ...f, isLive: e.target.checked }))} />
        </label>
      ) : (
        <div className="flex min-h-11 items-center justify-between gap-3 rounded-btn border border-line px-3 text-sm">
          <span className="font-medium text-ink">Live</span>
          <span className={form.isLive ? 'text-ok' : 'text-bad'}>{form.isLive ? 'Live' : 'Not live'}</span>
        </div>
      )}
      <div className="flex gap-2">
        {onDelete && <Button type="button" variant="dangerGhost" onClick={onDelete}>Delete</Button>}
        <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button type="submit" className="flex-1">Done</Button>
      </div>
    </form>
  )
}
