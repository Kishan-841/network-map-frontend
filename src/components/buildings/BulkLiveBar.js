'use client'

import { useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { invalidateBuildingMarkers } from '@/hooks/useBuildingMarkers'

/**
 * Bulk go-live bar for the buildings list.
 *
 * Two selection modes, and the difference matters:
 *  - explicit ids  — the rows the user ticked on this page
 *  - "all matching" — the FILTER is sent instead of ids, and the server
 *    resolves it with the same rule the list used. That is the only way to
 *    cover a zone with more buildings than one page holds.
 */
export function BulkLiveBar({ selectedCount, totalMatching, allMatching, filter, ids, scopeLabel, canDelete = false, canAssignOlt = false, onSelectAllMatching, onClear, onDone, onDeleted, onAssignOlt }) {
  const [confirm, setConfirm] = useState(null) // true | false | null → target isLive
  const [deleting, setDeleting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const count = allMatching ? totalMatching : selectedCount
  if (!count) return null

  // Offer "select all N" only when the filter actually holds more than the
  // page — otherwise ticking the header box already covered everything.
  const canSelectAll = !allMatching && totalMatching > selectedCount

  async function apply() {
    setBusy(true)
    setError(null)
    try {
      const body = allMatching ? { filter, isLive: confirm } : { ids: [...ids], isLive: confirm }
      const res = await apiClient.patch('/buildings/bulk-status', body)
      // A whole filter's worth of markers just changed colour.
      invalidateBuildingMarkers()
      setConfirm(null)
      onDone(res.data.data)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not update those buildings'))
    } finally {
      setBusy(false)
    }
  }

  // Ticked rows only — the schema refuses a filter, so deleting a whole page-
  // spanning selection is deliberately not offered here.
  async function applyDelete() {
    setBusy(true)
    setError(null)
    try {
      const res = await apiClient.post('/buildings/bulk-delete', { ids: [...ids] })
      setDeleting(false)
      onDeleted(res.data.data)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not delete those buildings'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="sticky top-2 z-20 mb-3 flex flex-wrap items-center gap-3 rounded-card border border-fiber/30 bg-card px-4 py-3 shadow-lift">
        <p className="text-sm font-medium">
          {count} selected
          {scopeLabel && <span className="ml-1.5 font-normal text-muted">in {scopeLabel}</span>}
        </p>

        {canSelectAll && (
          <button
            type="button"
            onClick={onSelectAllMatching}
            className="text-sm font-medium text-fiber underline-offset-2 hover:underline"
          >
            Select all {totalMatching} matching
          </button>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-9 items-center rounded-btn border border-line px-3.5 text-sm font-medium text-muted transition-colors hover:border-faint hover:text-ink"
          >
            Clear
          </button>
          {canAssignOlt && !allMatching && (
            <button
              type="button"
              onClick={onAssignOlt}
              className="inline-flex h-9 items-center rounded-btn border border-fiber/40 px-3.5 text-sm font-medium text-fiber transition-colors hover:bg-fiber-tint"
            >
              Assign OLT
            </button>
          )}
          {canDelete && !allMatching && (
            <button
              type="button"
              onClick={() => {
                setError(null)
                setDeleting(true)
              }}
              className="inline-flex h-9 items-center rounded-btn border border-bad/40 px-3.5 text-sm font-medium text-bad transition-colors hover:bg-bad-tint"
            >
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirm(false)}
            className="inline-flex h-9 items-center rounded-btn border border-line px-3.5 text-sm font-medium text-muted transition-colors hover:border-faint hover:text-ink"
          >
            Mark not live
          </button>
          <button
            type="button"
            onClick={() => setConfirm(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-btn bg-primary px-4 text-sm font-medium text-primary-content transition-colors active:scale-[0.98]"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-primary-content" />
            Mark live
          </button>
        </div>
      </div>

      {confirm !== null && (
        <Modal
          open
          onClose={() => !busy && setConfirm(null)}
          title={confirm ? `Mark ${count} building${count === 1 ? '' : 's'} live?` : `Mark ${count} building${count === 1 ? '' : 's'} not live?`}
          footer={
            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setConfirm(null)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button className="flex-1" loading={busy} onClick={apply}>
                {confirm ? 'Mark live' : 'Mark not live'}
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-3">
            <p className="text-sm font-normal text-muted">
              {allMatching ? (
                <>
                  Every building matching the current filter
                  {scopeLabel ? (
                    <>
                      {' '}
                      — <span className="font-medium text-ink">{scopeLabel}</span> —
                    </>
                  ) : (
                    ' '
                  )}
                  will be marked {confirm ? 'live' : 'not live'}. That is{' '}
                  <span className="font-medium text-ink">{totalMatching}</span> building
                  {totalMatching === 1 ? '' : 's'}, including any not shown on this page.
                </>
              ) : (
                <>
                  The <span className="font-medium text-ink">{count}</span> building
                  {count === 1 ? '' : 's'} you selected will be marked{' '}
                  {confirm ? 'live' : 'not live'}.
                </>
              )}
            </p>
            <p className="text-sm font-normal text-muted">
              You can reverse this at any time by selecting them again.
            </p>
            {error && (
              <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">
                {error}
              </p>
            )}
          </div>
        </Modal>
      )}

      {deleting && (
        <Modal
          open
          onClose={() => !busy && setDeleting(false)}
          title={`Permanently delete ${count} building${count === 1 ? '' : 's'}?`}
          footer={
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setDeleting(false)} disabled={busy}>
                Cancel
              </Button>
              <Button variant="danger" className="flex-1" loading={busy} onClick={applyDelete}>
                Delete {count}
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-3">
            <p className="text-sm font-normal text-muted">
              The <span className="font-medium text-ink">{count}</span> building
              {count === 1 ? '' : 's'} you selected will be permanently removed.{' '}
              <span className="font-medium text-ink">This cannot be undone.</span>
            </p>
            <p className="text-sm font-normal text-muted">
              Any building still attached to a fiber is kept — you will be told how many were skipped.
            </p>
            {error && (
              <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>
            )}
          </div>
        </Modal>
      )}
    </>
  )
}
