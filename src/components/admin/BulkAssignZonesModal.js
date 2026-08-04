'use client'

import { useRef, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { parseSpreadsheet, downloadCsvTemplate } from '@/lib/spreadsheet'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { IconUpload, IconOkCircle, IconWarn } from '@/components/ui/icons'

const MAX_ROWS = 500
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Rows -> {email, zoneNames, row, error?}; drops an auto-detected header row. */
function validateRows(rawRows) {
  let rows = rawRows.map((cells, index) => ({ cells, row: index + 1 }))
  const first = rows[0]?.cells
  if (first && /^e-?mail$/i.test(first[0]) && /^zones?$/i.test(first[1])) rows = rows.slice(1)
  return rows
    .filter(({ cells }) => cells[0] || cells[1])
    .map(({ cells: [email, zonesCell], row }) => {
      const zoneNames = (zonesCell ?? '')
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean)
      let error = null
      if (!email) error = 'Email is missing'
      else if (!EMAIL_RE.test(email)) error = 'Not a valid email'
      else if (zoneNames.length === 0) error = 'No zones listed'
      return { email, zoneNames, row, error }
    })
}

/** Sheet-driven zone assignment: each row REPLACES that surveyor's zones. */
export function BulkAssignZonesModal({ onClose, onAssigned }) {
  const fileInputRef = useRef(null)
  const [rows, setRows] = useState(null)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const validRows = rows?.filter((r) => !r.error) ?? []

  function reset() {
    setRows(null)
    setResult(null)
    setError(null)
    setBusy(false)
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
      if (parsed.length === 0) throw new Error('No rows found in the file')
      if (parsed.filter((r) => !r.error).length > MAX_ROWS)
        throw new Error(`Too many rows — up to ${MAX_ROWS} per file. Please split the file.`)
      setRows(parsed)
    } catch (err) {
      setError(err.message || 'Could not read the file')
    }
  }

  async function handleAssign() {
    setBusy(true)
    setError(null)
    try {
      const res = await apiClient.post('/users/bulk-zones', {
        assignments: validRows.map(({ email, zoneNames }) => ({ email, zoneNames })),
      })
      setResult(res.data.data)
      onAssigned()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Assignment failed — please re-upload'))
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
        <Button className="flex-1" disabled={validRows.length === 0} loading={busy} onClick={handleAssign}>
          Assign {validRows.length} user{validRows.length === 1 ? '' : 's'}
        </Button>
      </div>
    ) : result ? (
      <Button fullWidth onClick={close}>
        Done
      </Button>
    ) : null

  return (
    <Modal open onClose={close} title="Bulk assign zones" footer={footer}>
      {/* Pick state */}
      {!rows && !result && (
        <div className="flex flex-col gap-4">
          <p className="text-sm font-normal text-muted">
            Upload a .xlsx or .csv with two columns: <b>Email</b> and <b>Zones</b> (zone names
            separated by commas). Each row <b>replaces</b> that surveyor&apos;s assigned zones.
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
            type="button"
            onClick={() =>
              downloadCsvTemplate(
                'zone-assignments-template.csv',
                'Email,Zones\nsurveyor@isp.local,"Baner, Wakad West"\n',
              )
            }
            className="text-sm font-medium text-fiber underline-offset-2 hover:underline"
          >
            Download template (.csv)
          </button>
        </div>
      )}

      {/* Preview state */}
      {rows && !result && (
        <div className="flex flex-col gap-4">
          <p className="text-sm font-normal text-muted">
            {validRows.length} of {rows.length} rows are valid. Users and zone names are matched
            when you assign.
          </p>
          <div className="max-h-72 overflow-y-auto rounded-btn border border-line">
            {rows.map((r) => (
              <div
                key={r.row}
                className="flex items-start gap-2 border-b border-line/60 px-3 py-2 text-sm last:border-b-0"
              >
                {r.error ? (
                  <IconWarn className="mt-0.5 h-4 w-4 shrink-0 text-bad" />
                ) : (
                  <IconOkCircle className="mt-0.5 h-4 w-4 shrink-0 text-ok" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.email || '—'}</p>
                  <p className="truncate text-xs text-muted">{r.zoneNames.join(', ') || '—'}</p>
                </div>
                {r.error && (
                  <span className="shrink-0 text-xs text-bad">
                    row {r.row}: {r.error}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Result state */}
      {result && (
        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium">
            {result.updated.length} updated · {result.skipped.length} skipped
          </p>
          {result.skipped.length > 0 && (
            <div className="max-h-56 overflow-y-auto rounded-btn border border-line">
              {result.skipped.map((s, i) => (
                <div
                  key={`${s.email}-${i}`}
                  className="flex items-center justify-between gap-2 border-b border-line/60 px-3 py-2 text-sm last:border-b-0"
                >
                  <span className="truncate font-medium">{s.email}</span>
                  <span className="shrink-0 text-xs text-muted">{s.reason}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">
          {error}
        </p>
      )}
    </Modal>
  )
}
