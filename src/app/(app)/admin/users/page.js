'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { DataTable } from '@/components/ui/DataTable'
import { ZoneMultiSelect } from '@/components/admin/ZoneMultiSelect'
import { invalidateUsers } from '@/hooks/useUsers'
import { ROLE_LABELS, SALES_ROLES, isZoneManager } from '@/lib/roles'
import { useCities } from '@/hooks/useCities'
import { BulkAssignZonesModal } from '@/components/admin/BulkAssignZonesModal'
import { ImportUsersModal } from '@/components/admin/ImportUsersModal'
import { UsersTabs } from '@/components/admin/UsersTabs'
import { useAuthStore } from '@/stores/auth-store'
import { IconPlus, IconEdit, IconUpload } from '@/components/ui/icons'

const ROLES = [
  'SURVEYOR',
  'MANAGER',
  'SUPERVISOR',
  'PARTNER_MANAGER',
  'ACCOUNTS',
  'ADMIN',
  'ACQUISITION_AGENT',
  'ACQUISITION_LEAD',
  'SALES_MANAGER',
  'TEAM_LEADER',
  'SALES_EXECUTIVE',
  'PERMISSION_EXECUTIVE',
]
const roleLabel = (role) => ROLE_LABELS[role] ?? role
// Roles that work by zone: surveyors, team leaders (given zones by their
// manager), and zone managers (who work only the zones the admin gives them).
const ZONE_ROLES = ['SURVEYOR', 'TEAM_LEADER', 'MANAGER']
// Which kind of manager a role reports to — a role change across families
// drops the picked manager, which would not fit the new role.
const REPORTS_TO_FAMILY = { SURVEYOR: 'zone', TEAM_LEADER: 'sales', SALES_EXECUTIVE: 'sales' }

// Keep the assigned-zones line short so it never widens the row (which would
// push the action buttons into a horizontal scroll). Show a couple of names,
// then "+N more".
function zoneSummary(zones, max = 2) {
  const names = zones.map((zone) => zone.name)
  if (names.length <= max) return names.join(', ')
  return `${names.slice(0, max).join(', ')} +${names.length - max} more`
}

const ROLE_CHIP = {
  ADMIN: 'bg-doc-tint text-doc',
  MANAGER: 'bg-fiber-tint text-fiber',
  SURVEYOR: 'bg-scan-tint text-scan',
  ACQUISITION_AGENT: 'bg-warn-tint text-warn',
  ACQUISITION_LEAD: 'bg-doc-tint text-doc',
}

function RoleBadge({ role }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
        ROLE_CHIP[role] ?? 'bg-line/60 text-muted'
      }`}
    >
      {roleLabel(role)}
    </span>
  )
}

function StatusBadge({ active }) {
  return active ? (
    <span className="inline-flex rounded-full bg-ok-tint px-2.5 py-0.5 text-xs font-medium text-ok">
      Active
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-line/60 px-2.5 py-0.5 text-xs font-medium text-muted">
      Inactive
    </span>
  )
}

/**
 * Shared create/edit dialog. `initial` set ⇒ edit mode (password optional).
 * `asManager` — a zone manager adding / editing their own surveyors: role is
 * fixed, no reports-to, and zones come from the manager's own (`zones` is
 * already scoped by the API).
 */
function UserFormModal({ onClose, onSaved, initial, isSelf, zones, asManager = false }) {
  const isEdit = Boolean(initial)
  // Mounted fresh per open (parent renders conditionally with a key), so state
  // initializes directly from props — no sync-setState-in-effect needed.
  const [form, setForm] = useState(() =>
    initial
      ? {
          name: initial.name,
          email: initial.email,
          password: '',
          role: initial.role,
          zoneIds: initial.assignedZones?.map((zone) => zone.id) ?? [],
          managerId: initial.managerId ?? '',
          teamLeaderId: initial.teamLeaderId ?? '',
        }
      : { name: '', email: '', password: '', role: 'SURVEYOR', zoneIds: [], managerId: '', teamLeaderId: '' },
  )
  // The sales chain's candidate lists — fetched once, small. Managers to put a
  // team leader / executive under; team leaders to put an executive under.
  const [salesCandidates, setSalesCandidates] = useState({ managers: [], leaders: [], zoneManagers: [] })
  useEffect(() => {
    // A zone manager picks no reports-to, and their /users is only their team.
    if (asManager) return undefined
    let alive = true
    // The plain list returns every user as an array — filter to the two sales
    // levels we need for the pickers.
    apiClient
      .get('/users')
      .then((res) => {
        if (!alive) return
        const all = Array.isArray(res.data.data) ? res.data.data : (res.data.data.items ?? [])
        setSalesCandidates({
          managers: all.filter((u) => u.role === 'SALES_MANAGER'),
          leaders: all.filter((u) => u.role === 'TEAM_LEADER'),
          // Coverage: who a surveyor can report to.
          zoneManagers: all.filter((u) => u.role === 'MANAGER'),
        })
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [asManager])
  // Acquisition agents are mapped to a city + pincodes instead of zones.
  const [territory, setTerritory] = useState(() => ({
    cityId: initial?.pincodes?.[0]?.cityId ?? '',
    pincodes: (initial?.pincodes ?? []).map((p) => p.pincode).join(', '),
  }))
  const { cities } = useCities()
  const pincodeList = territory.pincodes
    .split(/[,\s]+/)
    .map((p) => p.trim())
    .filter(Boolean)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))
  const setRole = (e) => {
    const role = e.target.value
    setForm((prev) =>
      REPORTS_TO_FAMILY[prev.role] === REPORTS_TO_FAMILY[role]
        ? { ...prev, role }
        : { ...prev, role, managerId: '', teamLeaderId: '' },
    )
  }
  // The manager sees only their own zones. A surveyor may also hold zones
  // outside them (given by the admin): those are not shown, never sent (the
  // API refuses zones the manager does not manage) and kept by the server.
  const visibleZoneIds = new Set(zones.map((zone) => zone.id))
  const hiddenZoneCount = asManager ? form.zoneIds.filter((id) => !visibleZoneIds.has(id)).length : 0
  const sentZoneIds = asManager ? form.zoneIds.filter((id) => visibleZoneIds.has(id)) : form.zoneIds

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (asManager) {
        // Role and reports-to are fixed by the API for a manager (sending them
        // is refused) — only the person's own details and zones go up.
        const body = { name: form.name, email: form.email, zoneIds: sentZoneIds }
        if (isEdit) {
          if (form.password.trim()) body.password = form.password
          await apiClient.patch(`/users/${initial.id}`, body)
        } else {
          await apiClient.post('/users', { ...body, password: form.password, role: 'SURVEYOR' })
        }
      } else if (isEdit) {
        const patch = { name: form.name, email: form.email }
        if (!isSelf) patch.role = form.role // never let an admin change their own role
        if (form.password.trim()) patch.password = form.password
        if (ZONE_ROLES.includes(form.role)) patch.zoneIds = form.zoneIds
        if (form.role === 'ACQUISITION_AGENT') {
          patch.cityId = territory.cityId || null
          patch.pincodes = pincodeList
        }
        // Sales chain — sent as null to clear when empty or on a non-sales role.
        if (SALES_ROLES.includes(form.role)) {
          patch.managerId = form.managerId || null
          patch.teamLeaderId = form.role === 'SALES_EXECUTIVE' ? form.teamLeaderId || null : null
        } else if (form.role === 'SURVEYOR') {
          // A surveyor reports to a zone manager, or to nobody.
          patch.managerId = form.managerId || null
          patch.teamLeaderId = null
        } else {
          patch.managerId = null
          patch.teamLeaderId = null
        }
        await apiClient.patch(`/users/${initial.id}`, patch)
      } else {
        const body = { ...form }
        if (!ZONE_ROLES.includes(body.role)) delete body.zoneIds
        if (body.role === 'ACQUISITION_AGENT') {
          body.cityId = territory.cityId || null
          body.pincodes = pincodeList
        }
        // The API rejects an empty-string id (min length 1) — omit, don't send ''.
        if (body.role === 'SURVEYOR') {
          if (!body.managerId) delete body.managerId
          delete body.teamLeaderId
        } else if (!SALES_ROLES.includes(body.role)) {
          delete body.managerId
          delete body.teamLeaderId
        } else {
          if (!body.managerId) delete body.managerId
          if (body.role !== 'SALES_EXECUTIVE' || !body.teamLeaderId) delete body.teamLeaderId
        }
        await apiClient.post('/users', body)
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save the user'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={asManager ? (isEdit ? 'Edit surveyor' : 'Add surveyor') : isEdit ? 'Edit user' : 'Add team member'}
      footer={
        <Button type="submit" form="user-form" fullWidth loading={busy}>
          {isEdit ? 'Save changes' : asManager ? 'Create surveyor' : 'Create user'}
        </Button>
      }
    >
      <form id="user-form" onSubmit={submit} className="flex flex-col gap-3">
        <Input id="u-name" label="Full name" value={form.name} onChange={set('name')} required />
        <Input
          id="u-email"
          label="Email"
          type="email"
          value={form.email}
          onChange={set('email')}
          required
        />
        <Input
          id="u-pass"
          label={isEdit ? 'New password' : 'Password'}
          type="password"
          placeholder={isEdit ? 'Leave blank to keep current' : '8+, with a letter & number'}
          value={form.password}
          onChange={set('password')}
          required={!isEdit}
        />
        {asManager ? (
          // Fixed: a manager's team is surveyors. Read-only text, not a
          // disabled select — nothing here to change.
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-ink">Role</span>
            <p className="text-sm font-normal text-muted">{roleLabel('SURVEYOR')}</p>
          </div>
        ) : (
          <Select
            id="u-role"
            label={isSelf ? 'Role (you can’t change your own)' : 'Role'}
            value={form.role}
            onChange={setRole}
            disabled={isSelf}
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {roleLabel(role)}
              </option>
            ))}
          </Select>
        )}

        {form.role === 'ACQUISITION_AGENT' && (
          <>
            <Select
              id="u-city"
              label="City"
              value={territory.cityId}
              onChange={(e) => setTerritory((t) => ({ ...t, cityId: e.target.value }))}
            >
              <option value="">Select city…</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Input
              id="u-pincodes"
              label="Pincodes"
              placeholder="411014, 411057"
              value={territory.pincodes}
              onChange={(e) => setTerritory((t) => ({ ...t, pincodes: e.target.value }))}
            />
          </>
        )}

        {ZONE_ROLES.includes(form.role) && (
          <ZoneMultiSelect
            zones={zones}
            selectedIds={form.zoneIds}
            onChange={(zoneIds) => setForm((prev) => ({ ...prev, zoneIds }))}
          />
        )}
        {hiddenZoneCount > 0 && (
          <p className="text-xs font-normal text-faint">
            Also works {hiddenZoneCount} zone{hiddenZoneCount === 1 ? '' : 's'} outside yours — kept as they are.
          </p>
        )}

        {/* Coverage chain: a surveyor may report to a zone manager. The admin's
            pick — a manager's own surveyors report to them automatically. */}
        {!asManager && form.role === 'SURVEYOR' && (
          <Select
            id="u-zone-manager"
            label="Reports to (manager)"
            value={form.managerId}
            onChange={set('managerId')}
          >
            <option value="">— None —</option>
            {salesCandidates.zoneManagers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        )}

        {/* Field-sales chain. A manager reports to the admin (no picker); a team
            leader picks their manager; an executive picks both. */}
        {!asManager && (form.role === 'TEAM_LEADER' || form.role === 'SALES_EXECUTIVE') && (
          <Select id="u-manager" label="Reports to (sales manager)" value={form.managerId} onChange={set('managerId')}>
            <option value="">Select a sales manager…</option>
            {salesCandidates.managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        )}
        {!asManager && form.role === 'SALES_EXECUTIVE' && (
          <Select id="u-leader" label="Team leader (optional)" value={form.teamLeaderId} onChange={set('teamLeaderId')}>
            <option value="">No team leader — reports to the manager directly</option>
            {salesCandidates.leaders.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        )}

        {error && (
          <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>
        )}
      </form>
    </Modal>
  )
}

// Matched-height row buttons (kept out of the tall <Button> so Edit and
// Deactivate/Activate line up).
const ACTION_BTN =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-btn border px-3.5 text-sm font-medium transition-colors duration-200 active:scale-[0.98] disabled:opacity-50'

function RowActions({ user, currentUserId, busyId, onEdit, onToggle }) {
  const busy = busyId === user.id
  const isSelf = user.id === currentUserId
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
      {!isSelf && (
        <button
          type="button"
          onClick={() => onToggle(user)}
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
      )}
    </div>
  )
}

export default function AdminUsersPage() {
  const currentUser = useAuthStore((s) => s.user)
  const isAdmin = currentUser?.role === 'ADMIN'
  // A zone manager sees "My team": only the surveyors who report to them (the
  // API scopes /users), adds and edits them, and nothing admin-only.
  const isManager = isZoneManager(currentUser?.role)
  const canEditRows = isAdmin || isManager
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [page, setPage] = useState(1)
  const [refreshTick, setRefreshTick] = useState(0)
  // { key, data } — loading derived from key mismatch, so effects never
  // call setState synchronously (react-hooks/set-state-in-effect).
  const [result, setResult] = useState(null)
  // null until loaded — so a manager's "no zones yet" notice never flashes.
  const [zones, setZones] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    apiClient
      .get('/zones')
      .then((res) => setZones(res.data.data ?? []))
      .catch(() => setZones([]))
  }, [])

  const paramsKey = useMemo(() => {
    const p = { page, pageSize: 50, tick: refreshTick }
    if (debouncedSearch.trim()) p.search = debouncedSearch.trim()
    if (roleFilter && isAdmin) p.role = roleFilter
    return JSON.stringify(p)
  }, [page, debouncedSearch, roleFilter, isAdmin, refreshTick])

  useEffect(() => {
    let cancelled = false
    const { tick, ...params } = JSON.parse(paramsKey)
    apiClient
      .get('/users', { params })
      .then((res) => !cancelled && setResult({ key: paramsKey, data: res.data.data }))
      .catch(
        (err) =>
          !cancelled &&
          setResult({ key: paramsKey, error: getApiErrorMessage(err, 'Could not load users') }),
      )
    return () => {
      cancelled = true
    }
  }, [paramsKey])

  const loading = result?.key !== paramsKey
  const users = result?.data?.items ?? null
  const pagination = result?.data
    ? { page: result.data.page, totalPages: result.data.totalPages, total: result.data.total }
    : null
  const listError = !loading && result?.error ? result.error : null
  // User mutations also drop the session-cached user directory (filter
  // dropdowns) so it refetches on next use.
  const refresh = () => {
    invalidateUsers()
    setRefreshTick((tick) => tick + 1)
  }

  async function toggleActive(user) {
    setBusyId(user.id)
    setError(null)
    try {
      await apiClient.patch(`/users/${user.id}`, { isActive: !user.isActive })
      refresh()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Update failed'))
    } finally {
      setBusyId(null)
    }
  }

  const youTag = (u) =>
    u.id === currentUser?.id && <span className="ml-1.5 text-xs font-normal text-faint">(you)</span>

  const columns = [
    {
      key: 'user',
      header: 'User',
      render: (u) => (
        <div className="min-w-0 max-w-[280px]">
          <p className="truncate font-bold">
            {u.name}
            {youTag(u)}
          </p>
          <p className="truncate text-xs font-normal text-muted">{u.email}</p>
          {ZONE_ROLES.includes(u.role) && u.assignedZones?.length > 0 && (
            <p
              className="mt-0.5 truncate text-xs font-normal text-faint"
              title={u.assignedZones.map((zone) => zone.name).join(', ')}
            >
              Zones: {zoneSummary(u.assignedZones)}
            </p>
          )}
        </div>
      ),
    },
    // A manager's team is all surveyors — a Role column would say so on every row.
    ...(isManager ? [] : [{ key: 'role', header: 'Role', render: (u) => <RoleBadge role={u.role} /> }]),
    { key: 'status', header: 'Status', render: (u) => <StatusBadge active={u.isActive} /> },
    ...(canEditRows
      ? [
          {
            key: 'actions',
            header: '',
            headerClassName: 'text-right',
            className: 'text-right',
            render: (u) => (
              <RowActions
                user={u}
                currentUserId={currentUser?.id}
                busyId={busyId}
                onEdit={setEditUser}
                onToggle={toggleActive}
              />
            ),
          },
        ]
      : []),
  ]

  const renderCard = (u) => (
    <div className={`rounded-card bg-card p-4 shadow-soft ${u.isActive ? '' : 'opacity-70'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold">
            {u.name}
            {youTag(u)}
          </p>
          <p className="truncate text-sm font-normal text-muted">{u.email}</p>
          {ZONE_ROLES.includes(u.role) && u.assignedZones?.length > 0 && (
            <p
              className="mt-0.5 truncate text-xs font-normal text-faint"
              title={u.assignedZones.map((zone) => zone.name).join(', ')}
            >
              Zones: {zoneSummary(u.assignedZones)}
            </p>
          )}
        </div>
        {!isManager && <RoleBadge role={u.role} />}
      </div>
      <div className="mt-2">
        <StatusBadge active={u.isActive} />
      </div>
      {canEditRows && (
        <div className="mt-3 border-t border-line/60 pt-3">
          <RowActions
            user={u}
            currentUserId={currentUser?.id}
            busyId={busyId}
            onEdit={setEditUser}
            onToggle={toggleActive}
          />
        </div>
      )}
    </div>
  )

  // A manager with no zones cannot give a surveyor any — the admin must first.
  const managerHasNoZones = isManager && zones !== null && zones.length === 0
  const emptyState = managerHasNoZones ? null : (
    <p className="text-sm font-normal text-muted">
      {isManager && !debouncedSearch.trim() ? 'No surveyors yet. Add your first surveyor.' : 'No matching users.'}
    </p>
  )

  return (
    <main className="mx-auto max-w-3xl">
      <PageHeader
        title={isManager ? 'My team' : 'Users'}
        sub={isManager ? 'Surveyors who report to you' : 'Survey team accounts and roles'}
        backHref="/dashboard"
        backLabel="Dashboard"
        action={
          isAdmin ? (
            <Button onClick={() => setCreateOpen(true)}>
              <IconPlus className="h-4.5 w-4.5" />
              Add user
            </Button>
          ) : isManager ? (
            <Button onClick={() => setCreateOpen(true)} disabled={zones === null || managerHasNoZones}>
              <IconPlus className="h-4.5 w-4.5" />
              Add surveyor
            </Button>
          ) : null
        }
      />
      <UsersTabs />

      {managerHasNoZones && (
        <p className="mb-3 rounded-btn bg-warn-tint px-4 py-3 text-sm font-normal text-warn">
          No zones assigned yet — ask an admin to give you your zones.
        </p>
      )}

      {(error || listError) && (
        <p className="mb-3 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">
          {error ?? listError}
        </p>
      )}

      {isAdmin && (
        <div className="mb-3 flex flex-wrap justify-end gap-2">
          <button
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-2 rounded-btn border border-line bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:border-fiber/50"
          >
            <IconUpload className="h-4 w-4" /> Import sales team
          </button>
          <button
            onClick={() => setBulkAssignOpen(true)}
            className="inline-flex items-center gap-2 rounded-btn border border-line bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:border-fiber/50"
          >
            <IconUpload className="h-4 w-4" /> Bulk assign zones
          </button>
        </div>
      )}

      <div className={`mb-4 grid grid-cols-1 gap-3 ${isAdmin ? 'sm:grid-cols-3' : ''}`}>
        <div className={isAdmin ? 'sm:col-span-2' : ''}>
          <Input
            id="u-search"
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>
        {isAdmin && (
          <Select
            id="u-role-filter"
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="">All roles</option>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {roleLabel(role)}
              </option>
            ))}
          </Select>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={users}
        loading={loading}
        keyField="id"
        renderCard={renderCard}
        pagination={pagination}
        onPageChange={setPage}
        emptyState={emptyState}
      />

      {createOpen && (
        <UserFormModal
          zones={zones ?? []}
          asManager={isManager}
          onClose={() => setCreateOpen(false)}
          onSaved={refresh}
        />
      )}
      {editUser && (
        <UserFormModal
          key={editUser.id}
          initial={editUser}
          zones={zones ?? []}
          asManager={isManager}
          isSelf={editUser.id === currentUser?.id}
          onClose={() => setEditUser(null)}
          onSaved={refresh}
        />
      )}
      {bulkAssignOpen && (
        <BulkAssignZonesModal onClose={() => setBulkAssignOpen(false)} onAssigned={refresh} />
      )}
      {importOpen && <ImportUsersModal onClose={() => setImportOpen(false)} onImported={refresh} />}
    </main>
  )
}
