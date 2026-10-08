'use client'

import { useState } from 'react'
import { getApiErrorMessage } from '@/lib/api-client'
import { uploadFile } from '@/lib/upload'
import { IconCamera } from '@/components/ui/icons'

/**
 * The optional Photos section of a closure — used by the editor's closure card
 * (create and edit) and the Closures page form. Controlled: `images` is the
 * list of URLs, `setImages` is a React state setter (it gets updater
 * functions, so photos picked together all land). Each file is uploaded as
 * soon as it is picked; the closure is only saved when the caller presses
 * Save, and the API turns the signed preview links back into stored ones.
 *
 * The picker accepts only what the uploads API stores (JPEG, PNG, WebP); a
 * phone still offers its camera, and an iPhone then hands over a JPEG rather
 * than HEIC.
 * `onUploadingChange` lets the caller hold Save while an upload is running.
 */
export default function ClosurePhotos({ images, setImages, onUploadingChange, disabled = false, compact = false }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  const busy = (value) => {
    setUploading(value)
    onUploadingChange?.(value)
  }

  async function handlePicked(event) {
    const files = [...event.target.files]
    event.target.value = ''
    if (files.length === 0) return
    busy(true)
    setError(null)
    try {
      for (const file of files) {
        const url = await uploadFile(file)
        setImages((prev) => [...(prev ?? []), url])
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Photo upload failed'))
    } finally {
      busy(false)
    }
  }

  const list = images ?? []
  const thumb = compact ? 'h-12 w-12' : 'h-14 w-14'

  return (
    <div className="min-w-0">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">
        Photos <span className="normal-case tracking-normal">(optional)</span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {list.map((url) => (
          <span key={url} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="Closure" className={`${thumb} rounded-btn border border-line object-cover`} />
            <button
              type="button"
              aria-label="Remove photo"
              disabled={disabled}
              onClick={() => setImages((prev) => (prev ?? []).filter((u) => u !== url))}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-bad text-[10px] font-bold text-white shadow disabled:opacity-50"
            >
              ✕
            </button>
          </span>
        ))}
        <label
          className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-btn border border-dashed border-line px-3 text-sm font-medium text-muted transition-colors hover:border-fiber hover:text-fiber ${
            uploading || disabled ? 'pointer-events-none opacity-60' : ''
          }`}
        >
          {uploading ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            <IconCamera className="h-4 w-4" aria-hidden="true" />
          )}
          {uploading ? 'Uploading…' : 'Add photo'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            disabled={uploading || disabled}
            onChange={handlePicked}
          />
        </label>
      </div>
      {error && <p className="mt-2 rounded-btn bg-bad-tint px-3 py-2 text-sm font-normal text-bad">{error}</p>}
    </div>
  )
}
