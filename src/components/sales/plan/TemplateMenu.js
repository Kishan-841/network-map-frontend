'use client'

import { useState } from 'react'
import { downloadCsvTemplate } from '@/lib/spreadsheet'
import { PLAN_TEMPLATES } from '@/lib/visit-plan-sheet'
import { Button } from '@/components/ui/Button'
import { IconDownload, IconChevronDown } from '@/components/ui/icons'

/**
 * "Download template" → Weekly (first) or Monthly. The choices open inline
 * under the button rather than as a floating menu, so on a phone they never
 * fall off-screen. `link` renders the trigger as a text link (inside the
 * upload modal) instead of a secondary button.
 */
export function TemplateMenu({ link = false, className = '' }) {
  const [open, setOpen] = useState(false)
  const trigger = (
    <>
      <IconDownload className="h-4.5 w-4.5" aria-hidden="true" /> Download template
      <IconChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
    </>
  )
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {link ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-fiber hover:underline"
        >
          {trigger}
        </button>
      ) : (
        <Button variant="secondary" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {trigger}
        </Button>
      )}
      {open && (
        <ul className="divide-y divide-line overflow-hidden rounded-btn border border-line bg-card" aria-label="Templates">
          {PLAN_TEMPLATES.map((t) => (
            <li key={t.label}>
              <button
                type="button"
                onClick={() => {
                  downloadCsvTemplate(t.fileName, t.csv)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-paper"
              >
                <IconDownload className="h-4 w-4 shrink-0 text-faint" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{t.label}</span>
                  <span className="block text-xs text-muted">{t.hint}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
