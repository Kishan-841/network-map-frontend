'use client'

import { useRef, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { parseSpreadsheetSheets, downloadCsvTemplate } from '@/lib/spreadsheet'
import { readPlanSheet, PLAN_TEMPLATE_CSV, fmtDay } from '@/lib/visit-plan-sheet'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { IconUpload, IconDownload, IconWarn, IconSearch } from '@/components/ui/icons'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const STATE = {
  ok: { label: 'Ready', cls: 'bg-ok-tint text-ok' },
  fix: { label: 'Needs a pick', cls: 'bg-warn-tint text-warn' },
  error: { label: 'Error', cls: 'bg-bad-tint text-bad' },
}

/** Days column: "5 days · 2 Nov – 30 Nov". */
function daysText(dates) {
  if (!dates?.length) return 'No days left'
  if (dates.length === 1) return `1 day · ${fmtDay(dates[0])}`
  return `${dates.length} days · ${fmtDay(dates[0])} – ${fmtDay(dates[dates.length - 1])}`
}

/**
 * Search the buildings this planner may plan (2+ letters, 300 ms debounce).
 * The debounce lives in the change handler, not an effect — every setState
 * here runs in an event or a promise callback.
 */
function BuildingSearch({ rowNumber, candidates, onPick, disabled = false }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null) // null = not searched
  const timer = useRef(null)
  const latest = useRef('')

  function change(e) {
    const text = e.target.value
    setQ(text)
    clearTimeout(timer.current)
    latest.current = text.trim()
    if (latest.current.length < 2) {
      setResults(null)
      return
    }
    const asked = latest.current
    timer.current = setTimeout(() => {
      apiClient
        .get('/sales/tasks/buildings', { params: { q: asked } })
        .then((res) => {
          if (latest.current === asked) setResults(res.data.data)
        })
        .catch(() => {
          if (latest.current === asked) setResults([])
        })
    }, 300)
  }

  const list = results ?? candidates ?? []
  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        <input
          value={q}
          onChange={change}
          disabled={disabled}
          placeholder="Search a building"
          aria-label={`Search a building for row ${rowNumber}`}
          className="h-10 w-full rounded-btn border border-line bg-card pl-9 pr-3 text-sm text-ink outline-none placeholder:text-faint focus:border-fiber focus:ring-2 focus:ring-fiber/15 disabled:opacity-50"
        />
      </div>
      {results !== null && results.length === 0 && <p className="text-xs text-muted">No building you can plan matches.</p>}
      {list.length > 0 && (
        <ul className="max-h-40 overflow-y-auto rounded-btn border border-line">
          {list.map((b) => (
            <li key={b.id} className="border-b border-line/60 last:border-b-0">
              <button
                type="button"
                onClick={() => onPick(b)}
                disabled={disabled}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-paper disabled:opacity-50"
              >
                <span className="block truncate font-medium text-ink">{b.buildingName}</span>
                {b.formattedAddress && <span className="block truncate text-xs text-muted">{b.formattedAddress}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Upload a visit plan: read the sheet in the browser, preview it on the server,
 * let the planner fix names the server could not match, re-check, then save.
 *
 * The server is the judge — a pick is only a suggestion it resolves inside the
 * planner's scope and re-checks, so Save waits for a fresh preview in which
 * every included row is ready.
 */
export function UploadPlanModal({ onClose, onSaved }) {
  const fileInputRef = useRef(null)
  const [fileName, setFileName] = useState(null)
  const [sheetRows, setSheetRows] = useState(null) // rows read from the file
  const [items, setItems] = useState({}) // rowNumber → latest preview row
  const [summary, setSummary] = useState(null) // { people, totals, errors } of the latest preview
  const [include, setInclude] = useState({}) // rowNumber → bool
  const [picks, setPicks] = useState({}) // rowNumber → { assigneeId?, assigneeName?, buildingId?, buildingName? }
  const [stale, setStale] = useState(false) // picks / includes changed since the last preview
  const [assignees, setAssignees] = useState(null)
  const [busy, setBusy] = useState(null) // 'preview' | 'save' | null
  const [error, setError] = useState(null)
  // Every preview, pick, tick and reset bumps this; a preview answer is applied
  // only if nothing happened since it was asked — else it describes a plan the
  // screen no longer shows (or a different file whose row numbers collide).
  const previewSeq = useRef(0)
  const inFlight = useRef(null)

  function reset() {
    previewSeq.current += 1
    inFlight.current = null
    setFileName(null)
    setSheetRows(null)
    setItems({})
    setSummary(null)
    setInclude({})
    setPicks({})
    setStale(false)
    setError(null)
    setBusy(null)
  }

  /** Preview `rows` (with any picks attached) and merge the answers in. */
  async function runPreview(rows, pickMap, { first = false } = {}) {
    const seq = ++previewSeq.current
    inFlight.current = seq
    setBusy('preview')
    setError(null)
    try {
      const res = await apiClient.post('/sales/tasks/preview', {
        rows: rows.map((r) => {
          const p = pickMap[r.rowNumber] ?? {}
          return {
            ...r,
            ...(p.assigneeId ? { assigneeId: p.assigneeId } : {}),
            ...(p.buildingId ? { buildingId: p.buildingId } : {}),
          }
        }),
      })
      if (seq !== previewSeq.current) return
      const data = res.data.data
      setItems((prev) => ({ ...(first ? {} : prev), ...Object.fromEntries(data.rows.map((r) => [r.rowNumber, r])) }))
      setSummary({ people: data.people, totals: data.totals, errors: data.errors ?? [] })
      setStale(false)
      if (first) {
        // Error rows can't be fixed here and a row with no days left saves nothing.
        setInclude(Object.fromEntries(data.rows.map((r) => [r.rowNumber, r.state !== 'error' && r.dates.length > 0])))
        if (assignees === null && data.rows.some((r) => r.state === 'fix' && !r.employee.match)) {
          apiClient
            .get('/sales/tasks/assignees')
            .then((a) => setAssignees(a.data.data))
            .catch(() => setAssignees([]))
        }
      }
    } catch (err) {
      if (seq !== previewSeq.current) return
      const message = getApiErrorMessage(err, 'Could not check the sheet — try again')
      if (first) {
        // Nothing to review — back to the file step, with the reason.
        reset()
        setError(message)
      } else {
        setError(message)
      }
    } finally {
      if (inFlight.current === seq) {
        inFlight.current = null
        setBusy(null)
      }
    }
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    try {
      const { rows, error: readError } = readPlanSheet(await parseSpreadsheetSheets(file))
      if (readError) throw new Error(readError)
      if (rows.length === 0) throw new Error('No plan rows found under the header row')
      if (rows.length > 3000) throw new Error('Too many rows — up to 3,000 per sheet. Please split the file.')
      setFileName(file.name)
      setSheetRows(rows)
      setPicks({})
      await runPreview(rows, {}, { first: true })
    } catch (err) {
      setError(err.message || 'Could not read the file')
    }
  }

  function pick(rowNumber, patch) {
    previewSeq.current += 1
    setPicks((prev) => ({ ...prev, [rowNumber]: { ...prev[rowNumber], ...patch } }))
    setInclude((prev) => ({ ...prev, [rowNumber]: true }))
    setStale(true)
  }
  function toggle(rowNumber, on) {
    previewSeq.current += 1
    setInclude((prev) => ({ ...prev, [rowNumber]: on }))
    setStale(true)
  }

  const hasPicks = Object.keys(picks).length > 0
  const confirmLoss = () => !hasPicks || window.confirm('Close and lose your fixes?')
  const close = () => {
    if (confirmLoss()) onClose()
  }
  const back = () => {
    if (confirmLoss()) reset()
  }
  const checking = busy === 'preview'

  const included = (sheetRows ?? []).filter((r) => include[r.rowNumber])
  const recheck = () => runPreview(included, picks)
  const fixable = (item) => item.state === 'fix' || Boolean(picks[item.rowNumber])
  const notReady = included.filter((r) => items[r.rowNumber]?.state !== 'ok')
  const canSave =
    !stale && !busy && included.length > 0 && notReady.length === 0 && (summary?.errors?.length ?? 0) === 0

  async function save() {
    setBusy('save')
    setError(null)
    try {
      const res = await apiClient.post('/sales/tasks/import', {
        fileName: fileName ?? undefined,
        rows: included.map((r) => {
          const item = items[r.rowNumber]
          return {
            rowNumber: r.rowNumber,
            assigneeId: item.employee.match.id,
            buildingId: item.building.match.id,
            // The sheet's own strings — the server parses them again.
            date: r.date,
            startTime: item.startTime ?? null,
            endTime: item.endTime ?? null,
            until: r.until || null,
            weekdays: r.weekdays,
          }
        }),
      })
      const { created, replaced, assigned } = res.data.data
      onSaved(
        `Saved ${created} task${created === 1 ? '' : 's'} (${replaced} replaced, ${assigned} building${assigned === 1 ? '' : 's'} assigned)`,
      )
    } catch (err) {
      setError(getApiErrorMessage(err, 'Saving failed — nothing was changed'))
      setBusy(null)
    }
  }

  const footer = sheetRows ? (
    <div className="flex flex-col gap-2">
      {!canSave && !busy && included.length > 0 && (
        <p className="text-xs text-muted">
          {stale
            ? 'You changed the plan — check it again before saving.'
            : notReady.length
              ? `${notReady.length} included row${notReady.length === 1 ? '' : 's'} not ready — pick a person/building or untick ${notReady.length === 1 ? 'it' : 'them'}.`
              : summary?.errors?.[0]}
        </p>
      )}
      <div className="flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={back} disabled={Boolean(busy)}>
          Back
        </Button>
        {stale ? (
          <Button className="flex-1" loading={busy === 'preview'} disabled={included.length === 0} onClick={recheck}>
            Check again
          </Button>
        ) : (
          <Button className="flex-1" loading={busy === 'save'} disabled={!canSave} onClick={save}>
            Save {summary?.totals?.tasks ?? 0} task{summary?.totals?.tasks === 1 ? '' : 's'}
          </Button>
        )}
      </div>
    </div>
  ) : null

  return (
    <Modal
      open
      onClose={close}
      title="Upload a visit plan"
      footer={footer}
      wide={Boolean(sheetRows)}
      dismissable={!sheetRows}
    >
      {!sheetRows && (
        <div className="flex flex-col gap-4">
          <p className="text-sm font-normal text-muted">
            Upload a .xlsx or .csv with columns <b>Employee</b>, <b>Building</b>, <b>Date</b>, <b>Start time</b>,{' '}
            <b>End time</b>, <b>Repeat until</b> and <b>Mon</b>…<b>Sun</b>. Dates are DD-MM-YYYY. Leave every weekday
            empty for a one-off visit on Date; put <b>Y</b> under weekdays to repeat them from Date to Repeat until.
            Times are optional — leave both empty for &ldquo;any time that day&rdquo;.
          </p>
          <p className="text-sm font-normal text-muted">
            Saving replaces each person&apos;s unvisited tasks from today inside the sheet&apos;s dates. Visited tasks
            and past days are kept.
          </p>
          <input ref={fileInputRef} type="file" accept=".xlsx,.csv" onChange={handleFile} className="hidden" />
          <Button fullWidth loading={busy === 'preview'} onClick={() => fileInputRef.current?.click()}>
            <IconUpload className="h-4.5 w-4.5" /> Choose file
          </Button>
          <button
            type="button"
            onClick={() => downloadCsvTemplate('visit-plan-template.csv', PLAN_TEMPLATE_CSV)}
            className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-fiber hover:underline"
          >
            <IconDownload className="h-4 w-4" /> Download template
          </button>
          {error && <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>}
        </div>
      )}

      {sheetRows && (
        <div className="flex flex-col gap-4">
          <p className="text-sm font-normal text-muted">
            <b className="text-ink">{fileName}</b> · {sheetRows.length} row{sheetRows.length === 1 ? '' : 's'} ·{' '}
            {included.length} included
            {summary?.totals?.skippedPast ? ` · ${summary.totals.skippedPast} past day(s) skipped` : ''}
          </p>

          {summary && summary.people.length > 0 && !stale && (
            <div className="rounded-btn bg-paper p-3">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-faint">What saving does</p>
              <ul className="flex flex-col gap-1 text-sm">
                {summary.people.map((p) => (
                  <li key={p.assigneeId} className="min-w-0">
                    <b>{p.name}</b>: {p.tasks} task{p.tasks === 1 ? '' : 's'} · {fmtDay(p.from)}–{fmtDay(p.to)} · replaces{' '}
                    {p.replaces} · assigns {p.assigns}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {summary?.errors?.length > 0 && !stale && (
            <ul className="rounded-btn bg-bad-tint px-4 py-3 text-sm text-bad">
              {summary.errors.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
          {error && <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>}

          <ul className="flex flex-col gap-2" aria-label="Plan rows">
            {sheetRows.map((row) => {
              const item = items[row.rowNumber]
              const on = Boolean(include[row.rowNumber])
              const p = picks[row.rowNumber] ?? {}
              const st = item ? STATE[item.state] : null
              const showFix = item && fixable(item)
              const days = row.weekdays.some(Boolean)
                ? row.weekdays.map((d, i) => (d ? WEEKDAYS[i] : null)).filter(Boolean).join(' ')
                : null
              return (
                <li
                  key={row.rowNumber}
                  data-row={row.rowNumber}
                  className={`rounded-btn border border-line p-3 ${on ? '' : 'opacity-60'}`}
                >
                  <div className="flex items-center gap-2">
                    <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={on}
                        disabled={checking}
                        onChange={(e) => toggle(row.rowNumber, e.target.checked)}
                        aria-label={`Include row ${row.rowNumber}`}
                      />
                      <span className="font-semibold">Row {row.rowNumber}</span>
                    </label>
                    {st && (
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${st.cls}`}>
                        {stale && (p.assigneeId || p.buildingId) ? 'Picked — check again' : st.label}
                      </span>
                    )}
                  </div>

                  <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[6rem_1fr]">
                    <dt className="text-xs font-medium text-faint sm:pt-0.5">Employee</dt>
                    <dd className="min-w-0">
                      {p.assigneeName ? (
                        <span className="font-medium">{p.assigneeName}</span>
                      ) : item?.employee.match ? (
                        <span className="font-medium">{item.employee.match.name}</span>
                      ) : (
                        <span className="text-bad">{row.employee || 'missing'} — not found</span>
                      )}
                      {showFix && (!item.employee.match || p.assigneeId) && (
                        <select
                          className="mt-1.5 h-10 w-full rounded-btn border border-line bg-card px-3 text-sm"
                          aria-label={`Pick the employee for row ${row.rowNumber}`}
                          value={p.assigneeId ?? ''}
                          disabled={checking}
                          onChange={(e) => {
                            const opts = item.employee.candidates.length ? item.employee.candidates : (assignees ?? [])
                            const who = opts.find((u) => u.id === e.target.value)
                            if (who) pick(row.rowNumber, { assigneeId: who.id, assigneeName: who.name })
                          }}
                        >
                          <option value="" disabled>
                            {item.employee.candidates.length ? 'Did you mean…' : assignees ? 'Pick a person' : 'Loading…'}
                          </option>
                          {(item.employee.candidates.length ? item.employee.candidates : (assignees ?? [])).map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </dd>

                    <dt className="text-xs font-medium text-faint sm:pt-0.5">Building</dt>
                    <dd className="min-w-0">
                      {p.buildingName ? (
                        <span className="font-medium">{p.buildingName}</span>
                      ) : item?.building.match ? (
                        <span className="font-medium">{item.building.match.buildingName}</span>
                      ) : (
                        <span className="text-bad">{row.building || 'missing'} — not found</span>
                      )}
                      {showFix && (!item.building.match || p.buildingId) && (
                        <div className="mt-1.5">
                          <BuildingSearch
                            rowNumber={row.rowNumber}
                            candidates={item.building.candidates}
                            disabled={checking}
                            onPick={(b) => pick(row.rowNumber, { buildingId: b.id, buildingName: b.buildingName })}
                          />
                        </div>
                      )}
                    </dd>

                    <dt className="text-xs font-medium text-faint sm:pt-0.5">Days</dt>
                    <dd className="min-w-0">
                      {!item || (item.state === 'error' && !item.dates.length) ? '—' : daysText(item.dates)}
                      {days && <span className="text-muted"> · {days}</span>}
                    </dd>

                    <dt className="text-xs font-medium text-faint sm:pt-0.5">Time</dt>
                    <dd>{item?.startTime && item?.endTime ? `${item.startTime}–${item.endTime}` : 'Any time'}</dd>
                  </dl>

                  {item?.errors?.length > 0 && (
                    <ul className="mt-2 text-xs text-bad">
                      {item.errors.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  )}
                  {item?.warnings?.length > 0 && (
                    <ul className="mt-2 text-xs text-warn">
                      {item.warnings.map((m) => (
                        <li key={m} className="flex items-start gap-1">
                          <IconWarn className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {m}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </Modal>
  )
}
