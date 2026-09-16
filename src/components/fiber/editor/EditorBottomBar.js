'use client'

import { coreColor } from '@/lib/fiber/constants'
import {
  IconCircleDot,
  IconDiamond,
  IconHand,
  IconPen,
  IconRoute,
} from '@/components/ui/icons'

const DRAW_MODES = [
  { value: 'pan', label: 'Pan', Icon: IconHand },
  { value: 'draw', label: 'Draw', Icon: IconPen, core: true },
]
const ANNOTATE_MODES = [
  { value: 'pan', label: 'Pan', Icon: IconHand },
  { value: 'addClosure', label: '+ Closure', Icon: IconCircleDot },
  { value: 'addSplitter', label: '+ Splitter', Icon: IconDiamond },
  { value: 'editLine', label: 'Edit line', Icon: IconRoute, core: true },
]

/**
 * What the next tap on the map will do — the one control a technician uses
 * constantly, so it sits under the thumb. A bar across the bottom edge on a
 * phone, a floating pill from `lg` up.
 */
export default function EditorBottomBar({ phase, mode, onMode, coreCount }) {
  const modes = phase === 'draw' ? DRAW_MODES : ANNOTATE_MODES

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] lg:inset-x-auto lg:bottom-6 lg:left-1/2 lg:-translate-x-1/2 lg:rounded-full lg:border lg:pb-0 lg:shadow-lift">
      <div className="flex items-stretch gap-1 p-1.5">
        {modes.map(({ value, label, Icon, core }) => {
          const active = mode === value
          return (
            <button
              key={value}
              type="button"
              onClick={() => onMode(value)}
              aria-pressed={active}
              className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-btn px-2 text-[11px] font-medium transition-colors lg:min-w-28 lg:flex-none lg:flex-row lg:gap-2 lg:rounded-full lg:px-4 lg:text-sm ${
                active ? 'bg-fiber text-on-fiber' : 'text-muted hover:text-ink'
              }`}
            >
              <span className="relative flex items-center">
                <Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
                {/* The line you are about to draw, in its core-count colour. */}
                {core && (
                  <span
                    className="absolute -right-1.5 -top-0.5 h-2 w-2 rounded-full border border-card"
                    style={{ backgroundColor: coreColor(coreCount) }}
                    aria-hidden="true"
                  />
                )}
              </span>
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
