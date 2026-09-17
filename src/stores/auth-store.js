import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: ({ token, user }) => set({ token, user }),
      // Refreshes who we are without touching the token — see AuthGuard.
      setUser: (user) => set({ user }),
      clearAuth: () => set({ token: null, user: null }),
    }),
    { name: 'isp-auth' },
  ),
)
