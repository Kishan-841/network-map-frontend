'use client'

import { useRef, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { parseSpreadsheetSheets, downloadCsvTemplate } from '@/lib/spreadsheet'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { IconOkCircle, IconUpload, IconWarn } from '@/components/ui/icons'
import {
  CUSTOMER_TEMPLATE_CSV,
  batchByBuilding,
  customerBuildingNames,
  mapCustomerSheet,
  toImportRow,
} from '@/lib/customers'

const keyOf = (r) => `${r.sheet}:${r.row}`
const OUTCOME_LABEL = { create: 'New', update: 'Update', unchanged: 'Unchanged', skip: 'Skipped' }

const emptyTotals = () => ({
  createdCount: 0,
  updatedCount: 0,
  unchangedCount: 0,
  rows: [],
  skipped: [],
  flagged: [],
  notInSheet: [],
})

/**
 * Post the rows batch by batch (one building per batch, sequentially), summing
 * the counts and joining the lists. On a failed batch it stops and returns what
 * the earlier batches produced, plus the failure.
 */
async function runBatches(importable, dryRun, onProgress) {
  const batches = batchByBuilding(importable.map(toImportRow))
  const totals = emptyTotals()
  let done = 0
  for (let i = 0; i < batches.length; i++) {
    onProgress(i + 1, batches.length)
    try {
      const body = dryRun ? { rows: batches[i], dryRun: true } : { rows: batches[i] }
      const d = (await apiClient.post('/customers/import', body)).data.data
      totals.createdCount += d.createdCount
      totals.updatedCount += d.updatedCount
      totals.unchangedCount += d.unchangedCount
      totals.rows.push(...(d.rows ?? []))
      totals.skipped.push(...(d.skipped ?? []))
      totals.flagged.push(...(d.flagged ?? []))
      totals.notInSheet.push(...(d.notInSheet ?? []))
      done++
    } catch (err) {
      return {
        totals,
        done,
        failure: `Batch ${i + 1} of ${batches.length} failed: ${getApiErrorMessage(err, 'Import failed')}. Batches already imported stay imported.`,
        failureShort: getApiErrorMessage(err, 'Check failed'),
      }
    }
  }
  return { totals, done, failure: null }
}

function flagNote(preview, key) {
  const [sheet, row] = [key.slice(0, key.lastIndexOf(':')), key.slice(key.lastIndexOf(':') + 1)]
  return preview.flagged.find((f) => f.sheet === sheet && String(f.row) === row)?.note ?? 'Check this row'
}

function clientSkips(m, pk) {
  return [
    ...m.skipped,
    ...m.needsPick
      .filter((r) => !pk[keyOf(r)])
      .map((r) => ({ sheet: r.sheet, row: r.row, name: r.name, reason: 'Choose a building' })),
  ]
}

function SkippedList({ items, max = 'max-h-32' }) {
  if (items.length === 0) return null
  return (
    <div className="rounded-btn bg-paper p-3">
      <p className="mb-1 flex items-center gap-2 text-xs font-medium text-muted">
        <IconWarn className="h-4 w-4" /> Skipped {items.length}
      </p>
      <ul className={`${max} overflow-y-auto text-xs font-normal text-muted`}>
        {items.map((s, i) => (
          <li key={`${s.sheet ?? ''}:${s.row}:${i}`}>
            {s.sheet ? `${s.sheet}·` : 'Row '}
            {s.row} — {s.name}: {s.reason}
          </li>
        ))}
      </ul>
    </div>
  )
}

function FlaggedList({ items, max = 'max-h-32' }) {
  if (items.length === 0) return null
  return (
    <div className="rounded-btn bg-paper p-3">
      <p className="mb-1 flex items-center gap-2 text-xs font-medium text-muted">
        <IconWarn className="h-4 w-4 text-warn" /> Flagged {items.length}
      </p>
      <ul className={`${max} overflow-y-auto text-xs font-normal text-muted`}>
        {items.map((f, i) => (
          <li key={`${f.sheet ?? ''}:${f.row}:${i}`}>
            {f.sheet}·{f.row} — {f.name}: {f.note}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Upload the ISP's billing sheet. Rows are mapped in the browser, building
 * names resolved server-side in one lookup, then a dry run asks the server what
 * would be new / updated / unchanged before anything is written.
 *
 * Three stages, like ImportBuildingsModal: pick → review → result. When
 * `forcedBuilding` is given (the per-building entry) every row is pinned to that
 * building and rows naming a different one are filtered out, with no lookup.
 */
export function ImportCustomersModal({ forcedBuilding = null, onClose, onImported }) {
  const fileInputRef = useRef(null)
  const [stage, setStage] = useState('pick')
  const [mapped, setMapped] = useState(null)
  const [picks, setPicks] = useState({})
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(null)
  const [preview, setPreview] = useState(null)
  const [stale, setStale] = useState(false)
  const picksVersion = useRef(0)

  const picked = (r) => picks[keyOf(r)]
  const withPicks = (m, pk) => [
    ...m.ready,
    ...m.needsPick
      .filter((r) => pk[keyOf(r)])
      .map((r) => ({ ...r, buildingId: pk[keyOf(r)].id, buildingName: pk[keyOf(r)].buildingName })),
  ]
  const pendingPick = mapped ? mapped.needsPick.filter((r) => !picked(r)) : []
  const importable = mapped ? withPicks(mapped, picks) : []

  async function runDry(m, pk) {
    setBusy(true)
    setError(null)
    const version = picksVersion.current
    const run = await runBatches(withPicks(m, pk), true, (i, n) => setProgress(`Checking ${i} of ${n}…`))
    setProgress(null)
    if (version !== picksVersion.current) {
      // A pick changed while this check ran: its result is out of date.
      setStale(true)
    } else if (run.failure) {
      setPreview(null)
      setStale(true)
      setError(`Could not check the file: ${run.failureShort}`)
    } else {
      const byKey = {}
      for (const r of run.totals.rows) byKey[keyOf(r)] = r
      setPreview({ ...run.totals, byKey })
      setStale(false)
    }
    setBusy(false)
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    setBusy(true)
    let m
    try {
      const sheets = await parseSpreadsheetSheets(file)
      if (forcedBuilding) {
        m = mapCustomerSheet(sheets, {}, forcedBuilding)
      } else {
        const names = customerBuildingNames(sheets)
        if (names.length === 0) throw new Error('No sheet has the customer columns (Name, Mobile No., building).')
        const res = await apiClient.post('/customers/building-lookup', { names })
        m = mapCustomerSheet(sheets, res.data.data)
      }
      if (m.error) throw new Error(m.error)
      if (m.ready.length + m.needsPick.length + m.skipped.length === 0) {
        throw new Error('No customer rows found in the file')
      }
    } catch (err) {
      setError(err.message || 'Could not read the file')
      setBusy(false)
      return
    }
    picksVersion.current += 1
    setMapped(m)
    setPicks({})
    setPreview(null)
    setStale(false)
    setStage('review')
    await runDry(m, {})
  }

  function handlePick(key, found) {
    picksVersion.current += 1
    setPicks((p) => ({ ...p, [key]: found }))
    setStale(true)
  }

  async function handleImport() {
    setBusy(true)
    setError(null)
    const run = await runBatches(importable, false, (i, n) => setProgress(`Importing ${i} of ${n}…`))
    setProgress(null)
    const clientSkipped = clientSkips(mapped, picks)
    if (run.done > 0) onImported()
    if (run.failure && run.done === 0) {
      setError(run.failure)
    } else {
      setResult({
        createdCount: run.totals.createdCount,
        updatedCount: run.totals.updatedCount,
        unchangedCount: run.totals.unchangedCount,
        skipped: [...clientSkipped, ...run.totals.skipped],
        flagged: run.totals.flagged,
        failure: run.failure,
      })
      setStage('result')
    }
    setBusy(false)
  }

  function reset() {
    setStage('pick')
    setMapped(null)
    setPicks({})
    setResult(null)
    setError(null)
    setBusy(false)
    setProgress(null)
    setPreview(null)
    setStale(false)
  }

  const newCount = preview?.createdCount ?? 0
  const updateCount = preview?.updatedCount ?? 0
  const canImport = !!preview && !stale && newCount + updateCount > 0
  const importLabel = newCount + updateCount > 0 ? `Import ${newCount} new, update ${updateCount}` : 'Import'
  const skippedTotal = mapped ? mapped.skipped.length + pendingPick.length + (preview?.skipped.length ?? 0) : 0
  const clientSkipped = mapped ? clientSkips(mapped, picks) : []

  const footer =
    stage === 'review' ? (
      <div className="flex gap-3">
        <Button variant="secondary" className="flex-1" disabled={busy} onClick={reset}>
          Back
        </Button>
        {stale ? (
          <Button className="flex-1" loading={busy} onClick={() => runDry(mapped, picks)}>
            Check again
          </Button>
        ) : (
          <Button className="flex-1" disabled={!canImport} loading={busy} onClick={handleImport}>
            {importLabel}
          </Button>
        )}
      </div>
    ) : stage === 'result' ? (
      <Button fullWidth onClick={onClose}>
        Done
      </Button>
    ) : null

  return (
    <Modal
      open
      onClose={busy ? undefined : onClose}
      title={forcedBuilding ? `Upload customers — ${forcedBuilding.buildingName}` : 'Bulk upload customers'}
      footer={footer}
      wide
    >
      {stage === 'pick' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm font-normal text-muted">
            Upload a .xlsx or .csv with the billing columns <b>Name</b>, <b>Mobile No.</b> and{' '}
            <b>building</b> — matched by header name, any order, extra columns ignored
            {forcedBuilding ? '. Every row is added to this building.' : '; rows are routed by their building column.'}{' '}
            Building names are checked against the registry before anything is written.
          </p>
          <input ref={fileInputRef} type="file" accept=".xlsx,.csv" onChange={handleFile} className="hidden" />
          <Button fullWidth loading={busy} onClick={() => fileInputRef.current?.click()}>
            <IconUpload className="h-4.5 w-4.5" /> Choose file
          </Button>
          <button
            onClick={() => downloadCsvTemplate('customers-template.csv', CUSTOMER_TEMPLATE_CSV)}
            className="text-sm font-medium text-fiber hover:underline"
          >
            Download CSV template
          </button>
          {error && <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>}
        </div>
      )}

      {stage === 'review' && mapped && (
        <div className="flex flex-col gap-3">
          {progress ? (
            <p className="text-sm font-normal text-muted">{progress}</p>
          ) : (
            <p className="text-sm font-normal text-muted">
              {preview ? (
                <>
                  <b>{newCount}</b> new · <b>{updateCount}</b> will be updated · {preview.unchangedCount} unchanged ·{' '}
                  {skippedTotal} skipped · {preview.flagged.length} flagged
                </>
              ) : (
                'No preview yet'
              )}
              {pendingPick.length > 0 && <> · <span className="text-bad">{pendingPick.length} need a building</span></>}
            </p>
          )}
          {stale && preview && !busy && (
            <p className="rounded-btn bg-paper px-4 py-3 text-sm font-normal text-muted">
              Buildings changed — press Check again to refresh the preview.
            </p>
          )}
          <div className="max-h-72 overflow-auto rounded-btn border border-line">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-paper text-faint">
                <tr>
                  <th className="px-3 py-2">Sheet · row</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Mobile</th>
                  <th className="px-3 py-2">Building</th>
                  <th className="px-3 py-2">Wing</th>
                  <th className="px-3 py-2">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {[...mapped.ready, ...mapped.needsPick].map((r) => {
                  const k = keyOf(r)
                  const pick = picked(r)
                  const server = preview?.byKey[k]
                  const showServer = server && !stale
                  return (
                    <tr key={k} className="border-t border-line/60">
                      <td className="whitespace-nowrap px-3 py-1.5 text-muted">
                        {r.sheet}·{r.row}
                      </td>
                      <td className="truncate px-3 py-1.5 font-medium">{r.name}</td>
                      <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">{r.mobile}</td>
                      <td className="px-3 py-1.5">
                        {r.candidates ? (
                          <select
                            value={pick ? pick.id : ''}
                            onChange={(e) => handlePick(k, r.candidates.find((c) => c.id === e.target.value))}
                            disabled={busy}
                            className="h-8 max-w-[16rem] rounded-btn border border-bad/50 bg-card px-2 text-xs"
                          >
                            <option value="">Choose a building…</option>
                            {r.candidates.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.buildingName}
                                {c.zoneName ? ` — ${c.zoneName}` : ''}
                                {c.address ? ` (${c.address})` : ''}
                              </option>
                            ))}
                          </select>
                        ) : (
                          r.buildingName
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-muted">
                        {showServer && server.wingName ? (
                          server.wingName
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            —
                            {showServer && server.flags?.length > 0 && (
                              <span title={flagNote(preview, k)}>
                                <IconWarn className="h-4 w-4 text-warn" />
                              </span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-muted">
                        {showServer
                          ? OUTCOME_LABEL[server.outcome] ?? '—'
                          : !pick && r.candidates
                            ? 'Choose a building'
                            : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <SkippedList items={[...clientSkipped, ...(preview?.skipped ?? [])]} />
          {preview && <FlaggedList items={preview.flagged} />}
          {preview && preview.notInSheet.length > 0 && (
            <details className="rounded-btn bg-paper p-3">
              <summary className="cursor-pointer text-xs font-medium text-muted">
                Not in this sheet ({preview.notInSheet.length})
              </summary>
              <p className="mt-1 text-xs font-normal text-muted">Left as they are — nothing is changed or removed.</p>
              <ul className="mt-1 max-h-32 overflow-y-auto text-xs font-normal text-muted">
                {preview.notInSheet.map((c) => (
                  <li key={c.id}>
                    {c.name} · {c.mobile} · {c.buildingName} · {c.wingName || '—'}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {error && <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>}
        </div>
      )}

      {stage === 'result' && result && (
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <IconOkCircle className="h-5 w-5 text-fiber" />
            {result.createdCount} added · {result.updatedCount} updated · {result.unchangedCount} unchanged ·{' '}
            {result.skipped.length} skipped
          </p>
          {result.failure && (
            <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{result.failure}</p>
          )}
          <SkippedList items={result.skipped} max="max-h-40" />
          <FlaggedList items={result.flagged} max="max-h-40" />
        </div>
      )}
    </Modal>
  )
}
