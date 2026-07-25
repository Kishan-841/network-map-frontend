'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { DataTable } from '@/components/ui/DataTable'
import { useAuthStore } from '@/stores/auth-store'
import { IconPlus, IconEdit } from '@/components/ui/icons'

const ROLES = ['SURVEYOR', 'MANAGER', 'ADMIN']
const roleLabel = (role) => role.charAt(0) + role.slice(1).toLowerCase()

const ROLE_CHIP = {
  ADMIN: 'bg-doc-tint text-doc',
  MANAGER: 'bg-fiber-tint text-fiber',
  SURVEYOR: 'bg-scan-tint text-scan',
}

function RoleBadge({ role }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_CHIP[role]}`}>
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

/** Shared create/edit dialog. `initial` set ⇒ edit mode (password optional). */
function UserFormModal({ open, onClose, onSaved, initial, isSelf }) {
  const isEdit = Boolean(initial)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'SURVEYOR' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setForm(
      initial
        ? { name: initial.name, email: initial.email, password: '', role: initial.role }
        : { name: '', email: '', password: '', role: 'SURVEYOR' },
    )
  }, [open, initial])

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (isEdit) {
        const patch = { name: form.name, email: form.email }
        if (!isSelf) patch.role = form.role // never let an admin change their own role
        if (form.password.trim()) patch.password = form.password
        await apiClient.patch(`/users/${initial.id}`, patch)
      } else {
        await apiClient.post('/users', form)
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
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit user' : 'Add team member'}>
      <form onSubmit={submit} className="flex flex-col gap-3">
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
        <Select
          id="u-role"
          label={isSelf ? 'Role (you can’t change your own)' : 'Role'}
          value={form.role}
          onChange={set('role')}
          disabled={isSelf}
        >
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {roleLabel(role)}
            </option>
          ))}
        </Select>

        {error && (
          <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>
        )}

        <Button type="submit" fullWidth loading={busy}>
          {isEdit ? 'Save changes' : 'Create user'}
        </Button>
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
  const [users, setUsers] = useState(null)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState(null)

  const fetchUsers = useCallback(
    () => apiClient.get('/users').then((res) => setUsers(res.data.data)),
    [],
  )

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  async function toggleActive(user) {
    setBusyId(user.id)
    setError(null)
    try {
      await apiClient.patch(`/users/${user.id}`, { isActive: !user.isActive })
      await fetchUsers()
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
        <div className="min-w-0">
          <p className="truncate font-bold">
            {u.name}
            {youTag(u)}
          </p>
          <p className="truncate text-xs font-normal text-muted">{u.email}</p>
        </div>
      ),
    },
    { key: 'role', header: 'Role', render: (u) => <RoleBadge role={u.role} /> },
    { key: 'status', header: 'Status', render: (u) => <StatusBadge active={u.isActive} /> },
    ...(isAdmin
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
        </div>
        <RoleBadge role={u.role} />
      </div>
      <div className="mt-2">
        <StatusBadge active={u.isActive} />
      </div>
      {isAdmin && (
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

  return (
    <main className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Administration"
        title="Users"
        sub="Survey team accounts and roles"
        backHref="/dashboard"
        backLabel="Dashboard"
        action={
          isAdmin && (
            <Button onClick={() => setCreateOpen(true)}>
              <IconPlus className="h-4.5 w-4.5" />
              Add user
            </Button>
          )
        }
      />

      {error && (
        <p className="mb-3 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>
      )}

      <DataTable
        columns={columns}
        rows={users}
        loading={users === null}
        keyField="id"
        renderCard={renderCard}
        emptyState={<p className="text-sm font-normal text-muted">No users yet.</p>}
      />

      <UserFormModal open={createOpen} onClose={() => setCreateOpen(false)} onSaved={fetchUsers} />
      <UserFormModal
        open={Boolean(editUser)}
        initial={editUser}
        isSelf={editUser?.id === currentUser?.id}
        onClose={() => setEditUser(null)}
        onSaved={fetchUsers}
      />
    </main>
  )
}
