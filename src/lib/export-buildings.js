import { apiClient, getApiErrorMessage } from '@/lib/api-client'

/** The filename the server chose, when it sent one. */
function filenameFrom(headers, fallback) {
  const disposition = headers?.['content-disposition']
  const match = disposition?.match(/filename="?([^";]+)"?/i)
  return match?.[1] ?? fallback
}

/**
 * Download the building list as a spreadsheet.
 *
 * Sends the SAME filter object the list is showing, so "export" always means
 * "export what I am looking at" rather than a second, quietly different
 * query. Page and page size are left out on purpose — they describe the
 * screen, not the file.
 *
 * Resolves with a short note about what was saved; throws a readable message
 * on failure, including the case where the server sent JSON instead of a
 * workbook (which is what an error looks like when the response is a blob).
 */
export async function exportBuildings(filter = {}) {
  const params = Object.fromEntries(
    Object.entries(filter).filter(([, value]) => value !== undefined && value !== ''),
  )

  let response
  try {
    response = await apiClient.get('/buildings/export', { params, responseType: 'blob' })
  } catch (error) {
    // With responseType 'blob', an error body arrives as a Blob, so the usual
    // message extraction finds nothing until it is read back as text.
    const blob = error.response?.data
    if (blob instanceof Blob) {
      try {
        const parsed = JSON.parse(await blob.text())
        throw new Error(parsed?.error?.message ?? 'Could not export the buildings')
      } catch (parseError) {
        if (parseError instanceof Error && parseError.message !== 'Unexpected end of JSON input') {
          throw parseError
        }
      }
    }
    throw new Error(getApiErrorMessage(error, 'Could not export the buildings'))
  }

  const name = filenameFrom(response.headers, 'buildings.xlsx')
  const url = URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revoking immediately can cancel the save in some browsers; one tick is
  // enough for the download to have taken hold.
  setTimeout(() => URL.revokeObjectURL(url), 0)

  const rows = Number(response.headers['x-export-rows'] ?? 0)
  const truncated = response.headers['x-export-truncated'] === 'true'
  return { name, rows, truncated }
}
