'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { IconDoc, IconEdit, IconWarn } from '@/components/ui/icons'
import { segmentLabel } from '@/components/fiber/SegmentList'

/**
 * Everything the detail panel can *do* to a fiber. Copying the coordinates is
 * a read, so it stays available to everyone; edit / cut / restore appear only
 * for a role the API would let write (`canManage`).
 */
export default function FiberActions({ fiber, canManage, busy, onEdit, onCut, onRestore }) {
  const [cutOpen, setCutOpen] = useState(false)
  const [segmentId, setSegmentId] = useState('')
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef(null)

  useEffect(() => () => clearTimeout(copyTimer.current), [])

  const cuttable = fiber.segments.filter((s) => !s.isCut)

  const copyPoints = async () => {
    const text = fiber.points
      .map((p) => `${p.label ?? p.type},${p.latitude},${p.longitude}`)
      .join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      // A browser that refuses clipboard access (no permission, insecure
      // origin) is not an error worth a red box — the button simply does
      // nothing visible.
    }
  }

  const confirmCut = () => {
    if (!segmentId) return
    onCut(segmentId, note.trim() || null)
    setCutOpen(false)
    setSegmentId('')
    setNote('')
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {canManage && (
          <Button type="button" variant="secondary" className="h-11 min-h-11 flex-1" onClick={() => onEdit?.(fiber)}>
            <IconEdit className="h-4 w-4" strokeWidth={1.8} />
            Edit
          </Button>
        )}
        <Button type="button" variant="ghost" className="h-11 min-h-11 flex-1" onClick={copyPoints}>
          <IconDoc className="h-4 w-4" strokeWidth={1.8} />
          {copied ? 'Copied' : 'Copy lat/longs'}
        </Button>
      </div>

      {canManage && fiber.status === 'CUT' && (
        <Button type="button" variant="success" className="h-11 min-h-11" loading={busy} onClick={onRestore}>
          Restore fiber
        </Button>
      )}

      {canManage && cuttable.length > 0 && !cutOpen && (
        <Button type="button" variant="dangerGhost" className="h-11 min-h-11" onClick={() => setCutOpen(true)}>
          <IconWarn className="h-4 w-4" strokeWidth={1.8} />
          Mark CUT
        </Button>
      )}

      {canManage && cutOpen && (
        <div className="flex flex-col gap-2 rounded-btn border border-line p-3">
          <label htmlFor="cut-segment" className="text-sm font-medium text-ink">
            Which segment is cut?
          </label>
          <select
            id="cut-segment"
            value={segmentId}
            onChange={(e) => setSegmentId(e.target.value)}
            className="h-11 rounded-btn border border-line bg-card px-3 text-sm text-ink outline-none focus:border-fiber focus:ring-2 focus:ring-fiber/15"
          >
            <option value="">Select a segment…</option>
            {cuttable.map((segment) => (
              <option key={segment.id} value={segment.id}>
                {segmentLabel(fiber.points, segment)}
              </option>
            ))}
          </select>
          <input
            value={note}
            maxLength={300}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional) — e.g. road work near gate"
            className="h-11 rounded-btn border border-line bg-card px-3 text-sm text-ink outline-none placeholder:text-faint focus:border-fiber focus:ring-2 focus:ring-fiber/15"
          />
          <div className="flex gap-2">
            <Button
          type="button"
              variant="danger"
              className="h-11 min-h-11 flex-1"
              loading={busy}
              disabled={!segmentId}
              onClick={confirmCut}
            >
              Confirm cut
            </Button>
            <Button type="button" variant="ghost" className="h-11 min-h-11" onClick={() => setCutOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
