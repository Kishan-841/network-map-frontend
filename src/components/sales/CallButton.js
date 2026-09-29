'use client'

import { useEffect, useState } from 'react'
import { IconPhone } from '@/components/ui/icons'

/**
 * A tap-to-dial button. On a phone it is a `tel:` link that opens the dialler
 * with the number filled in; on a laptop/desktop there is nothing to dial, so
 * it renders nothing. "Mobile" = a coarse pointer (touch), matched live.
 */
export function CallButton({ phone, className = '' }) {
  const [mobile, setMobile] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    const mq = window.matchMedia('(pointer: coarse)')
    const sync = () => setMobile(mq.matches)
    sync()
    mq.addEventListener?.('change', sync)
    return () => mq.removeEventListener?.('change', sync)
  }, [])

  if (!mobile || !phone) return null
  return (
    <a
      href={`tel:${phone}`}
      className={`inline-flex items-center gap-1.5 rounded-btn bg-fiber px-3 py-1.5 text-sm font-medium text-on-fiber ${className}`}
    >
      <IconPhone className="h-4 w-4" strokeWidth={1.8} />
      Call
    </a>
  )
}
