'use client'

/**
 * Three steps, named.
 *
 * Numbering is only honest when order carries information — here it does, and
 * more importantly it answers the question this audience actually has before
 * they start: how much of this is there? Seeing "three things" is the
 * reassurance that gets someone to begin.
 */
export function StepRail({ steps, current }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Progress">
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={label} className="flex min-w-0 flex-1 items-center gap-2">
            <span
              aria-current={active ? 'step' : undefined}
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                done
                  ? 'bg-primary/15 text-primary'
                  : active
                    ? 'bg-primary text-primary-content'
                    : 'bg-paper text-faint'
              }`}
            >
              {done ? '✓' : i + 1}
            </span>
            <span
              className={`truncate text-xs font-medium ${
                active ? 'text-ink' : 'text-faint'
              }`}
            >
              {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
