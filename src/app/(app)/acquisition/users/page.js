'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { DataTable } from '@/components/ui/DataTable'
import { AgentFormModal } from '@/components/acquisition/AgentFormModal'
import { useCities } from '@/hooks/useCities'
import { invalidateUsers } from '@/hooks/useUsers'
import { IconPlus, IconUser, IconEdit } from '@/components/ui/icons'

function StatusBadge({ active }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        active ? 'bg-ok-tint text-ok' : 'bg-bad-tint text-bad'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-ok' : 'bg-bad'}`} />
      {active ? 'Active' : 'Deactivated'}
    </span>
  )
}

/** City + pincodes the agent is allowed to log buildings in. */
function Territory({ user }) {
  const pins = user.pincodes ?? []
  if (pins.length === 0) return <span className="text-sm text-faint">Not mapped</span>
  return (
    <div className="min-w-0">
      <p className="truncate text-sm">{pins[0].city?.name ?? '—'}</p>
      <p className="truncate text-xs font-normal text-muted">
        {pins.map((p) => p.pincode).join(', ')}
      </p>
    </div>
  )
}

const ACTION_BTN =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-btn border px-3.5 text-sm font-medium transition-colors duration-200 active:scale-[0.98] disabled:opacity-50'

function RowActions({ user, busy, onEdit, onToggle }) {
  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={() => onEdit(user)}
        className={`${ACTION_BTN} border-line text-muted hover:border-faint hover:text-ink`}
      >
        <IconEdit className="h-4 w-4" strokeWidth={1.8} />
        Edit
      </button>
      <ToggleButton user={user} busy={busy} onClick={onToggle} />
    </div>
  )
}

function ToggleButton({ user, busy, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(user)}
      disabled={busy}
      className={`${ACTION_BTN} ${
        user.isActive
          ? 'border-bad/30 text-bad hover:bg-bad-tint'
          : 'border-ok/40 text-ok hover:bg-ok-tint'
      }`}
    >
      {busy && <span className="loading loading-spinner loading-xs" />}
      {user.isActive ? 'Deactivate' : 'Activate'}
    </button>
  )
}

/**
 * Deactivating blocks the login but keeps every building the agent logged, so
 * the copy says exactly that — a lead should never fear losing survey data.
 */
function ConfirmToggleModal({ user, busy, error, onConfirm, onClose }) {
  const off = user.isActive
  return (
    <Modal
      open
      onClose={onClose}
      title={off ? `Deactivate ${user.name}?` : `Activate ${user.name}?`}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            variant={off ? 'danger' : 'primary'}
            loading={busy}
            onClick={onConfirm}
          >
            {off ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm font-normal text-muted">
          {off ? (
            <>
              <span className="font-medium text-ink">{user.email}</span> will no longer be able to
              sign in. Buildings they already logged stay in the team&rsquo;s records, and you can
              reactivate them any time.
            </>
          ) : (
            <>
              <span className="font-medium text-ink">{user.email}</span> will be able to sign in
              again and log buildings in their mapped pincodes.
            </>
          )}
        </p>
        {error && (
          <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>
        )}
      </div>
    </Modal>
  )
}

export default function AcquisitionUsersPage() {
  const { cities } = useCities()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [cityId, setCityId] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [refreshTick, setRefreshTick] = useState(0)
  const [addOpen, setAddOpen] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  // { key, data } — loading is derived from a key mismatch so the effect never
  // calls setState synchronously (react-hooks/set-state-in-effect).
  const [result, setResult] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  const paramsKey = useMemo(() => {
    const p = { page, pageSize: 50, tick: refreshTick }
    if (debouncedSearch.trim()) p.search = debouncedSearch.trim()
    return JSON.stringify(p)
  }, [page, debouncedSearch, refreshTick])

  useEffect(() => {
    let cancelled = false
    const { tick, ...params } = JSON.parse(paramsKey)
    apiClient
      .get('/users', { params })
      .then((res) => !cancelled && setResult({ key: paramsKey, data: res.data.data }))
      .catch(
        (err) =>
          !cancelled &&
          setResult({ key: paramsKey, error: getApiErrorMessage(err, 'Could not load the team') }),
      )
    return () => {
      cancelled = true
    }
  }, [paramsKey])

  const loading = result?.key !== paramsKey
  const listError = !loading && result?.error ? result.error : null
  const items = result?.data?.items ?? null

  // City and status narrow the page in memory — /users filters by search only,
  // and a lead's roster is small enough that a round trip would be wasted.
  const users = useMemo(() => {
    if (!items) return null
    return items.filter(
      (u) =>
        (!cityId || (u.pincodes ?? []).some((p) => p.cityId === cityId)) &&
        (!status || (status === 'active') === Boolean(u.isActive)),
    )
  }, [items, cityId, status])

  const narrowed = Boolean(cityId || status)
  const pagination =
    result?.data && !narrowed
      ? { page: result.data.page, totalPages: result.data.totalPages, total: result.data.total }
      : null

  // Mutations also drop the session-cached user directory so the dashboard and
  // buildings filters pick up the change without a hard refresh.
  const refresh = () => {
    invalidateUsers()
    setRefreshTick((tick) => tick + 1)
  }

  async function confirmToggle() {
    setBusy(true)
    setError(null)
    try {
      await apiClient.patch(`/users/${confirm.id}`, { isActive: !confirm.isActive })
      setConfirm(null)
      refresh()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not update the agent'))
    } finally {
      setBusy(false)
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'Agent',
      render: (u) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fiber/10 text-fiber">
            <IconUser className="h-4.5 w-4.5" strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{u.name}</p>
            <p className="truncate text-xs font-normal text-muted">{u.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'territory', header: 'Territory', render: (u) => <Territory user={u} /> },
    { key: 'status', header: 'Status', render: (u) => <StatusBadge active={u.isActive} /> },
    {
      key: 'actions',
      header: '',
      render: (u) => (
        <RowActions
          user={u}
          busy={busy && confirm?.id === u.id}
          onEdit={setEditUser}
          onToggle={setConfirm}
        />
      ),
    },
  ]

  const renderCard = (u) => (
    <div className={`rounded-card bg-card p-4 shadow-soft ${u.isActive ? '' : 'opacity-70'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-bold">{u.name}</p>
          <p className="truncate text-sm font-normal text-muted">{u.email}</p>
        </div>
        <StatusBadge active={u.isActive} />
      </div>
      <div className="mt-3 border-t border-line pt-3">
        <Territory user={u} />
      </div>
      <div className="mt-3">
        <RowActions
          user={u}
          busy={busy && confirm?.id === u.id}
          onEdit={setEditUser}
          onToggle={setConfirm}
        />
      </div>
    </div>
  )

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">
      <PageHeader
        title="Users"
        sub="Agents on your team — add accounts and control access"
        backHref="/acquisition"
        backLabel="Team"
        action={
          <Button onClick={() => setAddOpen(true)}>
            <IconPlus className="h-4.5 w-4.5" />
            Add user
          </Button>
        }
      />

      {(error || listError) && (
        <p className="mb-3 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">
          {error ?? listError}
        </p>
      )}

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <Input
            id="team-search"
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <Select id="team-city" value={cityId} onChange={(e) => setCityId(e.target.value)}>
          <option value="">All cities</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select id="team-status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Deactivated</option>
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={users}
        loading={loading}
        keyField="id"
        renderCard={renderCard}
        pagination={pagination}
        onPageChange={setPage}
        emptyState={
          <p className="text-sm font-normal text-muted">
            {narrowed || debouncedSearch
              ? 'No agents match these filters.'
              : 'No agents yet — add your first one.'}
          </p>
        }
      />

      {addOpen && <AgentFormModal onClose={() => setAddOpen(false)} onSaved={refresh} />}
      {editUser && (
        <AgentFormModal
          key={editUser.id}
          initial={editUser}
          onClose={() => setEditUser(null)}
          onSaved={refresh}
        />
      )}
      {confirm && (
        <ConfirmToggleModal
          user={confirm}
          busy={busy}
          error={error}
          onConfirm={confirmToggle}
          onClose={() => {
            setConfirm(null)
            setError(null)
          }}
        />
      )}
    </main>
  )
}
