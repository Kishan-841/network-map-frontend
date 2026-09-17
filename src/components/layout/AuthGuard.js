'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePathname } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import { apiClient } from '@/lib/api-client'
import { homePathFor, isForbiddenPath } from '@/lib/roles'

// Often enough that a granted access shows up by the time someone switches
// back to this tab; rare enough to be free.
const REFRESH_EVERY_MS = 30_000

export function AuthGuard({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const role = user?.role
  const lastRefresh = useRef(0)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated && !token) router.replace('/login')
  }, [hydrated, token, router])

  // The stored user is a copy from login, and the server moves on without it:
  // an admin changes a role, or ticks an access on Users → Assign accesses.
  // Re-read it on load and whenever the tab comes back into view, so the new
  // sidebar link appears without logging out. (A 401 here signs the user out
  // through the api client, which is right for a deactivated account.)
  useEffect(() => {
    if (!hydrated || !token) return undefined
    const refresh = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastRefresh.current < REFRESH_EVERY_MS) return
      lastRefresh.current = Date.now()
      apiClient
        .get('/auth/me')
        .then((res) => setUser(res.data.data))
        .catch(() => {}) // offline or a blip — the stored copy still stands
    }
    refresh()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [hydrated, token, setUser])

  // The API blocks these too — this just avoids showing an empty screen.
  useEffect(() => {
    if (hydrated && token && isForbiddenPath(role, pathname, user)) {
      router.replace(homePathFor(role))
    }
  }, [hydrated, token, role, pathname, user, router])

  if (!hydrated || !token) return null
  if (isForbiddenPath(role, pathname, user)) return null
  return children
}
