'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { CustomerFilters } from './CustomerFilters'

// The filters the panel edits (search, sort and page stay on the page).
const PANEL_KEYS = ['zoneId', 'networkZone', 'operator', 'billingStatus', 'buildingId', 'conn', 'expiry', 'planName', 'autoRenewal', 'weak']
const EMPTY_DRAFT = Object.fromEntries(PANEL_KEYS.map((k) => [k, '']))
const pick = (filters) => Object.fromEntries(PANEL_KEYS.map((k) => [k, filters[k] ?? '']))

/**
 * All the filters in one dialog (a bottom sheet on phones). It edits a DRAFT copy taken when it
 * opens: Apply hands the draft to `onApply(patch)` once; closing any other way discards it.
 * Mount it only while open — the draft is then re-read from `filters` each time, with no effect.
 */
export function CustomerFilterPanel({ filters, facets, onApply, onClose }) {
  const [draft, setDraft] = useState(() => pick(filters))
  return (
    <Modal
      open
      sheet
      wide
      onClose={onClose}
      title="Filters"
      footer={
        <div className="flex gap-3">
          <Button type="button" variant="secondary" className="flex-1 sm:flex-none" onClick={() => setDraft(EMPTY_DRAFT)}>
            Clear all
          </Button>
          <Button type="button" className="flex-1 sm:ml-auto sm:flex-none sm:px-10" onClick={() => onApply(draft)}>
            Apply
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CustomerFilters filters={draft} facets={facets} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} idSuffix="-panel" />
      </div>
    </Modal>
  )
}
