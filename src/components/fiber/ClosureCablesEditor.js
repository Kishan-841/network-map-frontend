'use client'

import { Input, Select } from '@/components/ui/Input'
import { IconClose, IconPlus } from '@/components/ui/icons'
import { CLOSURE_CABLE_CORES, FIBER_TYPES } from '@/lib/fiber/constants'
import { emptyCable } from '@/lib/fiber/closure-cables'

const SIDES = [
  { direction: 'IN', title: 'In', noun: 'In cable' },
  { direction: 'OUT', title: 'Out', noun: 'Out cable' },
]

/**
 * The closure's cables, In and Out: any number on each side, each with a cable
 * type, a core count and the fiber ID the user types. `cables` are form rows
 * (lib/fiber/closure-cables); `onChange` gets the whole new list.
 * `compact` is the fibre editor's narrow card: fields stack two-and-one.
 */
export default function ClosureCablesEditor({ cables, onChange, disabled = false, compact = false }) {
  const update = (key, field, value) =>
    onChange(cables.map((row) => (row.key === key ? { ...row, [field]: value } : row)))
  const remove = (key) => onChange(cables.filter((row) => row.key !== key))
  const add = (direction) => onChange([...cables, emptyCable(direction)])

  const grid = compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-[1fr_1fr_1.4fr]'
  const tagSpan = compact ? 'col-span-2' : 'col-span-2 sm:col-span-1'

  return (
    <div className="flex flex-col gap-4">
      {SIDES.map(({ direction, title, noun }) => {
        const rows = cables.filter((row) => row.direction === direction)
        return (
          <section key={direction} aria-label={`${title} cables`} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-ink">
                {title}
                {rows.length > 0 && <span className="ml-1.5 font-normal text-muted">{rows.length}</span>}
              </h3>
              <button
                type="button"
                disabled={disabled}
                onClick={() => add(direction)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-btn border border-line bg-card px-3 text-sm font-medium text-ink transition-colors hover:bg-paper disabled:opacity-50"
              >
                <IconPlus className="h-4 w-4" aria-hidden="true" />
                Add {noun}
              </button>
            </div>

            {rows.length === 0 && <p className="text-sm font-normal text-faint">No {noun}s yet</p>}

            {rows.map((row, index) => {
              const id = `closure-${direction.toLowerCase()}-${index}`
              return (
                <div key={row.key} className="flex flex-col gap-2 rounded-btn border border-line p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
                      {noun} {index + 1}
                    </span>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => remove(row.key)}
                      aria-label={`Remove ${noun} ${index + 1}`}
                      className="-my-2 -mr-2 inline-flex h-11 w-11 items-center justify-center rounded-btn text-muted transition-colors hover:text-bad disabled:opacity-50"
                    >
                      <IconClose className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  <div className={`grid gap-2 ${grid}`}>
                    <label className="flex min-w-0 flex-col gap-1">
                      <span className="text-[11px] font-medium text-muted">Cable type</span>
                      <Select
                        id={`${id}-type`}
                        value={row.cableType}
                        disabled={disabled}
                        onChange={(e) => update(row.key, 'cableType', e.target.value)}
                      >
                        <option value="">—</option>
                        {FIBER_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </Select>
                    </label>
                    <label className="flex min-w-0 flex-col gap-1">
                      <span className="text-[11px] font-medium text-muted">Cores</span>
                      <Select
                        id={`${id}-cores`}
                        value={row.coreCount}
                        disabled={disabled}
                        onChange={(e) => update(row.key, 'coreCount', e.target.value)}
                      >
                        <option value="">—</option>
                        {CLOSURE_CABLE_CORES.map((count) => (
                          <option key={count} value={count}>
                            {count} core
                          </option>
                        ))}
                      </Select>
                    </label>
                    <label className={`flex min-w-0 flex-col gap-1 ${tagSpan}`}>
                      <span className="text-[11px] font-medium text-muted">Fiber ID</span>
                      <Input
                        id={`${id}-tag`}
                        placeholder="e.g. FIB-22"
                        maxLength={60}
                        value={row.cableTag}
                        disabled={disabled}
                        onChange={(e) => update(row.key, 'cableTag', e.target.value)}
                      />
                    </label>
                  </div>
                </div>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}
