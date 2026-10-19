'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { CHIP, FieldList, Section } from '@/components/fiber/details/DetailParts'
import { DataTable } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import {
  IconChevronDown,
  IconChevronRight,
  IconEdit,
  IconPlus,
  IconTrash,
  IconUpload,
} from '@/components/ui/icons'
import { formatWhen } from '@/lib/fiber/detail-format'
import { CustomerFormModal } from './CustomerFormModal'
import { ImportCustomersModal } from './ImportCustomersModal'

const rupee = (n) => (n == null ? null : `₹${Number(n).toLocaleString('en-IN')}`)
const days = (n) => (n == null ? null : `${n} day${n === 1 ? '' : 's'}`)
const when = (v) => (v ? formatWhen(v) : null)
const statusChip = (status) =>
  status ? <span className={`${CHIP} bg-paper text-muted`}>{status}</span> : '—'

/** Small square icon button, used in the desktop table's actions column. */
const ICON_BUTTON =
  'flex h-8 w-8 items-center justify-center rounded-btn text-muted transition-colors hover:bg-paper hover:text-ink'

/** Every recorded field, in display order — shared by the drawer's expansion. */
function detailRows(c) {
  return [
    ['Username', c.username],
    ['Mobile', c.mobile],
    ['E-Mail', c.email],
    ['Address', c.address],
    ['Site', c.site],
    ['Operator', c.operator],
    ['Network zone', c.networkZone],
    ['Plan', c.planName],
    ['Amount', rupee(c.planAmount)],
    ['Validity', days(c.planValidityDays)],
    ['Auto renewal', c.autoRenewal == null ? null : c.autoRenewal ? 'Yes' : 'No'],
    ['Activated', when(c.planActivatedAt)],
    ['Expires', when(c.planExpiresAt)],
    ['Status', c.status],
    ['Ageing', days(c.ageingDays)],
    ['Added', when(c.createdAt)],
  ]
}

/**
 * The customers of a building. Two layouts:
 *
 * - `table` (the building page): a table, one row per customer; a row opens
 *   that customer's own page. The admin's edit/delete stay in modals here.
 * - `list` (the map drawer, the default): the same cards the drawer always
 *   showed, expanding in place for the full record.
 *
 * Only users with canWrite=true can add, import, edit, or delete customers.
 */
export function CustomersSection({
  buildingId,
  buildingName,
  canWrite = false,
  className = '',
  layout = 'list',
}) {
  const router = useRouter()
  const [rows, setRows] = useState(null)
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [formFor, setFormFor] = useState(null)
  const [importOpen, setImportOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [actionError, setActionError] = useState(null)

  const load = useCallback(() => {
    let alive = true

    apiClient
      .get('/customers', { params: { buildingId } })
      .then((res) => {
        if (!alive) return
        setRows(res.data.data)
        setMissing(false)
        setError(null)
      })
      .catch((err) => {
        if (!alive) return
        if (err.response?.status === 404 || err.response?.status === 403) {
          setMissing(true)
        } else {
          setError(getApiErrorMessage(err, 'Could not load customers'))
        }
      })

    return () => {
      alive = false
    }
  }, [buildingId])

  useEffect(() => load(), [load])

  async function handleDelete() {
    if (!pendingDelete || deleting) return
    setDeleting(true)
    setActionError(null)
    try {
      await apiClient.delete(`/customers/${pendingDelete.id}`)
      setPendingDelete(null)
      setExpanded(null)
      load()
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Could not delete the customer'))
    } finally {
      setDeleting(false)
    }
  }

  if (missing) return null

  if (error) {
    return (
      <Section title="Customers" className={className}>
        <p className="rounded-btn bg-bad-tint px-3 py-3 text-sm text-bad">{error}</p>
      </Section>
    )
  }

  const openCustomer = (c) => router.push(`/buildings/${buildingId}/customers/${c.id}`)
  const askDelete = (c) => {
    setPendingDelete(c)
    setActionError(null)
  }
  const count = rows?.length ?? null

  const action = canWrite ? (
    <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
      <Button
        variant="secondary"
        className="!h-10 !min-h-10 w-full !text-sm sm:w-auto"
        onClick={() => setImportOpen(true)}
      >
        <IconUpload className="h-4 w-4 shrink-0" strokeWidth={1.8} />
        Upload Excel
      </Button>
      <Button className="!h-10 !min-h-10 w-full !text-sm sm:w-auto" onClick={() => setFormFor('new')}>
        <IconPlus className="h-4 w-4 shrink-0" strokeWidth={1.8} />
        Add customer
      </Button>
    </div>
  ) : null

  const emptyState = (
    <div className="rounded-card border border-dashed border-line px-4 py-8 text-center">
      <p className="text-sm font-medium text-ink">No customers yet</p>
      <p className="mt-1 text-sm text-muted">
        {canWrite
          ? 'Add a customer or upload an Excel file to get started.'
          : 'Customers will appear here when they are added.'}
      </p>
      {canWrite && (
        <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
          <Button variant="secondary" className="w-full sm:w-auto" onClick={() => setImportOpen(true)}>
            <IconUpload className="h-4 w-4" />
            Upload Excel
          </Button>
          <Button className="w-full sm:w-auto" onClick={() => setFormFor('new')}>
            <IconPlus className="h-4 w-4" />
            Add customer
          </Button>
        </div>
      )}
    </div>
  )

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (c) => <span className="font-medium text-ink">{c.name || 'Unnamed customer'}</span>,
    },
    { key: 'mobile', header: 'Mobile', render: (c) => c.mobile || '—' },
    { key: 'planName', header: 'Plan', render: (c) => c.planName || '—' },
    { key: 'status', header: 'Status', render: (c) => statusChip(c.status) },
    ...(canWrite
      ? [
          {
            key: 'actions',
            header: '',
            className: 'w-px whitespace-nowrap text-right',
            render: (c) => (
              <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className={ICON_BUTTON}
                  aria-label={`Edit ${c.name || 'customer'}`}
                  onClick={() => setFormFor(c)}
                >
                  <IconEdit className="h-4 w-4" strokeWidth={1.8} />
                </button>
                <button
                  type="button"
                  className={`${ICON_BUTTON} hover:text-bad`}
                  aria-label={`Delete ${c.name || 'customer'}`}
                  onClick={() => askDelete(c)}
                >
                  <IconTrash className="h-4 w-4" strokeWidth={1.8} />
                </button>
              </div>
            ),
          },
        ]
      : []),
  ]

  const renderCard = (c) => (
    <div
      onClick={() => openCustomer(c)}
      className="cursor-pointer rounded-card border border-line bg-card p-4 shadow-soft transition-colors hover:bg-primary/5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold text-ink [overflow-wrap:anywhere]">
            {c.name || 'Unnamed customer'}
          </p>
          <p className="mt-1 break-words text-sm text-muted [overflow-wrap:anywhere]">
            {c.mobile || 'No mobile number'}
          </p>
          {c.planName && <p className="mt-1 text-xs text-muted">Plan: {c.planName}</p>}
        </div>
        {c.status && <span className={`${CHIP} shrink-0 bg-paper text-muted`}>{c.status}</span>}
      </div>
      {canWrite && (
        <div className="mt-3 flex justify-end gap-2 border-t border-line/60 pt-3" onClick={(e) => e.stopPropagation()}>
          <Button variant="secondary" className="!h-9 !min-h-9 !text-sm" onClick={() => setFormFor(c)}>
            <IconEdit className="h-4 w-4 shrink-0" strokeWidth={1.8} />
            Edit
          </Button>
          <Button variant="dangerGhost" className="!h-9 !min-h-9 !text-sm" onClick={() => askDelete(c)}>
            <IconTrash className="h-4 w-4 shrink-0" strokeWidth={1.8} />
            Delete
          </Button>
        </div>
      )}
    </div>
  )

  const listBody = (
    <>
      {rows === null ? (
        <div className="flex flex-col gap-3">
          <div className="h-20 animate-pulse rounded-xl bg-paper" />
          <div className="h-20 animate-pulse rounded-xl bg-paper" />
        </div>
      ) : count === 0 ? (
        emptyState
      ) : (
        <ul className="flex min-w-0 flex-col gap-3">
          {rows.map((c) => {
            const isOpen = expanded === c.id
            return (
              <li
                key={c.id}
                className="min-w-0 overflow-hidden rounded-xl border border-line bg-card shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : c.id)}
                  className="flex w-full min-w-0 items-start gap-3 p-3 text-left transition-colors hover:bg-paper sm:p-4"
                  aria-expanded={isOpen}
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper text-muted">
                    {isOpen ? (
                      <IconChevronDown className="h-4 w-4" strokeWidth={1.8} />
                    ) : (
                      <IconChevronRight className="h-4 w-4" strokeWidth={1.8} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-sm font-semibold leading-5 text-ink [overflow-wrap:anywhere]">
                      {c.name || 'Unnamed customer'}
                    </span>
                    <span className="mt-1 block break-words text-sm leading-5 text-muted [overflow-wrap:anywhere]">
                      {c.mobile || 'No mobile number'}
                    </span>
                    {c.planName && (
                      <span className="mt-1 block break-words text-xs leading-5 text-muted [overflow-wrap:anywhere]">
                        Plan: {c.planName}
                      </span>
                    )}
                  </span>
                  {c.status && (
                    <span className={`${CHIP} shrink-0 bg-paper text-muted [overflow-wrap:anywhere]`}>
                      {c.status}
                    </span>
                  )}
                </button>

                {isOpen && (
                  <div className="min-w-0 border-t border-line/60 p-3 sm:p-4">
                    <div className="min-w-0">
                      <FieldList rows={detailRows(c)} />
                    </div>
                    {canWrite && (
                      <div className="mt-4 flex flex-col gap-2 border-t border-line/60 pt-3 sm:flex-row sm:justify-end">
                        <Button
                          variant="secondary"
                          className="!h-10 !min-h-10 w-full !text-sm sm:w-auto"
                          onClick={() => setFormFor(c)}
                        >
                          <IconEdit className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                          Edit customer
                        </Button>
                        <Button
                          variant="dangerGhost"
                          className="!h-10 !min-h-10 w-full !text-sm sm:w-auto"
                          onClick={() => askDelete(c)}
                        >
                          <IconTrash className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                          Delete customer
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )

  return (
    <Section title="Customers" count={count} action={action} className={className}>
      {layout === 'table' ? (
        <DataTable
          columns={columns}
          rows={rows}
          loading={rows === null}
          onRowClick={openCustomer}
          renderCard={renderCard}
          emptyState={emptyState}
        />
      ) : (
        listBody
      )}

      {/* Add/edit customer modal */}
      {formFor && (
        <CustomerFormModal
          buildingId={buildingId}
          customer={formFor === 'new' ? null : formFor}
          onClose={() => setFormFor(null)}
          onSaved={() => {
            setFormFor(null)
            load()
          }}
        />
      )}

      {/* Excel import modal */}
      {importOpen && (
        <ImportCustomersModal
          forcedBuilding={buildingName ? { id: buildingId, buildingName } : null}
          onClose={() => setImportOpen(false)}
          onImported={load}
        />
      )}

      {/* Delete confirmation modal */}
      <Modal
        open={Boolean(pendingDelete)}
        onClose={() => {
          if (!deleting) {
            setPendingDelete(null)
            setActionError(null)
          }
        }}
        title="Delete customer"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              disabled={deleting}
              onClick={() => {
                setPendingDelete(null)
                setActionError(null)
              }}
            >
              Cancel
            </Button>
            <Button variant="danger" loading={deleting} disabled={deleting} onClick={handleDelete}>
              <IconTrash className="h-4 w-4 shrink-0" strokeWidth={1.8} />
              Delete customer
            </Button>
          </div>
        }
      >
        <p className="break-words text-sm leading-6 text-muted">
          Delete <span className="font-semibold text-ink">“{pendingDelete?.name}”</span>? This cannot
          be undone.
        </p>
        {actionError && (
          <p className="mt-3 rounded-btn bg-bad-tint px-3 py-2 text-sm text-bad">{actionError}</p>
        )}
      </Modal>
    </Section>
  )
}
