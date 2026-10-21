import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { toQuery } from '@/lib/customer-filters'

/** True when the backend capped the CSV (axios lowercases header names). */
export const isTruncated = (headers) => String(headers?.['x-truncated'] ?? '').toLowerCase() === 'true'

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())

/**
 * Download the customers the list is showing as a CSV. Sends the same filters (page left out — it
 * describes the screen, not the file). Throws a readable message on failure; with responseType
 * 'blob' an error body arrives as a Blob, so it is read back as text first.
 */
export async function exportCustomers(filters) {
  const params = toQuery({ ...filters, page: 1 })
  let response
  try {
    response = await apiClient.get('/customers/list.csv', { params, responseType: 'blob' })
  } catch (error) {
    const blob = error.response?.data
    if (blob instanceof Blob) {
      let message = null
      try {
        message = JSON.parse(await blob.text())?.error?.message ?? null
      } catch {
        message = null
      }
      if (message) throw new Error(message)
    }
    throw new Error(getApiErrorMessage(error, 'Could not download the customers'))
  }

  const name = `customers-${today()}.csv`
  const url = URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
  return { name, truncated: isTruncated(response.headers) }
}
