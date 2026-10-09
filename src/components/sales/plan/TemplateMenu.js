'use client'

import { useState } from 'react'
import { PLAN_XLSX_TEMPLATES, planTemplateSheet } from '@/lib/visit-plan-template'
import { istToday } from '@/lib/plan-sheet-dates'
import { Button } from '@/components/ui/Button'
import { IconDownload, IconChevronDown } from '@/components/ui/icons'

/** Build the .xlsx in the browser and download it (write-excel-file v4: subpath import, toFile). */
async function downloadTemplate(t) {
  const writeXlsxFile = (await import('write-excel-file/browser')).default
  const { data, options } = planTemplateSheet(t.kind, istToday())
  await writeXlsxFile(data, options).toFile(t.fileName)
}

/**
 * "Download template" → Weekly (first) or Monthly. The choices open inline
 * under the button rather than as a floating menu, so on a phone they never
 * fall off-screen. `link` renders the trigger as a text link (inside the
 * upload modal) instead of a secondary button.
 */
export function TemplateMenu({ link = false, className = '' }) {
  const [open, setOpen] = useState(false)
  const [failed, setFailed] = useState(false)
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
          {PLAN_XLSX_TEMPLATES.map((t) => (
            <li key={t.label}>
              <button
                type="button"
                onClick={() => {
                  setFailed(false)
                  downloadTemplate(t)
                    .then(() => setOpen(false))
                    .catch(() => setFailed(true))
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
      {failed && <p className="text-xs text-bad">Could not make the template — try again.</p>}
    </div>
  )
}
