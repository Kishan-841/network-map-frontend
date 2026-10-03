import { apiClient } from '@/lib/api-client'

const COMPRESS_THRESHOLD_BYTES = 300 * 1024
const MAX_DIMENSION_PX = 1920
const JPEG_QUALITY = 0.8

/**
 * Downscale/re-encode camera images before upload (PRD challenge #6:
 * compression for large documents). Surveyors are on mobile data — a 12 MP
 * photo shrinks ~10× with no practical quality loss for records.
 * PDFs and already-small images pass through untouched.
 */
export async function compressImage(file) {
  if (!file.type.startsWith('image/') || file.size <= COMPRESS_THRESHOLD_BYTES) return file

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_DIMENSION_PX / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
  if (!blob || blob.size >= file.size) return file // compression didn't help
  return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' })
}

/**
 * Upload one file and get back a link to it the page can SHOW right away.
 *
 * That is the API's signed `previewUrl` when it sends one — once the bucket is
 * private, the plain stored `url` no longer opens on its own — falling back to
 * `url`. Saving the returned link is safe: every save path on the API turns a
 * signed link back into the permanent one before storing it.
 *
 * `client` defaults to the staff API client. Partners pass their own client
 * so the request carries a PARTNER token — the uploads route accepts either
 * identity, but the two never share a token.
 */
export async function uploadFile(file, client = apiClient) {
  const prepared = await compressImage(file)
  const formData = new FormData()
  formData.append('file', prepared)
  const res = await client.post('/uploads', formData)
  return res.data.data.previewUrl ?? res.data.data.url
}
