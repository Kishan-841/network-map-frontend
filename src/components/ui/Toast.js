'use client'

import { useEffect, useRef } from 'react'

const R = 9
const C = 2 * Math.PI * R

/**
 * A success toast that clears itself after `duration` (default 3s). The trailing
 * badge is a tick with a ring that draws around it over the countdown — when the
 * circle completes, the toast disappears. Clicking the badge dismisses it now.
 *
 * Rendered inline where the page's status line sits. Pass a unique `key` (the
 * message) from the parent so a new toast restarts the countdown.
 */
export function Toast({ message, onDone, duration = 3000, tone = 'ok', className = '' }) {
  const doneRef = useRef(onDone)
  useEffect(() => {
    doneRef.current = onDone
  }, [onDone])
  useEffect(() => {
    if (!message) return undefined
    const t = setTimeout(() => doneRef.current?.(), duration)
    return () => clearTimeout(t)
  }, [message, duration])

  if (!message) return null
  const tint = tone === 'ok' ? 'bg-ok-tint text-ok' : 'bg-fiber/10 text-fiber'

  return (
    <div className={`mb-3 flex items-center justify-between gap-3 rounded-btn px-4 py-3 text-sm font-medium ${tint} ${className}`} role="status">
      <span className="min-w-0">{message}</span>
      <button
        type="button"
        onClick={() => doneRef.current?.()}
        aria-label="Dismiss"
        className="relative shrink-0 transition-transform hover:scale-110"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6">
          <g transform="rotate(-90 12 12)">
            <circle cx="12" cy="12" r={R} fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
            <circle
              cx="12"
              cy="12"
              r={R}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C}
            >
              <animate attributeName="stroke-dashoffset" from={C} to="0" dur={`${duration / 1000}s`} fill="freeze" />
            </circle>
          </g>
          {/* the tick, static in the centre while the ring runs around it */}
          <path
            d="M8.5 12.4l2.2 2.2 4.8-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  )
}
