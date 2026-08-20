'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePathname } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import { homePathFor, isForbiddenPath } from '@/lib/roles'

export function AuthGuard({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const token = useAuthStore((s) => s.token)
  const role = useAuthStore((s) => s.user?.role)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated && !token) router.replace('/login')
  }, [hydrated, token, router])

  // The API blocks these too — this just avoids showing an empty screen.
  useEffect(() => {
    if (hydrated && token && isForbiddenPath(role, pathname)) {
      router.replace(homePathFor(role))
    }
  }, [hydrated, token, role, pathname, router])

  if (!hydrated || !token) return null
  if (isForbiddenPath(role, pathname)) return null
  return children
}
