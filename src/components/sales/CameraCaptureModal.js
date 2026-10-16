'use client'

import { useEffect, useRef, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { uploadFile } from '@/lib/upload'
import { getApiErrorMessage } from '@/lib/api-client'
import { IconCamera } from '@/components/ui/icons'

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
 * Live camera capture inside a dialog. Opens the rear (environment) camera
 * in-place, snaps a frame to a canvas, uploads it as a JPEG and hands the
 * stored URL to onCaptured — which is awaited, so an attach failure keeps the
 * dialog open with the error. The stream is always released on unmount.
 *
 * Needs a secure context (HTTPS or localhost); getUserMedia is unavailable
 * otherwise and the dialog says so.
 */
export function CameraCaptureModal({ open, onClose, onCaptured, facingMode = 'environment' }) {
  return (
    <Modal open={open} onClose={onClose} title="Take photo">
      {open && <CameraCapture onCaptured={onCaptured} onClose={onClose} facingMode={facingMode} />}
    </Modal>
  )
}

function CameraCapture({ onCaptured, onClose, facingMode }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [stream, setStream] = useState(null)
  const [phase, setPhase] = useState('starting') // starting | live | uploading | error
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)

  // Acquire the camera; re-runs on retry. ALWAYS stop the tracks on cleanup
  // (unmount or a new attempt) so the camera light goes off.
  useEffect(() => {
    let cancelled = false
    async function start() {
      setError(null)
      setPhase('starting')
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('This device or browser cannot open the camera.')
        setPhase('error')
        return
      }
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: false })
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = s
        setStream(s)
        setPhase('live')
      } catch (err) {
        if (!cancelled) {
          setError(cameraError(err))
          setPhase('error')
        }
      }
    }
    start()
    return () => {
      cancelled = true
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
  }, [facingMode, attempt])

  // Bind the live stream to the <video>.
  useEffect(() => {
    const video = videoRef.current
    if (video && stream) video.srcObject = stream
  }, [stream])

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
    if (!blob) {
      setError('Could not capture the photo. Try again.')
      return
    }
    setPhase('uploading')
    setError(null)
    try {
      const file = new File([blob], `activity-${Date.now()}.jpg`, { type: 'image/jpeg' })
      const url = await uploadFile(file)
      await onCaptured(url) // parent attaches it to the activity
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not add the photo'))
      setPhase('live')
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {phase === 'live' && stream && (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="mx-auto w-full rounded-btn bg-black object-cover"
            style={{ height: '48vh', transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
          />
          <div className="flex gap-2">
            <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" className="flex-1" onClick={capture}>
              <IconCamera className="h-4 w-4" aria-hidden="true" />
              Capture
            </Button>
          </div>
        </>
      )}

      {phase === 'starting' && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm font-medium text-muted">
          <span className="loading loading-spinner loading-xs" />
          Opening camera…
        </div>
      )}

      {phase === 'uploading' && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm font-medium text-muted">
          <span className="loading loading-spinner loading-xs" />
          Adding photo…
        </div>
      )}

      {error && <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>}

      {phase === 'error' && (
        <Button type="button" variant="secondary" fullWidth onClick={() => setAttempt((n) => n + 1)}>
          <IconCamera className="h-4 w-4" aria-hidden="true" />
          Try again
        </Button>
      )}
    </div>
  )
}
