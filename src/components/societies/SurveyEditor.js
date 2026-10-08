'use client'

import { useEffect, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { IconPlus, IconTrash, IconOkCircle, IconChevronDown } from '@/components/ui/icons'
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
import {
  SURVEY_TABS,
  defaultOpenGroup,
  firstTabWithErrors,
  groupsWithErrors,
  materialGroupCounts,
  surveyTabCounts,
  surveyTabErrors,
} from '@/lib/society-page'

// Numbers are typed into text inputs with a numeric keyboard, not
// type="number": a number input changes value on a stray mouse-wheel scroll.
const numProps = { type: 'text', inputMode: 'numeric', pattern: '[0-9]*', autoComplete: 'off' }

const small =
  'h-11 w-full min-w-0 rounded-btn border bg-card px-3 text-[15px] text-ink outline-none placeholder:text-faint focus:ring-2'
const smallClass = (bad) =>
  `${small} ${bad ? 'border-bad/50 focus:border-bad focus:ring-bad/15' : 'border-line focus:border-fiber focus:ring-fiber/15'}`

function NumField({ id, label, value, onChange, unit, hint, bad, error, placeholder, decimal = false }) {
  return (
    <label htmlFor={id} className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-muted">{label}</span>
      <span className="relative">
        <input
          id={id}
          {...numProps}
          {...(decimal ? { inputMode: 'decimal', pattern: undefined } : {})}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={bad || error ? true : undefined}
          className={`${smallClass(Boolean(bad || error))} ${unit ? 'pr-11' : ''} text-right tabular-nums`}
        />
        {unit && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-normal text-muted">
            {unit}
          </span>
        )}
      </span>
      {hint && <span className="text-xs font-normal text-faint">{hint}</span>}
      {error && <span className="text-xs font-normal text-bad">{error}</span>}
    </label>
  )
}

function Toggle({ id, label, checked, onChange }) {
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center justify-between gap-3 py-1">
      <span className="min-w-0 text-sm font-medium text-ink">{label}</span>
      <span className="flex shrink-0 items-center gap-2.5">
        {/* Fixed width, so the switch doesn't shift between Yes and No. */}
        <span className={`w-7 text-right text-sm font-semibold ${checked ? 'text-ok' : 'text-bad'}`}>
          {checked ? 'Yes' : 'No'}
        </span>
        {/* A real checkbox (keyboard + screen readers), drawn as a switch:
            solid green track when on, grey when off, white knob that slides. */}
        <span className="relative inline-flex h-7 w-12 shrink-0">
          <input
            id={id}
            type="checkbox"
            role="switch"
            className="peer sr-only"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span
            aria-hidden="true"
            className="h-7 w-12 rounded-full bg-faint/40 transition-colors duration-200 peer-checked:bg-ok peer-focus-visible:ring-2 peer-focus-visible:ring-focus peer-focus-visible:ring-offset-2"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow-soft transition-transform duration-200 peer-checked:translate-x-5"
          />
        </span>
      </span>
    </label>
  )
}

function Block({ title, sub, children, action, divided = false }) {
  return (
    <div className={`min-w-0 ${divided ? 'border-t border-line pt-4' : ''}`}>
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

/** One tab button: its label, a subtle count of what it holds, a red count of its errors. */
function TabButton({ tab, selected, count, countTitle, errorCount, onSelect, onKey }) {
  return (
    <button
      type="button"
      role="tab"
      id={`survey-tab-${tab.key}`}
      aria-selected={selected}
      aria-controls="survey-tab-panel"
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      onKeyDown={onKey}
      className={`-mb-px inline-flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap border-b-2 px-2 text-[13px] font-medium transition-colors duration-200 sm:gap-1.5 sm:px-4 sm:text-sm ${
        selected ? 'border-fiber text-fiber' : 'border-transparent text-muted hover:text-ink'
      }`}
    >
      {tab.label}
      {count != null && (
        <span className="font-normal text-faint" title={countTitle}>
          · {count}
        </span>
      )}
      {errorCount > 0 && (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-bad px-1.5 text-xs font-semibold text-white">
          {errorCount}
          <span className="sr-only">{errorCount === 1 ? ' error' : ' errors'}</span>
        </span>
      )}
    </button>
  )
}

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
  // Tabs only choose what renders — the one form state above holds every tab.
  const [tab, setTab] = useState('checks')
  // Material groups the surveyor opened; the first group with items (or Fiber) to start.
  const [openGroups, setOpenGroups] = useState(() => new Set([defaultOpenGroup(form.materials)]))

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
  const tabErrors = surveyTabErrors(errors)
  const counts = surveyTabCounts(form)
  const groupCounts = materialGroupCounts(form.materials)
  const errorGroups = groupsWithErrors(errors?.materials)
  const toggleGroup = (key) =>
    setOpenGroups((open) => {
      const next = new Set(open)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const tabCount = {
    checks: [null],
    wings: [
      counts.wings + counts.links,
      `${counts.wings} ${counts.wings === 1 ? 'wing' : 'wings'}, ${counts.links} ${counts.links === 1 ? 'link' : 'links'}`,
    ],
    materials: [counts.materials, `${counts.materials} filled`],
  }
  // Arrow keys move between tabs (the WAI-ARIA tabs pattern).
  function onTabKey(e) {
    const i = SURVEY_TABS.findIndex((t) => t.key === tab)
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = SURVEY_TABS[(i + step + SURVEY_TABS.length) % SURVEY_TABS.length].key
    setTab(next)
    document.getElementById(`survey-tab-${next}`)?.focus()
  }

  async function save(submit) {
    const check = surveyErrors(form, { submit })
    const remarkMissing = needsRemark && !remark.trim()
    if (!check.ok || remarkMissing) {
      setShown(submit ? 'submit' : 'save')
      // Show a tab that has something to fix, unless this one does.
      setTab((t) => firstTabWithErrors(surveyTabErrors(check), t))
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
      <div role="tablist" aria-label="Survey parts" className="flex overflow-x-auto border-b border-line">
        {SURVEY_TABS.map((t) => (
          <TabButton
            key={t.key}
            tab={t}
            selected={tab === t.key}
            count={tabCount[t.key][0]}
            countTitle={tabCount[t.key][1]}
            errorCount={tabErrors[t.key]}
            onSelect={() => setTab(t.key)}
            onKey={onTabKey}
          />
        ))}
      </div>

      <div
        role="tabpanel"
        id="survey-tab-panel"
        aria-labelledby={`survey-tab-${tab}`}
        className="flex min-w-0 flex-col gap-4"
      >
        {tab === 'checks' && (
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
        )}

        {tab === 'wings' && (
          <>
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

            <Block divided title="Links between wings" sub="One row per cable run from one wing to another">
              <div className="flex flex-col gap-3">
                {form.links.length === 0 && (
                  <p className="text-sm font-normal text-muted">No links — add one per run.</p>
                )}
                {form.links.map((l, i) => (
                  <div key={l.id} className="min-w-0 rounded-btn border border-line bg-paper p-3">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8.5rem_7rem_auto] sm:items-end">
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
          </>
        )}

        {tab === 'materials' && (
          <Block title="Materials needed" sub="Leave blank what you do not need">
            <div className="divide-y divide-line overflow-hidden rounded-btn border border-line">
              {MATERIAL_GROUPS.map((g) => {
                const bad = errorGroups.has(g.key)
                const open = bad || openGroups.has(g.key)
                const n = groupCounts[g.key]
                return (
                  <div key={g.key} className="min-w-0">
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={`mat-group-${g.key}`}
                      onClick={() => toggleGroup(g.key)}
                      className="flex min-h-11 w-full items-center justify-between gap-3 px-3 text-left hover:bg-paper"
                    >
                      <span className="min-w-0 text-sm">
                        <span className="font-semibold text-ink">{g.label}</span>
                        <span className="font-normal text-muted">
                          {' '}
                          · {n > 0 ? `${n} filled` : g.unit === 'm' ? 'metres' : 'pieces'}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {bad && <span className="h-2 w-2 rounded-full bg-bad" aria-label="Has errors" role="img" />}
                        <IconChevronDown
                          className={`h-4 w-4 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                          aria-hidden="true"
                        />
                      </span>
                    </button>
                    {open && (
                      <div
                        id={`mat-group-${g.key}`}
                        className="grid grid-cols-2 gap-x-3 gap-y-3 px-3 pb-3 pt-1 sm:grid-cols-3 xl:grid-cols-4"
                      >
                        {g.items.map((item) => (
                          <NumField
                            key={item.key}
                            id={`mat-${item.key}`}
                            label={item.label}
                            unit={unitText(item.unit)}
                            placeholder="0"
                            value={form.materials[item.key] ?? ''}
                            onChange={(v) => setQty(item.key, v)}
                            error={errors?.materials[item.key]}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Block>
        )}
      </div>

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
