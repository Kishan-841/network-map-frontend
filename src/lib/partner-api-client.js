import axios from 'axios'
import { usePartnerAuthStore } from '@/stores/partner-auth-store'

/** The partner's API client. Its own token, its own 401 destination. */
export const partnerApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1',
})

partnerApi.interceptors.request.use((config) => {
  const token = usePartnerAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

partnerApi.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthCall = error.config?.url?.includes('/partner-auth/')
    if (error.response?.status === 401 && !isAuthCall) {
      usePartnerAuthStore.getState().clearAuth()
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/partner/login')) {
        window.location.href = '/partner/login'
      }
    }
    return Promise.reject(error)
  },
)

export function getPartnerApiError(error, fallback = 'Something went wrong') {
  return error.response?.data?.error?.message ?? fallback
}

export const PARTNER_TYPES = [
  { value: 'AGENT', label: 'Agent', company: 'Company name' },
  { value: 'SOCIETY_REPRESENTATIVE', label: 'Society representative', company: 'Society name' },
  { value: 'RETAIL_SHOP', label: 'Retail shop', company: 'Shop name' },
  { value: 'DSA', label: 'DSA', company: 'Firm name' },
]
export const partnerTypeLabel = (v) => PARTNER_TYPES.find((t) => t.value === v)?.label ?? v
