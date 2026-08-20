'use client'

import { useRef, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { parseSpreadsheet, downloadCsvTemplate } from '@/lib/spreadsheet'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { IconUpload, IconOkCircle, IconWarn } from '@/components/ui/icons'

const MAX_ROWS = 500

// Columns are matched by HEADER TEXT (any order, extra columns ignored) so
// field sheets like "Sr No | Building Name | Coordinates | Latitude | …" work
// without reshaping.
const HEADERS = {
  name: /building\s*name/i,
  latitude: /^lat/i,
  longitude: /^(long|lng)/i,
  zone: /zone/i,
  operator: /operator/i,
  homePass: /home\s*-?\s*pass|homepass/i,
  remark: /remark|parent\s*node/i,
}

/** Raw sheet rows → {buildingName, latitude, …, row, error?} via the header row. */
function validateRows(rawRows) {
  const headerIndex = rawRows.findIndex((cells) => cells.some((c) => HEADERS.name.test(c)))
  if (headerIndex === -1) {
    throw new Error('No header row found — the sheet needs a "Building Name" column')
  }
  const headerCells = rawRows[headerIndex]
  const col = {}
  for (const [key, re] of Object.entries(HEADERS)) {
    col[key] = headerCells.findIndex((c) => re.test(c))
  }
  for (const required of ['name', 'latitude', 'longitude', 'zone']) {
    if (col[required] === -1) {
      throw new Error(`Missing required column: ${required === 'name' ? 'Building Name' : required}`)
    }
  }

  const cell = (cells, key) => (col[key] >= 0 ? (cells[col[key]] ?? '').trim() : '')
  return rawRows
    .slice(headerIndex + 1)
    .map((cells, index) => ({ cells, row: index + 1 }))
    // Footer/summary lines ("Total Buildings:") have no coordinates — drop them.
    .filter(({ cells }) => cell(cells, 'latitude') || cell(cells, 'longitude'))
    .map(({ cells, row }) => {
      const buildingName = cell(cells, 'name')
      const latitude = Number(cell(cells, 'latitude'))
      const longitude = Number(cell(cells, 'longitude'))
      const zone = cell(cells, 'zone')
      const operator = cell(cells, 'operator')
      const homePassRaw = cell(cells, 'homePass')
      const homePass = /^\d+$/.test(homePassRaw) ? Number(homePassRaw) : null
      const remark = cell(cells, 'remark')

      let error = null
      if (!buildingName) error = 'Building name is missing'
      else if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)
        error = 'Latitude is not a valid coordinate'
      else if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)
        error = 'Longitude is not a valid coordinate'
      else if (!zone) error = 'Zone is missing'
      return { buildingName, latitude, longitude, zone, operator, homePass, remark, row, error }
    })
}

/** Admin bulk upload: Building Name | Latitude | Longitude | Zone | Operator | Homepass | Remark. */
export function ImportBuildingsModal({ onClose, onImported }) {
  const fileInputRef = useRef(null)
  const [rows, setRows] = useState(null)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  // Some field sheets label the columns the other way round (the zone name
  // sits under "Operator"). Explicit toggle beats guessing.
  const [swapped, setSwapped] = useState(false)

  const applySwap = (r) => (swapped ? { ...r, zone: r.operator, operator: r.zone } : r)
  const effectiveRows = rows?.map(applySwap) ?? null
  const validRows =
    effectiveRows?.filter((r) => !r.error && r.zone) ?? []
  const errorRows = effectiveRows?.filter((r) => r.error) ?? []

  function reset() {
    setRows(null)
    setResult(null)
    setError(null)
    setBusy(false)
    setSwapped(false)
  }
  function close() {
    reset()
    onClose()
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    try {
      const parsed = validateRows(await parseSpreadsheet(file))
      if (parsed.length === 0) throw new Error('No data rows found in the file')
      if (parsed.filter((r) => !r.error).length > MAX_ROWS)
        throw new Error(`Too many rows — up to ${MAX_ROWS} per file. Please split the file.`)
      setRows(parsed)
    } catch (err) {
      setError(err.message || 'Could not read the file')
    }
  }

  async function handleImport() {
    setBusy(true)
    setError(null)
    try {
      const res = await apiClient.post('/buildings/bulk', {
        rows: validRows.map(({ buildingName, latitude, longitude, zone, operator, homePass, remark }) => ({
          buildingName,
          latitude,
          longitude,
          zone,
          operator: operator || null,
          homePass,
          remark: remark || null,
        })),
      })
      setResult(res.data.data)
      onImported()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Import failed — please re-upload'))
    } finally {
      setBusy(false)
    }
  }

  const footer =
    rows && !result ? (
      <div className="flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={reset}>
          Back
        </Button>
        <Button className="flex-1" disabled={validRows.length === 0} loading={busy} onClick={handleImport}>
          Import {validRows.length} building{validRows.length === 1 ? '' : 's'}
        </Button>
      </div>
    ) : result ? (
      <Button fullWidth onClick={close}>
        Done
      </Button>
    ) : null

  return (
    <Modal open onClose={close} title="Bulk upload buildings" footer={footer}>
      {/* Pick */}
      {!rows && !result && (
        <div className="flex flex-col gap-4">
          <p className="text-sm font-normal text-muted">
            Upload a .xlsx or .csv with columns <b>Building Name</b>, <b>Latitude</b>,{' '}
            <b>Longitude</b>, <b>Zone Name</b> and optionally <b>Operator</b>, <b>Homepass</b>,{' '}
            <b>Remark</b> — matched by header name, any order. Missing zones and operators are
            created automatically. Floors, wings and other details can be added later via
            Update building.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.csv"
            onChange={handleFile}
            className="hidden"
          />
          <Button fullWidth onClick={() => fileInputRef.current?.click()}>
            <IconUpload className="h-4.5 w-4.5" /> Choose file
          </Button>
          <button
            onClick={() =>
              downloadCsvTemplate(
                'buildings-template.csv',
                'Building Name,Latitude,Longitude,Zone Name,Operator,Homepass,Remark\nBALAJI HEIGHTS,18.523956,73.861517,Mangalwar Peth,Fiber Plus Broadband,50,SERVER\n',
              )
            }
            className="text-sm font-medium text-fiber hover:underline"
          >
            Download CSV template
          </button>
          {error && (
            <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>
          )}
        </div>
      )}

      {/* Preview */}
      {rows && !result && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-normal text-muted">
            <b>{validRows.length}</b> ready to import
            {errorRows.length > 0 && (
              <>
                {' · '}
                <span className="text-bad">{errorRows.length} with problems (skipped)</span>
              </>
            )}
          </p>
          <button
            onClick={() => setSwapped((v) => !v)}
            className="self-start rounded-full border border-line px-3 py-1.5 text-xs font-medium transition-colors hover:border-fiber/50"
          >
            {swapped ? '↩︎ Undo swap' : '⇄ Swap Zone ↔ Operator'}
          </button>
          <div className="max-h-64 overflow-y-auto rounded-btn border border-line">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-paper text-faint">
                <tr>
                  <th className="px-3 py-2">Building</th>
                  <th className="px-3 py-2">Zone</th>
                  <th className="px-3 py-2">Operator</th>
                  <th className="px-3 py-2 text-right">Homepass</th>
                </tr>
              </thead>
              <tbody>
                {effectiveRows.map((r) => (
                  <tr key={r.row} className={r.error ? 'bg-bad-tint/40' : ''}>
                    <td className="truncate px-3 py-1.5 font-medium">
                      {r.buildingName || '—'}
                      {r.error && <span className="block text-[10px] font-normal text-bad">{r.error}</span>}
                    </td>
                    <td className="truncate px-3 py-1.5">{r.zone || '—'}</td>
                    <td className="truncate px-3 py-1.5">{r.operator || '—'}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{r.homePass ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {error && (
            <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>
          )}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <IconOkCircle className="h-5 w-5 text-fiber" />
            {result.createdCount} building{result.createdCount === 1 ? '' : 's'} imported
            {result.zonesCreated > 0 && ` · ${result.zonesCreated} zones created`}
            {result.operatorsCreated > 0 && ` · ${result.operatorsCreated} operators created`}
          </p>
          {result.skipped.length > 0 && (
            <div className="rounded-btn bg-paper p-3">
              <p className="mb-1 flex items-center gap-2 text-xs font-medium text-muted">
                <IconWarn className="h-4 w-4" /> Skipped {result.skipped.length}
              </p>
              <ul className="max-h-40 overflow-y-auto text-xs font-normal text-muted">
                {result.skipped.map((s) => (
                  <li key={`${s.row}-${s.buildingName}`}>
                    Row {s.row} — {s.buildingName}: {s.reason}
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
