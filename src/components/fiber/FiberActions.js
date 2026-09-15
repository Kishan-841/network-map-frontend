'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { IconDoc, IconEdit } from '@/components/ui/icons'

/**
 * Everything the detail panel can *do* to a fiber. Copying the coordinates is
 * a read, so it stays available to everyone; edit appears only for a role the
 * API would let write (`canManage`).
 */
export default function FiberActions({ fiber, canManage, onEdit }) {
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef(null)

  useEffect(() => () => clearTimeout(copyTimer.current), [])

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

  return (
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
  )
}
