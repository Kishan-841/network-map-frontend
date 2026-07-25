'use client'

import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { useAuthStore } from '@/stores/auth-store'

const ROLES = ['SURVEYOR', 'MANAGER', 'ADMIN']

const ROLE_CHIPS = {
  ADMIN: 'bg-doc-tint text-doc',
  MANAGER: 'bg-fiber-tint text-fiber',
  SURVEYOR: 'bg-scan-tint text-scan',
}

function AddUserForm({ onCreated }) {
  const [serverError, setServerError] = useState(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm({ defaultValues: { role: 'SURVEYOR' } })

  async function onSubmit(values) {
    setServerError(null)
    try {
      await apiClient.post('/users', values)
      reset()
      onCreated()
    } catch (err) {
      setServerError(getApiErrorMessage(err, 'Could not create the user'))
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="mb-6 flex flex-col gap-3 rounded-card bg-card p-5 shadow-soft"
    >
      <p className="text-sm font-bold">Add team member</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input id="new-name" placeholder="Full name" {...register('name', { required: true })} />
        <Input
          id="new-email"
          type="email"
          placeholder="Email"
          {...register('email', { required: true })}
        />
        <Input
          id="new-password"
          type="password"
          placeholder="Password (8+, letter & number)"
          {...register('password', { required: true })}
        />
        <Select id="new-role" {...register('role')}>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {role.charAt(0) + role.slice(1).toLowerCase()}
            </option>
          ))}
        </Select>
      </div>
      {serverError && (
        <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">
          {serverError}
        </p>
      )}
      <Button type="submit" loading={isSubmitting}>
        Create user
      </Button>
    </form>
  )
}

export default function AdminUsersPage() {
  const currentUser = useAuthStore((s) => s.user)
  const isAdmin = currentUser?.role === 'ADMIN'
  const [users, setUsers] = useState(null)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const fetchUsers = useCallback(
    () => apiClient.get('/users').then((res) => setUsers(res.data.data)),
    [],
  )

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  async function patchUser(id, data) {
    setBusyId(id)
    setError(null)
    try {
      await apiClient.patch(`/users/${id}`, data)
      await fetchUsers()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Update failed'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <main className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow="Administration"
        title="Users"
        sub="Survey team accounts and roles"
        backHref="/admin"
        backLabel="Dashboard"
      />

      {isAdmin && <AddUserForm onCreated={fetchUsers} />}

      {error && (
        <p className="mb-3 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {users === null && <p className="text-sm font-normal text-muted">Loading…</p>}
        {users?.map((user) => {
          const isSelf = user.id === currentUser?.id
          return (
            <div
              key={user.id}
              className={`rounded-card bg-card p-4 shadow-soft ${user.isActive ? '' : 'opacity-60'}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-bold">
                    {user.name}
                    {isSelf && <span className="ml-2 text-xs font-normal text-faint">(you)</span>}
                  </p>
                  <p className="truncate text-sm font-normal text-muted">{user.email}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium capitalize ${ROLE_CHIPS[user.role]}`}
                >
                  {user.role.toLowerCase()}
                </span>
              </div>

              {isAdmin && !isSelf && (
                <div className="mt-3 flex items-center gap-2 border-t border-line/60 pt-3">
                  <select
                    value={user.role}
                    disabled={busyId === user.id}
                    onChange={(e) => patchUser(user.id, { role: e.target.value })}
                    className="h-10 rounded-btn border border-line bg-card px-3 text-sm outline-none focus:border-fiber"
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role.charAt(0) + role.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant={user.isActive ? 'dangerGhost' : 'secondary'}
                    loading={busyId === user.id}
                    className="!h-10 !px-4 text-sm"
                    onClick={() => patchUser(user.id, { isActive: !user.isActive })}
                  >
                    {user.isActive ? 'Deactivate' : 'Reactivate'}
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </main>
  )
}
