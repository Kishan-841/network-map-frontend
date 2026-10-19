'use client'

import { useRef, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { parseSpreadsheetSheets, downloadCsvTemplate } from '@/lib/spreadsheet'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { IconOkCircle, IconUpload, IconWarn } from '@/components/ui/icons'
import {
  CUSTOMER_TEMPLATE_CSV,
  customerBuildingNames,
  mapCustomerSheet,
} from '@/lib/customers'

const MAX_ROWS = 1000
const keyOf = (r) => `${r.sheet}:${r.row}`

/**
 * Upload the ISP's billing sheet. Rows are mapped in the browser, building
 * names resolved server-side in one lookup, and only resolved rows are posted.
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
  const [error, setError] = useState(null)

  const picked = (r) => picks[keyOf(r)]
  const pendingPick = mapped ? mapped.needsPick.filter((r) => !picked(r)) : []
  const importable = [
    ...(mapped?.ready ?? []),
    ...(mapped?.needsPick ?? [])
      .filter((r) => picked(r))
      .map((r) => ({ ...r, buildingId: picked(r).id, buildingName: picked(r).buildingName })),
  ]

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    setBusy(true)
    try {
      const sheets = await parseSpreadsheetSheets(file)
      let m
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
      setMapped(m)
      setPicks({})
      setStage('review')
    } catch (err) {
      setError(err.message || 'Could not read the file')
    } finally {
      setBusy(false)
    }
  }

  async function handleImport() {
    setBusy(true)
    setError(null)
    try {
      const rows = importable.map((r) => ({
        row: r.row,
        buildingId: r.buildingId,
        name: r.name,
        mobile: r.mobile,
        username: r.username,
        address: r.address,
        email: r.email,
        site: r.site,
        operator: r.operator,
        networkZone: r.networkZone,
        planName: r.planName,
        planAmount: r.planAmount,
        planValidityDays: r.planValidityDays,
        autoRenewal: r.autoRenewal,
        planActivatedAt: r.planActivatedAt,
        planExpiresAt: r.planExpiresAt,
        status: r.status,
        ageingDays: r.ageingDays,
      }))
      const res = await apiClient.post('/customers/import', { rows })
      const clientSkipped = [
        ...mapped.skipped,
        ...pendingPick.map((r) => ({ row: r.row, name: r.name, reason: 'Choose a building' })),
      ]
      setResult({
        createdCount: res.data.data.createdCount,
        skipped: [...clientSkipped, ...res.data.data.skipped],
      })
      setStage('result')
      onImported()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Import failed — please re-upload'))
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setStage('pick')
    setMapped(null)
    setPicks({})
    setResult(null)
    setError(null)
    setBusy(false)
  }

  const overCap = importable.length > MAX_ROWS
  const footer =
    stage === 'review' ? (
      <div className="flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={reset}>
          Back
        </Button>
        <Button className="flex-1" disabled={importable.length === 0 || overCap} loading={busy} onClick={handleImport}>
          Import {importable.length} customer{importable.length === 1 ? '' : 's'}
        </Button>
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
          <p className="text-sm font-normal text-muted">
            <b>{importable.length}</b> ready
            {pendingPick.length > 0 && <> · <span className="text-bad">{pendingPick.length} need a building</span></>}
            {mapped.skipped.length > 0 && <> · {mapped.skipped.length} skipped</>}
          </p>
          {overCap && (
            <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">
              Too many rows — up to {MAX_ROWS} per file. Please split the file.
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
                  <th className="px-3 py-2">Plan</th>
                </tr>
              </thead>
              <tbody>
                {[...mapped.ready, ...mapped.needsPick].map((r) => {
                  const k = keyOf(r)
                  const pick = picked(r)
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
                            onChange={(e) => {
                              const found = r.candidates.find((c) => c.id === e.target.value)
                              setPicks((p) => ({ ...p, [k]: found }))
                            }}
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
                      <td className="truncate px-3 py-1.5 text-muted">{r.planName || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {mapped.skipped.length > 0 && (
            <div className="rounded-btn bg-paper p-3">
              <p className="mb-1 flex items-center gap-2 text-xs font-medium text-muted">
                <IconWarn className="h-4 w-4" /> Skipped {mapped.skipped.length}
              </p>
              <ul className="max-h-32 overflow-y-auto text-xs font-normal text-muted">
                {mapped.skipped.map((s) => (
                  <li key={keyOf(s)}>
                    {s.sheet}·{s.row} — {s.name}: {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {error && <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>}
        </div>
      )}

      {stage === 'result' && result && (
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <IconOkCircle className="h-5 w-5 text-fiber" />
            {result.createdCount} customer{result.createdCount === 1 ? '' : 's'} imported
            {result.skipped.length > 0 && ` · ${result.skipped.length} skipped`}
          </p>
          {result.skipped.length > 0 && (
            <div className="rounded-btn bg-paper p-3">
              <p className="mb-1 flex items-center gap-2 text-xs font-medium text-muted">
                <IconWarn className="h-4 w-4" /> Skipped {result.skipped.length}
              </p>
              <ul className="max-h-40 overflow-y-auto text-xs font-normal text-muted">
                {result.skipped.map((s) => (
                  <li key={`${s.sheet ?? ''}-${s.row}-${s.name}`}>
                    {s.sheet ? `${s.sheet}·` : 'Row '}
                    {s.row} — {s.name}: {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
