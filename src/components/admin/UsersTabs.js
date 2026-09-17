'use client'

import { Tabs } from '@/components/ui/Tabs'
import { useAuthStore } from '@/stores/auth-store'

const TABS = [
  { href: '/admin/users', label: 'Team' },
  { href: '/admin/users/access', label: 'Assign accesses' },
]

/** Users section tabs. Accesses are the admin's to give, so a manager sees no strip. */
export function UsersTabs() {
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN')
  if (!isAdmin) return null
  return <Tabs tabs={TABS} label="Users sections" />
}
