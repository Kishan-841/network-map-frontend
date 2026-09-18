'use client'

import Link from 'next/link'
import { IconClose } from '@/components/ui/icons'

/**
 * The overflow behind a bottom bar's "More" tab.
 *
 * A sheet rather than a menu: it comes from the bar it belongs to, and a
 * thumb reaching the bottom of a phone is already there. Tapping the backdrop
 * closes it, so escaping never needs a second precise tap.
 *
 * An admin's overflow runs to a dozen or more links, so the list scrolls
 * rather than growing past the top of the screen.
 */
export function MoreSheet({ items, pathname, onClose, isActive }) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 lg:hidden"
      onClick={onClose}
    >
      <div
        className="rounded-t-card bg-card pb-[env(safe-area-inset-bottom)] shadow-lift"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <p className="text-sm font-bold">More</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 text-faint transition-colors hover:text-ink"
          >
            <IconClose className="h-5 w-5" />
          </button>
        </div>
        <ul className="max-h-[65vh] overflow-y-auto overscroll-contain pb-3">
          {items.map((item) => {
            const active = isActive(item, pathname)
            const Icon = item.icon
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-3 px-5 py-3.5 text-sm font-medium transition-colors ${
                    active ? 'bg-primary/10 text-primary' : 'text-ink hover:bg-paper'
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" strokeWidth={1.8} />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

/**
 * Split a nav into what fits and what does not.
 *
 * Five is the most a thumb can hit reliably across a phone's width, so a
 * sixth item means four plus "More" — never five plus More, which would put
 * six targets in the space meant for five.
 */
export function splitNav(items, max = 5) {
  if (items.length <= max) return { visible: items, overflow: [] }
  return { visible: items.slice(0, max - 1), overflow: items.slice(max - 1) }
}
