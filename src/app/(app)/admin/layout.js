'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import { mayOpenAdminPath } from '@/lib/roles'

/** Client-side gate for the admin section — the API enforces roles for real. */
export default function AdminLayout({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const user = useAuthStore((s) => s.user)
  const role = user?.role
  // The fiber pages follow the per-user tick; the rest stay ADMIN / MANAGER.
  const allowed = mayOpenAdminPath(user, pathname)

  useEffect(() => {
    if (role && !allowed) router.replace('/map')
  }, [role, allowed, router])

  if (!allowed) return null
  return children
}
