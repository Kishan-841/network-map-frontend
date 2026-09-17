'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Sub-pages of one section, as links — each tab is a real URL, so it can be
 * bookmarked and the back button works. `tabs`: [{ href, label }]. The tab
 * whose href is the current path is marked; nothing here holds state.
 */
export function Tabs({ tabs, label }) {
  const pathname = usePathname()
  return (
    <nav aria-label={label} className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((tab) => {
        const current = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={current ? 'page' : undefined}
            className={`-mb-px inline-flex min-h-11 shrink-0 items-center border-b-2 px-4 text-sm font-medium transition-colors duration-200 ${
              current
                ? 'border-fiber text-fiber'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
