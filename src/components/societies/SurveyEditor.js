'use client'

import { useEffect, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { IconPlus, IconTrash, IconOkCircle } from '@/components/ui/icons'
import { MATERIAL_GROUPS, unitText } from '@/lib/society-materials'
import {
  LINK_METHODS,
  MAX_LINKS,
  MAX_WINGS,
  clearDraft,
  emptyLink,
  emptyWing,
  isFormDirty,
  loadDraft,
  removeWingAt,
  saveDraft,
  sessionStore,
  setWingField,
  surveyErrors,
  surveyPayload,
} from '@/lib/society-survey'

// Numbers are typed into text inputs with a numeric keyboard, not
// type="number": a number input changes value on a stray mouse-wheel scroll.
const numProps = { type: 'text', inputMode: 'numeric', pattern: '[0-9]*', autoComplete: 'off' }

const small =
  'h-11 w-full min-w-0 rounded-btn border bg-card px-3 text-[15px] text-ink outline-none placeholder:text-faint focus:ring-2'
const smallClass = (bad) =>
  `${small} ${bad ? 'border-bad/50 focus:border-bad focus:ring-bad/15' : 'border-line focus:border-fiber focus:ring-fiber/15'}`

function NumField({ id, label, value, onChange, unit, hint, bad, decimal = false }) {
  return (
    <label htmlFor={id} className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-muted">{label}</span>
      <span className="relative">
        <input
          id={id}
          {...numProps}
          {...(decimal ? { inputMode: 'decimal', pattern: undefined } : {})}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={bad ? true : undefined}
          className={`${smallClass(bad)} ${unit ? 'pr-10' : ''} text-right tabular-nums`}
        />
        {unit && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-normal text-muted">
            {unit}
          </span>
        )}
      </span>
      {hint && <span className="text-xs font-normal text-faint">{hint}</span>}
    </label>
  )
}

function Toggle({ id, label, checked, onChange }) {
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center justify-between gap-3 py-1">
      <span className="min-w-0 text-sm font-medium text-ink">{label}</span>
      <span className="flex shrink-0 items-center gap-2">
        <span className={`text-xs font-medium ${checked ? 'text-ok' : 'text-bad'}`}>{checked ? 'Yes' : 'No'}</span>
        <input
          id={id}
          type="checkbox"
          className="toggle toggle-success"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
      </span>
    </label>
  )
}

function Block({ title, sub, children, action }) {
  return (
    <div className="min-w-0 border-t border-line pt-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{title}</p>
          {sub && <p className="text-xs font-normal text-muted">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

const RowError = ({ msg }) => (msg ? <p className="mt-2 text-sm font-normal text-bad">{msg}</p> : null)

/**
 * The site survey + material request form. `initial` is the form from
 * surveyToForm; the parent remounts this (key) when the saved survey changes.
 * `remarkField`: 'required' (ADMIN, approved survey), 'optional' (ADMIN,
 * waiting survey) or null — the API records a remark only then.
 * `canSubmit`: Draft / Rejected may be sent for approval.
 *
 * Unsaved edits are kept in sessionStorage under `draftKey` (per user and
 * building) on top of the saved survey `basedOn` (its updatedAt), so Back, a
 * nav tap or a reload does not lose them; the page warns before unloading.
 * `onSaved(message, submitError?)` — a submit that failed after the save
 * still reports the save, with the error. `onCancel` (ADMIN) closes the editor.
 */
export function SurveyEditor({
  buildingId,
  initial,
  draftKey,
  basedOn,
  remarkField = null,
  canSubmit,
  expected,
  onSaved,
  onCancel,
}) {
  // Restored in the initialiser (not an effect): a draft kept on this device
  // for this very version of the survey.
  const [restored, setRestored] = useState(() => loadDraft(sessionStore(), draftKey, basedOn) !== null)
  const [form, setForm] = useState(() => loadDraft(sessionStore(), draftKey, basedOn) ?? initial)
  const [remark, setRemark] = useState('')
  const [shown, setShown] = useState(null) // errors after a save / submit attempt
  const [busy, setBusy] = useState(null) // 'save' | 'submit'
  const [error, setError] = useState(null)

  const needsRemark = remarkField === 'required'
  const dirty = isFormDirty(form, initial)

  // Keep the unsaved form on this device; drop it once it matches the saved one.
  useEffect(() => {
    if (dirty) saveDraft(sessionStore(), draftKey, form, basedOn)
    else clearDraft(sessionStore(), draftKey)
  }, [dirty, form, draftKey, basedOn])

  // Closing the tab or reloading with unsaved edits asks first.
  useEffect(() => {
    if (!dirty) return undefined
    const warn = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function discard() {
    clearDraft(sessionStore(), draftKey)
    setForm(initial)
    setRestored(false)
    setShown(null)
  }
  function cancel() {
    clearDraft(sessionStore(), draftKey)
    onCancel()
  }
  // Once an attempt failed, errors follow the form live.
  const errors = shown ? surveyErrors(form, { submit: shown === 'submit' }) : null

  const setCheck = (k, v) => setForm((f) => ({ ...f, checks: { ...f.checks, [k]: v } }))
  const setWing = (i, k, v) =>
    setForm((f) => ({ ...f, wings: f.wings.map((w, j) => (j === i ? setWingField(w, k, v) : w)) }))
  const addWing = () => setForm((f) => ({ ...f, wings: [...f.wings, emptyWing()] }))
  // Links point at wing rows by id: a rename carries through; a removed wing
  // leaves its links without that end, flagged for the surveyor to fix.
  const removeWing = (i) => setForm((f) => removeWingAt(f, i))
  const setLink = (i, k, v) =>
    setForm((f) => ({ ...f, links: f.links.map((l, j) => (j === i ? { ...l, [k]: v } : l)) }))
  const addLink = () => setForm((f) => ({ ...f, links: [...f.links, emptyLink()] }))
  const removeLink = (i) => setForm((f) => ({ ...f, links: f.links.filter((_, j) => j !== i) }))
  const setQty = (key, v) => setForm((f) => ({ ...f, materials: { ...f.materials, [key]: v } }))

  const namedWings = form.wings.filter((w) => w.name.trim())

  async function save(submit) {
    const check = surveyErrors(form, { submit })
    const remarkMissing = needsRemark && !remark.trim()
    if (!check.ok || remarkMissing) {
      setShown(submit ? 'submit' : 'save')
      if (remarkMissing) setError('Say what you changed, and why')
      return
    }
    setBusy(submit ? 'submit' : 'save')
    setError(null)
    try {
      const body = surveyPayload(form)
      if (remarkField && remark.trim()) body.remark = remark.trim()
      await apiClient.put(`/permission-buildings/${buildingId}/survey`, body)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save the survey'))
      setBusy(null)
      return
    }
    // Saved: the draft on this device is no longer needed.
    clearDraft(sessionStore(), draftKey)
    if (!submit) return onSaved('Survey saved')
    try {
      await apiClient.post(`/permission-buildings/${buildingId}/survey/submit`)
      onSaved('Survey sent to the admin')
    } catch (err) {
      // The save stands — the page reloads it and shows why it was not sent.
      onSaved('Survey saved — not submitted', getApiErrorMessage(err, 'Could not submit the survey'))
    }
  }

  const c = form.checks
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {restored && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-btn border border-fiber/30 bg-fiber-tint px-4 py-2.5 text-sm font-medium text-fiber"
        >
          <span>Restored your unsaved survey from this device.</span>
          <button type="button" onClick={discard} className="min-h-9 underline underline-offset-2">
            Discard
          </button>
        </div>
      )}
      <Block title="Checks" sub="Compare what you see on site with the executive’s details">
        <div className="divide-y divide-line/60">
          <Toggle
            id="chk-name"
            label="Building name is right"
            checked={c.nameOk}
            onChange={(v) => setCheck('nameOk', v)}
          />
          {!c.nameOk && (
            <div className="pb-3">
              <Input
                id="chk-name-fix"
                label="Correct name"
                maxLength={200}
                value={c.nameCorrection}
                onChange={(e) => setCheck('nameCorrection', e.target.value)}
                placeholder="As written on the board"
              />
            </div>
          )}
          <Toggle
            id="chk-wings"
            label={`Wings match${expected?.wings != null ? ` (executive: ${expected.wings})` : ''}`}
            checked={c.wingsOk}
            onChange={(v) => setCheck('wingsOk', v)}
          />
          <Toggle
            id="chk-homepass"
            label={`Home pass matches${expected?.homePass != null ? ` (executive: ${expected.homePass})` : ''}`}
            checked={c.homePassOk}
            onChange={(v) => setCheck('homePassOk', v)}
          />
        </div>
        <div className="mt-3">
          <Textarea
            id="chk-note"
            label="Note (optional)"
            rows={2}
            maxLength={1000}
            value={c.note}
            onChange={(e) => setCheck('note', e.target.value)}
            placeholder="Anything the admin should know"
          />
        </div>
      </Block>

      <Block title="Wings" sub="Home pass fills in as floors × flats per floor — change it if some flats differ">
        <div className="flex flex-col gap-3">
          {form.wings.map((w, i) => (
            <div key={w.id} className="min-w-0 rounded-btn border border-line bg-paper p-3">
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <label htmlFor={`wing-${i}-name`} className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted">Wing name</span>
                    <input
                      id={`wing-${i}-name`}
                      value={w.name}
                      maxLength={20}
                      onChange={(e) => setWing(i, 'name', e.target.value)}
                      placeholder={`e.g. ${String.fromCharCode(65 + (i % 26))}`}
                      className={smallClass(Boolean(errors?.wings[i]))}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => removeWing(i)}
                  aria-label={`Remove wing ${w.name || i + 1}`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn text-muted hover:bg-bad-tint hover:text-bad"
                >
                  <IconTrash className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <NumField
                  id={`wing-${i}-floors`}
                  label="Floors"
                  value={w.floors}
                  onChange={(v) => setWing(i, 'floors', v)}
                />
                <NumField
                  id={`wing-${i}-flats`}
                  label="Flats / floor"
                  value={w.flatsPerFloor}
                  onChange={(v) => setWing(i, 'flatsPerFloor', v)}
                />
                <NumField
                  id={`wing-${i}-shafts`}
                  label="Shafts"
                  value={w.shafts}
                  onChange={(v) => setWing(i, 'shafts', v)}
                />
                <NumField
                  id={`wing-${i}-hp`}
                  label="Home pass"
                  value={w.homePass}
                  onChange={(v) => setWing(i, 'homePass', v)}
                  hint={w.homePassEdited ? 'Typed' : 'Auto'}
                />
              </div>
              <RowError msg={errors?.wings[i]} />
            </div>
          ))}
          {form.wings.length < MAX_WINGS && (
            <Button type="button" variant="secondary" onClick={addWing}>
              <IconPlus className="h-4 w-4" aria-hidden="true" />
              Add wing
            </Button>
          )}
        </div>
      </Block>

      <Block title="Links between wings" sub="One row per cable run from one wing to another">
        <div className="flex flex-col gap-3">
          {form.links.length === 0 && <p className="text-sm font-normal text-muted">No links — add one per run.</p>}
          {form.links.map((l, i) => (
            <div key={l.id} className="min-w-0 rounded-btn border border-line bg-paper p-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1fr_8rem_auto] sm:items-end">
                <Select
                  id={`link-${i}-from`}
                  label="From"
                  value={l.from}
                  onChange={(e) => setLink(i, 'from', e.target.value)}
                  className="h-11 min-w-0"
                >
                  <option value="">Wing…</option>
                  {namedWings.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name.trim()}
                    </option>
                  ))}
                </Select>
                <Select
                  id={`link-${i}-to`}
                  label="To"
                  value={l.to}
                  onChange={(e) => setLink(i, 'to', e.target.value)}
                  className="h-11 min-w-0"
                >
                  <option value="">Wing…</option>
                  {namedWings.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name.trim()}
                    </option>
                  ))}
                </Select>
                <div className="col-span-2 min-w-0 sm:col-span-1">
                  <Select
                    id={`link-${i}-method`}
                    label="How"
                    value={l.method}
                    onChange={(e) => setLink(i, 'method', e.target.value)}
                    className="h-11 w-full min-w-0"
                  >
                    {LINK_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <NumField
                  id={`link-${i}-m`}
                  label="Length (optional)"
                  unit="m"
                  decimal
                  value={l.meters}
                  onChange={(v) => setLink(i, 'meters', v)}
                />
                <button
                  type="button"
                  onClick={() => removeLink(i)}
                  aria-label={`Remove link ${i + 1}`}
                  className="flex h-11 items-center justify-center gap-2 self-end rounded-btn text-sm font-medium text-muted hover:bg-bad-tint hover:text-bad sm:w-11"
                >
                  <IconTrash className="h-4 w-4" aria-hidden="true" />
                  <span className="sm:hidden">Remove</span>
                </button>
              </div>
              <RowError msg={errors?.links[i]} />
            </div>
          ))}
          {form.links.length < MAX_LINKS && (
            <Button type="button" variant="secondary" onClick={addLink} disabled={namedWings.length < 2}>
              <IconPlus className="h-4 w-4" aria-hidden="true" />
              Add link
            </Button>
          )}
          {namedWings.length < 2 && <p className="text-xs font-normal text-faint">Name two wings first.</p>}
        </div>
      </Block>

      <Block title="Materials needed" sub="Leave blank what you do not need">
        <div className="flex flex-col gap-4">
          {MATERIAL_GROUPS.map((g) => (
            <fieldset key={g.key} className="min-w-0">
              <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-faint">
                {g.label} · {g.unit === 'm' ? 'metres' : 'pieces'}
              </legend>
              <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                {g.items.map((item) => {
                  const bad = errors?.materials[item.key]
                  return (
                    <div
                      key={item.key}
                      className="flex min-w-0 items-center justify-between gap-3 border-b border-line/60 py-1.5"
                    >
                      <label htmlFor={`mat-${item.key}`} className="min-w-0 text-sm font-normal text-ink">
                        {item.label}
                        {bad && <span className="block text-xs text-bad">{bad}</span>}
                      </label>
                      <span className="relative w-32 shrink-0">
                        <input
                          id={`mat-${item.key}`}
                          {...numProps}
                          placeholder="0"
                          value={form.materials[item.key] ?? ''}
                          onChange={(e) => setQty(item.key, e.target.value)}
                          aria-invalid={bad ? true : undefined}
                          className={`${smallClass(Boolean(bad))} pr-11 text-right tabular-nums`}
                        />
                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-normal text-muted">
                          {unitText(item.unit)}
                        </span>
                      </span>
                    </div>
                  )
                })}
              </div>
            </fieldset>
          ))}
        </div>
      </Block>

      {remarkField && (
        <div className="border-t border-line pt-4">
          <Textarea
            id="survey-remark"
            label={needsRemark ? 'What changed, and why?' : 'What changed, and why? (optional)'}
            rows={3}
            maxLength={1000}
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder={
              needsRemark
                ? 'The materials are already approved — this edit is logged'
                : 'Logged in the history with this edit'
            }
          />
        </div>
      )}

      {errors && !errors.ok && (
        <div role="alert" className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">
          {errors.form.length > 0 ? errors.form.join(' · ') : 'Fix the rows marked in red'}
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={cancel} disabled={Boolean(busy)} className="sm:flex-1">
            Cancel
          </Button>
        )}
        <Button
          type="button"
          variant={canSubmit ? 'secondary' : 'primary'}
          onClick={() => save(false)}
          loading={busy === 'save'}
          disabled={Boolean(busy)}
          className="sm:flex-1"
        >
          {canSubmit ? 'Save draft' : 'Save changes'}
        </Button>
        {canSubmit && (
          <Button
            type="button"
            onClick={() => save(true)}
            loading={busy === 'submit'}
            disabled={Boolean(busy)}
            className="sm:flex-1"
          >
            <IconOkCircle className="h-4 w-4" aria-hidden="true" />
            Submit for approval
          </Button>
        )}
      </div>
    </div>
  )
}
