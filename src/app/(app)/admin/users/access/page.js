'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Input } from '@/components/ui/Input'
import { DataTable } from '@/components/ui/DataTable'
import { UsersTabs } from '@/components/admin/UsersTabs'
import { invalidateUsers } from '@/hooks/useUsers'
import { accessCandidates } from '@/lib/access'
import { mayHoldAccess, ROLE_LABELS } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

// The accesses this page hands out, in column order. `roles` decides which
// rows can hold each one — a role that cannot shows a dash, not a dead box.
const ACCESSES = [
  { key: 'canManageFiber', label: 'Fiber drawing' },
  { key: 'canEditBuildings', label: 'Edit own buildings' },
]

/**
 * One tick = one access, saved the moment it changes. There is no Save
 * button on purpose: each change is its own audit row ("Fiber access given
 * to …"), and nobody walks away with unsaved ticks on the screen.
 */
function AccessCheckbox({ user, access, busy, onChange }) {
  if (!mayHoldAccess(user.role, access.key)) {
    return (
      <span className="text-sm font-normal text-faint">
        <span className="lg:hidden">{access.label}: </span>—
      </span>
    )
  }
  return (
    <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
      <input
        type="checkbox"
        className="checkbox checkbox-sm"
        checked={user[access.key] === true}
        disabled={busy || !user.isActive}
        onChange={(e) => onChange(user, access.key, e.target.checked)}
        aria-label={`${access.label} for ${user.name}`}
      />
      <span className="lg:hidden">{access.label}</span>
    </label>
  )
}

export default function AssignAccessesPage() {
  const router = useRouter()
  const role = useAuthStore((s) => s.user?.role)
  const isAdmin = role === 'ADMIN'
  // null until loaded; { error } when the load failed.
  const [result, setResult] = useState(null)
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)

  // The /admin layout lets managers in; this page is the admin's alone.
  useEffect(() => {
    if (role && !isAdmin) router.replace('/admin/users')
  }, [role, isAdmin, router])

  useEffect(() => {
    if (!isAdmin) return undefined
    let cancelled = false
    apiClient
      .get('/users')
      .then((res) => !cancelled && setResult({ users: res.data.data }))
      .catch(
        (err) =>
          !cancelled && setResult({ error: getApiErrorMessage(err, 'Could not load users') }),
      )
    return () => {
      cancelled = true
    }
  }, [isAdmin])

  async function setAccess(user, key, value) {
    setError(null)
    setBusyId(user.id)
    const patch = (next) =>
      setResult((current) => ({
        ...current,
        users: current.users.map((u) => (u.id === user.id ? { ...u, [key]: next } : u)),
      }))
    patch(value) // show the tick at once; put it back if the server says no
    try {
      await apiClient.patch(`/users/${user.id}/access`, { [key]: value })
      invalidateUsers()
    } catch (err) {
      patch(!value)
      setError(getApiErrorMessage(err, `Could not change access for ${user.name}`))
    } finally {
      setBusyId(null)
    }
  }

  if (!isAdmin) return null

  const rows = result?.users ? accessCandidates(result.users, search) : null

  const columns = [
    {
      key: 'user',
      header: 'User',
      render: (u) => (
        <div className={`min-w-0 max-w-[280px] ${u.isActive ? '' : 'opacity-60'}`}>
          <p className="truncate font-bold">{u.name}</p>
          <p className="truncate text-sm font-normal text-muted">{u.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (u) => (
        <span className="text-sm font-normal text-muted">
          {ROLE_LABELS[u.role] ?? u.role}
          {!u.isActive && ' · Inactive'}
        </span>
      ),
    },
    ...ACCESSES.map((access) => ({
      key: access.key,
      header: access.label,
      render: (u) => (
        <AccessCheckbox user={u} access={access} busy={busyId === u.id} onChange={setAccess} />
      ),
    })),
  ]

  const renderCard = (u) => (
    <div className={`rounded-card bg-card p-4 shadow-soft ${u.isActive ? '' : 'opacity-70'}`}>
      <p className="truncate font-bold">{u.name}</p>
      <p className="truncate text-sm font-normal text-muted">
        {ROLE_LABELS[u.role] ?? u.role}
        {!u.isActive && ' · Inactive'}
      </p>
      <div className="mt-2 flex flex-col gap-1 border-t border-line/60 pt-2">
        {ACCESSES.map((access) => (
          <AccessCheckbox
            key={access.key}
            user={u}
            access={access}
            busy={busyId === u.id}
            onChange={setAccess}
          />
        ))}
      </div>
    </div>
  )

  return (
    <main className="mx-auto max-w-3xl">
      <PageHeader
        title="Users"
        sub="Choose what each person may do beyond their role"
        backHref="/dashboard"
        backLabel="Dashboard"
      />
      <UsersTabs />

      {(error || result?.error) && (
        <p className="mb-3 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">
          {error ?? result.error}
        </p>
      )}

      <p className="mb-4 text-sm font-normal text-muted">
        <strong className="font-medium text-ink">Fiber drawing</strong> gives a manager, surveyor or
        supervisor the Fibers, POPs and Closures pages and lets them draw. Each person sees only
        the fibers, POPs and closures they added; admins see everyone&apos;s.{' '}
        <strong className="font-medium text-ink">Edit own buildings</strong>{' '}
        lets a surveyor correct
        the buildings they added themselves — not anyone else&apos;s, and not the permission details.
        Admins have both anyway. A change saves straight away and reaches the user the next time they
        open or return to the app.
      </p>

      <div className="mb-4">
        <Input
          id="access-search"
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={result === null}
        keyField="id"
        renderCard={renderCard}
        emptyState={<p className="text-sm font-normal text-muted">No matching users.</p>}
      />
    </main>
  )
}
