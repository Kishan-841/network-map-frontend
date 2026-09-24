'use client'

import { useRef, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { parseSpreadsheet, downloadCsvTemplate } from '@/lib/spreadsheet'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { IconUpload, IconOkCircle, IconWarn } from '@/components/ui/icons'

const MAX_ROWS = 500

// Columns matched by header text (any order, extra columns ignored).
const HEADERS = {
  name: /name/i,
  email: /e-?mail/i,
  password: /pass/i,
  role: /role/i,
  reportsTo: /reports?\s*to|reporting/i,
}

const ROLE_LABEL = {
  SALES_MANAGER: 'Sales manager',
  TEAM_LEADER: 'Team leader',
  SALES_EXECUTIVE: 'Sales executive',
}
const ROLE_ALIASES = {
  'sales manager': 'SALES_MANAGER',
  sales_manager: 'SALES_MANAGER',
  'team leader': 'TEAM_LEADER',
  team_leader: 'TEAM_LEADER',
  'sales executive': 'SALES_EXECUTIVE',
  sales_executive: 'SALES_EXECUTIVE',
}

/** Raw sheet rows → [{name, email, password, role, reportsTo, row}] via the header row. */
function parseRows(rawRows) {
  const headerIndex = rawRows.findIndex((cells) => cells.some((c) => HEADERS.email.test(c)))
  if (headerIndex === -1) throw new Error('No header row found — the sheet needs an "Email" column')
  const headerCells = rawRows[headerIndex]
  const col = {}
  for (const [key, re] of Object.entries(HEADERS)) col[key] = headerCells.findIndex((c) => re.test(c))
  for (const required of ['name', 'email', 'password', 'role']) {
    if (col[required] === -1) throw new Error(`Missing required column: ${required[0].toUpperCase() + required.slice(1)}`)
  }
  const cell = (cells, key) => (col[key] >= 0 ? (cells[col[key]] ?? '').trim() : '')
  return rawRows
    .slice(headerIndex + 1)
    .map((cells, index) => ({ cells, row: index + 1 }))
    // Drop blank/footer lines — a real row has at least a name or an email.
    .filter(({ cells }) => cell(cells, 'name') || cell(cells, 'email'))
    .map(({ cells, row }) => ({
      name: cell(cells, 'name'),
      email: cell(cells, 'email'),
      password: cell(cells, 'password'),
      role: cell(cells, 'role'),
      reportsTo: cell(cells, 'reportsTo'),
      row,
    }))
}

const canonRole = (raw) => ROLE_ALIASES[(raw ?? '').trim().toLowerCase()] ?? null

/**
 * Admin bulk create of the field-sales hierarchy from a sheet:
 * Name | Email | Password | Role | Reports To (email). A team leader's
 * "Reports To" is their sales manager's email; an executive's is their team
 * leader's email. The server validates all-or-nothing and returns per-row
 * errors, so nothing is created unless every row is valid.
 */
export function ImportUsersModal({ onClose, onImported }) {
  const fileInputRef = useRef(null)
  const [rows, setRows] = useState(null)
  const [result, setResult] = useState(null) // { created } on success
  const [rowErrors, setRowErrors] = useState(null) // [{ row, email, message }]
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  function reset() {
    setRows(null)
    setResult(null)
    setRowErrors(null)
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
    setRowErrors(null)
    try {
      const parsed = parseRows(await parseSpreadsheet(file))
      if (parsed.length === 0) throw new Error('No data rows found in the file')
      if (parsed.length > MAX_ROWS) throw new Error(`Too many rows — up to ${MAX_ROWS} per file. Please split the file.`)
      setRows(parsed)
    } catch (err) {
      setError(err.message || 'Could not read the file')
    }
  }

  async function handleImport() {
    setBusy(true)
    setError(null)
    setRowErrors(null)
    try {
      const res = await apiClient.post('/users/bulk', {
        users: rows.map(({ name, email, password, role, reportsTo }) => ({
          name,
          email,
          password,
          role,
          reportsToEmail: reportsTo,
        })),
      })
      const data = res.data.data
      if (data.errors?.length) {
        setRowErrors(data.errors) // all-or-nothing: nothing was created
      } else {
        setResult(data)
        onImported()
      }
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
        <Button className="flex-1" disabled={rows.length === 0} loading={busy} onClick={handleImport}>
          Create {rows.length} user{rows.length === 1 ? '' : 's'}
        </Button>
      </div>
    ) : result ? (
      <Button fullWidth onClick={close}>
        Done
      </Button>
    ) : null

  return (
    <Modal open onClose={close} title="Import sales team" footer={footer}>
      {/* Pick */}
      {!rows && !result && (
        <div className="flex flex-col gap-4">
          <p className="text-sm font-normal text-muted">
            Upload a .xlsx or .csv with columns <b>Name</b>, <b>Email</b>, <b>Password</b>, <b>Role</b> and{' '}
            <b>Reports To</b>. Role is <b>Sales manager</b>, <b>Team leader</b> or <b>Sales executive</b>. A team
            leader&apos;s <b>Reports To</b> is their sales manager&apos;s email; a sales executive&apos;s is their team
            leader&apos;s email (their manager is set automatically). A manager leaves Reports To blank. You can create a
            whole team in one file — references may point to people in the same file or already in the system.
          </p>
          <input ref={fileInputRef} type="file" accept=".xlsx,.csv" onChange={handleFile} className="hidden" />
          <Button fullWidth onClick={() => fileInputRef.current?.click()}>
            <IconUpload className="h-4.5 w-4.5" /> Choose file
          </Button>
          <button
            onClick={() =>
              downloadCsvTemplate(
                'sales-team-template.csv',
                'Name,Email,Password,Role,Reports To\n' +
                  'Asha Manager,asha@isp.local,Passw0rd1,Sales manager,\n' +
                  'Ravi Leader,ravi@isp.local,Passw0rd1,Team leader,asha@isp.local\n' +
                  'Neha Exec,neha@isp.local,Passw0rd1,Sales executive,ravi@isp.local\n',
              )
            }
            className="text-sm font-medium text-fiber hover:underline"
          >
            Download CSV template
          </button>
          {error && <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>}
        </div>
      )}

      {/* Preview */}
      {rows && !result && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-normal text-muted">
            <b>{rows.length}</b> row{rows.length === 1 ? '' : 's'} ready. They&apos;re created only if every row is
            valid.
          </p>
          <div className="max-h-64 overflow-y-auto rounded-btn border border-line">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-paper text-faint">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Reports to</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const role = canonRole(r.role)
                  return (
                    <tr key={r.row}>
                      <td className="truncate px-3 py-1.5 font-medium">{r.name || '—'}</td>
                      <td className="truncate px-3 py-1.5">{r.email || '—'}</td>
                      <td className="truncate px-3 py-1.5">
                        {role ? (
                          ROLE_LABEL[role]
                        ) : (
                          <span className="text-bad">{r.role || 'missing'}</span>
                        )}
                      </td>
                      <td className="truncate px-3 py-1.5">{r.reportsTo || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {rowErrors && (
            <div className="rounded-btn bg-bad-tint/50 p-3">
              <p className="mb-1 flex items-center gap-2 text-xs font-medium text-bad">
                <IconWarn className="h-4 w-4" /> Nothing was created — fix {rowErrors.length} problem
                {rowErrors.length === 1 ? '' : 's'} and re-upload:
              </p>
              <ul className="max-h-40 overflow-y-auto text-xs font-normal text-bad">
                {rowErrors.map((e, i) => (
                  <li key={`${e.row}-${i}`}>
                    Row {e.row}
                    {e.email ? ` (${e.email})` : ''}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {error && <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <IconOkCircle className="h-5 w-5 text-fiber" />
            {result.created.length} user{result.created.length === 1 ? '' : 's'} created
          </p>
          <div className="max-h-48 overflow-y-auto rounded-btn border border-line text-xs">
            <table className="w-full text-left">
              <tbody>
                {result.created.map((u) => (
                  <tr key={u.id} className="border-b border-line/60 last:border-b-0">
                    <td className="px-3 py-1.5 font-medium">{u.name}</td>
                    <td className="px-3 py-1.5 text-muted">{u.email}</td>
                    <td className="px-3 py-1.5 text-muted">{ROLE_LABEL[u.role] ?? u.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  )
}
