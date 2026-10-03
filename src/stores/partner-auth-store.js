import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Partner session — deliberately separate from the staff store, under its
 * own storage key. Someone can be signed in as staff and as a partner in the
 * same browser without either session overwriting the other, and a future
 * change to staff auth cannot accidentally alter partner auth.
 */
export const usePartnerAuthStore = create(
  persist(
    (set) => ({
      token: null,
      partner: null,
      setAuth: ({ token, partner }) => set({ token, partner }),
      setPartner: (partner) => set({ partner }),
      clearAuth: () => set({ token: null, partner: null }),
    }),
    { name: 'isp-partner-auth' },
  ),
)
