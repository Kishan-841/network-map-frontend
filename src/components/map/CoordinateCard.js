'use client'

import { useEffect, useRef, useState } from 'react'
import { IconCopy, IconOkCircle } from '@/components/ui/icons'
import { copyText } from '@/lib/clipboard'
import { coordText } from '@/lib/fiber/detail-format'
import { coordinateCardPlacement } from '@/lib/map-coordinate-card'

// Wide enough for "-90.000000, -180.000000" next to the button — a cut-off
// coordinate is worse than none.
const CARD = { width: 300, height: 52 }

/**
 * The "what's here" card: the picked spot's lat/lng and a Copy button, with a
 * small ring marking the exact point. Copies `lat, lng` — the form Google Maps'
 * search box takes. The text is selectable too, for a browser that blocks
 * clipboard access.
 */
export default function CoordinateCard({ pick }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  const text = coordText(pick.latitude, pick.longitude)
  const { left, top } = coordinateCardPlacement(pick, pick, CARD)

  const copy = async () => {
    if (!(await copyText(text))) return
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute z-10 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow-lift"
        style={{ left: pick.x, top: pick.y }}
      />
      <div
        role="group"
        aria-label="Coordinates of this point"
        className="absolute z-20 flex items-center gap-2 rounded-card border border-line bg-card py-1.5 pl-3 pr-1.5 shadow-lift"
        style={{ left, top, width: CARD.width, height: CARD.height }}
      >
        <span className="min-w-0 flex-1 select-all truncate text-sm font-semibold tabular-nums">{text}</span>
        <button
          type="button"
          onClick={copy}
          className="btn btn-sm h-10 min-h-10 shrink-0 gap-1.5 rounded-btn btn-outline normal-case"
        >
          {copied ? <IconOkCircle className="h-4 w-4" strokeWidth={1.8} /> : <IconCopy className="h-4 w-4" strokeWidth={1.8} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </>
  )
}
