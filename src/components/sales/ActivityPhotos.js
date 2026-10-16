'use client'

import { useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { uploadFile } from '@/lib/upload'
import { IconCamera } from '@/components/ui/icons'

/** Mirror of the API cap: the most photos one activity can keep. */
const MAX_PHOTOS = 10

/**
 * Proof photos for one logged activity on an open visit — a compact horizontal
 * strip (activity label, thumbnails, an "add" tile) so several activities sit
 * side by side instead of stacking down the card. Each file uploads as soon as
 * it is picked, then its URL is attached to that activity; a photo can be
 * removed again. `onChanged` refreshes the open visit (which re-signs the
 * links). Only works while the visit is open — the API refuses once checked out.
 */
export function ActivityPhotos({ visitId, type, label, images = [], onChanged }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const list = images ?? []

  async function handlePicked(event) {
    // Never upload more than the activity can keep — extra picks are skipped.
    const room = Math.max(0, MAX_PHOTOS - list.length)
    const files = [...event.target.files].slice(0, room)
    event.target.value = ''
    if (files.length === 0) return
    setUploading(true)
    setError(null)
    try {
      for (const file of files) {
        const url = await uploadFile(file)
        await apiClient.post(`/sales/visits/${visitId}/activities/${type}/images`, { url })
      }
      onChanged?.()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Photo upload failed'))
    } finally {
      setUploading(false)
    }
  }

  async function remove(url) {
    setUploading(true)
    setError(null)
    try {
      await apiClient.delete(`/sales/visits/${visitId}/activities/${type}/images`, { data: { url } })
      onChanged?.()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not remove the photo'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="inline-flex flex-col gap-1.5 rounded-btn border border-line bg-paper px-2.5 py-1.5">
      <div className="flex items-center gap-2">
        <p className="shrink-0 text-xs font-semibold text-muted">{label}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {list.map((url) => (
            <span key={url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`${label} photo`} className="h-12 w-12 rounded-btn border border-line object-cover" />
              <button
                type="button"
                aria-label={`Remove ${label} photo`}
                disabled={uploading}
                onClick={() => remove(url)}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-bad text-[10px] font-bold text-white shadow disabled:opacity-50"
              >
                ✕
              </button>
            </span>
          ))}
          {list.length < MAX_PHOTOS && (
            <label
              className={`flex h-12 w-12 cursor-pointer items-center justify-center rounded-btn border border-dashed border-line text-muted transition-colors hover:border-fiber hover:text-fiber ${
                uploading ? 'pointer-events-none opacity-60' : ''
              }`}
            >
              {uploading ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <IconCamera className="h-4 w-4" aria-hidden="true" />
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                disabled={uploading}
                onChange={handlePicked}
              />
            </label>
          )}
        </div>
      </div>
      {list.length >= MAX_PHOTOS && (
        <p className="text-xs font-normal text-muted">{MAX_PHOTOS} photos is the most one activity can keep.</p>
      )}
      {error && <p className="rounded-btn bg-bad-tint px-3 py-1.5 text-sm font-normal text-bad">{error}</p>}
    </div>
  )
}
