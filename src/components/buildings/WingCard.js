'use client'

import { useEffect, useRef } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { IconChevronDown, IconTrash } from '@/components/ui/icons'
import { WING_NAME_MAX } from '@/lib/building-wings'

const hpText = (hp) => (String(hp ?? '').trim() === '' ? '— HP' : `${hp} HP`)

/**
 * One wing in the Locate-wings panel. Collapsed it is a one-line summary
 * (name · home pass · live); expanded it edits the draft in place. The parent
 * owns the draft, the errors and which fields show them (`shown`).
 * `canMarkLive` false (someone who can't locate the wings) shows Live as text.
 */
export function WingCard({
  wing,
  expanded,
  errors,
  shown,
  canMarkLive,
  autoFocus,
  onToggle,
  onChange,
  onBlurField,
  onDelete,
  cardRef,
}) {
  const nameRef = useRef(null)
  // A wing just dropped on the map opens with its name ready to retype.
  useEffect(() => {
    // Not on touch screens: the keyboard would cover the map and panel at once.
    if (expanded && autoFocus && !window.matchMedia('(pointer: coarse)').matches) {
      nameRef.current?.focus({ preventScroll: true })
      nameRef.current?.select()
    }
  }, [expanded, autoFocus])

  const hasErrors = Object.keys(errors).length > 0
  const id = `wing-${wing.key}`
  const liveText = (
    <span className={`inline-flex items-center gap-1.5 ${wing.isLive ? 'text-ok' : 'text-bad'}`}>
      <span className={`h-2 w-2 rounded-full ${wing.isLive ? 'bg-ok' : 'bg-bad'}`} aria-hidden />
      {wing.isLive ? 'Live' : 'Not live'}
    </span>
  )

  return (
    <li
      ref={cardRef}
      className={`rounded-card border bg-card transition-shadow ${
        expanded ? 'border-fiber shadow-soft ring-2 ring-fiber/15' : 'border-line'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={`Wing ${wing.name || 'without a name'}`}
        className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left text-sm"
      >
        <span
          className={`flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-bold text-white ${
            wing.isLive ? 'bg-ok' : 'bg-bad'
          }`}
          aria-hidden
        >
          {(wing.name || '?').slice(0, 3)}
        </span>
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="truncate font-semibold text-ink">{wing.name || 'Unnamed wing'}</span>
          {!expanded && (
            <>
              <span className="text-muted">· {hpText(wing.homePass)} ·</span>
              {liveText}
            </>
          )}
          {!expanded && hasErrors && <span className="font-medium text-bad">· needs fixing</span>}
        </span>
        <IconChevronDown
          size={18}
          className={`shrink-0 text-faint transition-transform ${expanded ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {expanded && (
        <div className="flex flex-col gap-3 border-t border-line px-3 pb-3 pt-3">
          <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-3">
            <Input
              ref={nameRef}
              id={`${id}-name`}
              label="Name"
              className="w-full min-w-0"
              placeholder="e.g. A"
              maxLength={WING_NAME_MAX}
              value={wing.name}
              error={shown.name ? errors.name : undefined}
              onChange={(e) => onChange({ name: e.target.value })}
              onBlur={() => onBlurField('name')}
            />
            <Input
              id={`${id}-homepass`}
              label="Home pass"
              className="w-full min-w-0"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="0"
              value={wing.homePass}
              error={shown.homePass ? errors.homePass : undefined}
              onChange={(e) => onChange({ homePass: e.target.value })}
              // A focused number input changes on wheel — let the panel scroll instead.
              onWheel={(e) => e.currentTarget.blur()}
              onBlur={() => onBlurField('homePass')}
            />
          </div>
          {canMarkLive ? (
            <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-btn border border-line px-3 text-sm">
              <span className="font-medium text-ink">Live</span>
              <span className="flex items-center gap-3">
                {liveText}
                <input
                  type="checkbox"
                  className="toggle toggle-success"
                  checked={Boolean(wing.isLive)}
                  onChange={(e) => onChange({ isLive: e.target.checked })}
                />
              </span>
            </label>
          ) : (
            <div className="flex min-h-11 items-center justify-between gap-3 rounded-btn border border-line px-3 text-sm">
              <span className="font-medium text-ink">Live</span>
              {liveText}
            </div>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="dangerGhost" className="h-11 min-h-11" onClick={onDelete}
              aria-label={`Delete wing ${wing.name}`}>
              <IconTrash size={16} aria-hidden /> Delete
            </Button>
            <Button type="button" className="h-11 min-h-11 flex-1" onClick={onToggle}>Done</Button>
          </div>
        </div>
      )}
    </li>
  )
}
