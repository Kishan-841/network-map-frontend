'use client'

import { useEffect, useRef, useState } from 'react'
import { uploadFile } from '@/lib/upload'
import { getApiErrorMessage } from '@/lib/api-client'
import { Button } from '@/components/ui/Button'
import { IconCamera, IconOkCircle } from '@/components/ui/icons'

/** A friendlier message for the common getUserMedia failures. */
function cameraError(err) {
  if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError')
    return 'Camera permission is blocked. Allow camera access, then try again.'
  if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError')
    return 'No camera found on this device.'
  if (err?.name === 'NotReadableError') return 'The camera is in use by another app.'
  return err?.message || 'Could not open the camera.'
}

/**
 * Capture a check-in selfie with the live camera — no gallery upload. Opens the
 * front camera in-place, snaps a frame to a canvas, and uploads it as a JPEG.
 * Calls onCaptured(url) with the stored URL. The stream is always released on
 * unmount and after a shot.
 *
 * Needs a secure context (HTTPS or localhost); getUserMedia is unavailable
 * otherwise and the component says so.
 */
export function SelfieCapture({ onCaptured, disabled }) {
  const videoRef = useRef(null)
  const [stream, setStream] = useState(null)
  const [phase, setPhase] = useState('idle') // idle | live | uploading | done
  const [error, setError] = useState(null)

  // Bind the live stream to the <video>, and ALWAYS stop the tracks on cleanup
  // (unmount or a new stream) so the camera light goes off.
  useEffect(() => {
    const video = videoRef.current
    if (video && stream) video.srcObject = stream
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop())
    }
  }, [stream])

  async function start() {
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This device or browser cannot open the camera.')
      return
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      setStream(s)
      setPhase('live')
    } catch (err) {
      setError(cameraError(err))
    }
  }

  function stopStream() {
    setStream((s) => {
      if (s) s.getTracks().forEach((t) => t.stop())
      return null
    })
  }

  async function capture() {
    const video = videoRef.current
    const w = video?.videoWidth
    const h = video?.videoHeight
    if (!w || !h) return
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d').drawImage(video, 0, 0, w, h)
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.9))
    stopStream()
    if (!blob) {
      setError('Could not capture the photo. Try again.')
      setPhase('idle')
      return
    }
    setPhase('uploading')
    setError(null)
    try {
      const file = new File([blob], `selfie-${Date.now()}.jpg`, { type: 'image/jpeg' })
      const url = await uploadFile(file)
      onCaptured(url)
      setPhase('done')
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not upload the selfie'))
      setPhase('idle')
    }
  }

  function retake() {
    onCaptured(null)
    start()
  }

  return (
    <div className="flex flex-col gap-2">
      {phase === 'live' && (
        <>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="mx-auto max-w-full rounded-btn bg-black object-cover"
            style={{ height: '38vh', aspectRatio: '3 / 4', transform: 'scaleX(-1)' }}
          />
          <div className="flex gap-2">
            <Button type="button" variant="ghost" className="flex-1" disabled={disabled} onClick={stopStream}>
              Cancel
            </Button>
            <Button type="button" className="flex-1" disabled={disabled} onClick={capture}>
              <IconCamera className="h-4 w-4" aria-hidden="true" />
              Capture
            </Button>
          </div>
        </>
      )}

      {phase === 'idle' && (
        <Button type="button" variant="secondary" fullWidth disabled={disabled} onClick={start}>
          <IconCamera className="h-4 w-4" aria-hidden="true" />
          Take a selfie
        </Button>
      )}

      {phase === 'uploading' && (
        <div className="flex items-center gap-2 rounded-btn border border-line px-4 py-3 text-sm font-medium text-muted">
          <span className="loading loading-spinner loading-xs" />
          Uploading selfie…
        </div>
      )}

      {phase === 'done' && (
        <div className="flex items-center gap-2 rounded-btn border border-line px-4 py-3 text-sm font-medium">
          <IconOkCircle className="h-4 w-4 text-ok" aria-hidden="true" />
          <span className="text-ok">Selfie captured</span>
          <button
            type="button"
            onClick={retake}
            disabled={disabled}
            className="ml-auto text-fiber underline-offset-2 hover:underline disabled:opacity-50"
          >
            Retake
          </button>
        </div>
      )}

      {error && <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>}
    </div>
  )
}
