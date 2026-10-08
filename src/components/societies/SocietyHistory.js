'use client'

import { useState } from 'react'
import { historyView } from '@/lib/society-page'
import { changeLabels, historyDetail, istDateTime, statusChangeText, visitKindLabel } from '@/lib/society'

const KIND_DOT = {
  ADDED: 'bg-fiber',
  VISIT: 'bg-ok',
  EDIT: 'bg-warn',
  // The admin-approval trail.
  SUBMITTED: 'bg-warn',
  WITHDRAWN: 'bg-faint',
  APPROVED: 'bg-ok',
  REJECTED: 'bg-bad',
  // The site survey + materials, and going live.
  SURVEY_SAVED: 'bg-fiber',
  SURVEY_SUBMITTED: 'bg-warn',
  SURVEY_EDITED: 'bg-warn',
  MATERIALS_APPROVED: 'bg-ok',
  MATERIALS_REJECTED: 'bg-bad',
  MARKED_LIVE: 'bg-ok',
}
// Kinds whose row lists what changed (the API's change keys).
const LISTS_CHANGES = new Set(['EDIT', 'SURVEY_EDITED'])

/**
 * A society's history, newest first as the API sends it: when (India time),
 * who, what kind of entry, any status change, the fields an edit changed,
 * and the remark — every entry carries one. The latest three show; the rest
 * open with "Show all N".
 */
export function SocietyHistory({ visits, zone = null }) {
  const [expanded, setExpanded] = useState(false)
  if (!visits?.length) return <p className="text-sm font-normal text-muted">No history yet.</p>
  const view = historyView(visits, expanded)
  return (
    <>
      <ol id="society-history" className="relative">
        {view.shown.map((v, i) => {
          const status = statusChangeText(v.statusBefore, v.statusAfter)
          const changes = LISTS_CHANGES.has(v.kind) ? changeLabels(v.changes) : []
          const detail = historyDetail(v, zone)
          return (
            <li key={v.id} className="relative flex min-w-0 gap-3 pb-4 last:pb-0">
              {/* the rail: a dot per entry, a line down to the next */}
              <span className="relative flex w-3 shrink-0 justify-center">
                <span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${KIND_DOT[v.kind] ?? 'bg-faint'}`} />
                {i < view.shown.length - 1 && <span className="absolute bottom-[-0.25rem] top-5 w-px bg-line" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="font-semibold text-ink">{visitKindLabel(v.kind)}</span>
                  <span className="font-normal text-muted">{istDateTime(v.createdAt)}</span>
                  {/* A null user on a SUBMITTED row is the system (the backfill), not a deleted person. */}
                  <span className="font-normal text-muted">
                    · {v.user?.name ?? (v.kind === 'SUBMITTED' ? 'System' : 'Former user')}
                  </span>
                </p>
                {status && <p className="mt-0.5 text-sm font-medium text-ink">Status: {status}</p>}
                {detail && <p className="mt-0.5 text-sm font-medium text-ink">{detail}</p>}
                {changes.length > 0 && (
                  <p className="mt-0.5 text-sm font-normal text-muted">Changed: {changes.join(', ')}</p>
                )}
                {v.remark && (
                  <p className="mt-1 whitespace-pre-wrap break-words rounded-btn bg-paper px-3 py-2 text-sm font-normal text-ink">
                    {v.kind === 'MATERIALS_REJECTED' && <span className="font-medium text-muted">Reason: </span>}
                    {v.remark}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      {view.canToggle && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls="society-history"
          onClick={() => setExpanded((e) => !e)}
          className="mt-3 min-h-9 text-sm font-medium text-fiber underline-offset-2 hover:underline"
        >
          {expanded ? 'Show less' : `Show all ${view.total}`}
        </button>
      )}
    </>
  )
}
