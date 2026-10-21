'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { DataTable } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { SearchInput } from '@/components/ui/SearchInput'
import { IconEdit, IconPlus, IconTrash, IconUpload, IconUsers } from '@/components/ui/icons'
import { CustomerFormModal } from './CustomerFormModal'
import { ImportCustomersModal } from './ImportCustomersModal'
import { ConnectionStatus } from './ConnectionCard'
import { SummaryTiles } from './SummaryTiles'
import { BillingChip, Expiry, PlanCell } from './CustomerCells'
import { formatSignal } from '@/lib/connection'
import { buildTiles, filterByTile } from '@/lib/building-customer-tiles'

const wingText = (c) => c.wing?.name ?? <span className="text-muted">No wing</span>

/** Small square icon button, used in the desktop table's actions column. */
const ICON_BUTTON =
  'flex h-8 w-8 items-center justify-center rounded-btn text-muted transition-colors hover:bg-paper hover:text-ink'

function WingChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-9 shrink-0 rounded-btn border px-3 text-sm font-medium transition-colors ${
        active
          ? 'border-fiber bg-fiber text-white'
          : 'border-line bg-card text-muted hover:bg-paper hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

/**
 * The body of a building's customers page: header, wing chips (filter kept in
 * the URL as ?wing=<id|none>), search, and the table. Only canWrite users can
 * add, import, edit, or delete.
 */
export function CustomersSection({ buildingId, canWrite = false }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const wingParam = searchParams.get('wing') // null = All
  const [data, setData] = useState(null)
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [tileId, setTileId] = useState(null) // connection tile filter, in place
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
        setData(res.data.data)
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

  // Live connection status: one request for the whole building, fired after the
  // customer list has loaded. `forData` ties the answer to the list it was asked for.
  const [conn, setConn] = useState(null)
  useEffect(() => {
    if (!data) return undefined
    let alive = true
    apiClient
      .get('/customers/connections', { params: { buildingId } })
      .then((res) => {
        if (alive) setConn({ forData: data, failed: false, at: Date.now(), ...res.data.data })
      })
      .catch(() => {
        if (alive) setConn({ forData: data, failed: true, enabled: true, at: Date.now() })
      })
    return () => {
      alive = false
    }
  }, [data, buildingId])

  const all = data?.customers ?? null
  const wings = data?.wings ?? []
  const building = data?.building

  const counts = useMemo(() => {
    const byWing = {}
    let none = 0
    for (const c of all ?? []) {
      if (c.wing) byWing[c.wing.id] = (byWing[c.wing.id] ?? 0) + 1
      else none += 1
    }
    return { byWing, none }
  }, [all])

  const connections = conn?.connections
  const rows = useMemo(() => {
    if (!all) return null
    const q = query.trim().toLowerCase()
    return filterByTile(all, connections, tileId).filter((c) => {
      if (wingParam === 'none' && c.wing) return false
      if (wingParam && wingParam !== 'none' && c.wing?.id !== wingParam) return false
      if (!q) return true
      return [c.name, c.mobile, c.username].some((v) => v && String(v).toLowerCase().includes(q))
    })
  }, [all, wingParam, query, tileId, connections])

  function selectWing(value) {
    const next = new URLSearchParams(searchParams.toString())
    if (value) next.set('wing', value)
    else next.delete('wing')
    const qs = next.toString()
    router.replace(qs ? `?${qs}` : `/buildings/${buildingId}/customers`, { scroll: false })
  }

  async function handleDelete() {
    if (!pendingDelete || deleting) return
    setDeleting(true)
    setActionError(null)
    try {
      await apiClient.delete(`/customers/${pendingDelete.id}`)
      setPendingDelete(null)
      load()
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Could not delete the customer'))
    } finally {
      setDeleting(false)
    }
  }

  const backProps = { backHref: `/buildings/${buildingId}`, backLabel: 'Building' }

  if (missing) {
    return <PageHeader {...backProps} title="Not found" sub="This building could not be found." />
  }

  if (error) {
    return (
      <>
        <PageHeader {...backProps} title="Customers" />
        <p className="rounded-btn bg-bad-tint px-3 py-3 text-sm text-bad">{error}</p>
      </>
    )
  }

  const openCustomer = (c) => router.push(`/buildings/${buildingId}/customers/${c.id}`)
  const askDelete = (c) => {
    setPendingDelete(c)
    setActionError(null)
  }
  const total = all?.length ?? null

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

  const connLoading = Boolean(data) && conn?.forData !== data
  const connEnabled = Boolean(conn?.enabled)
  const connFailed = !connLoading && conn?.failed === true
  const showConn = connEnabled
  const connTiles = showConn && !connLoading && !connFailed
  // `now` is when the customers arrived — keeps render pure for the expiry colours.
  const now = conn?.forData === data ? (conn?.at ?? 0) : 0

  const wingFilterName =
    wingParam === 'none' ? 'No wing' : wings.find((w) => w.id === wingParam)?.name
  const filtered = Boolean(wingParam) || query.trim() !== '' || Boolean(tileId)
  const clearFilters = () => {
    setQuery('')
    setTileId(null)
    selectWing(null)
  }

  const emptyState =
    total > 0 && filtered ? (
      <div className="flex flex-col items-center gap-3 rounded-card border border-line bg-card px-6 py-12 text-center">
        <IconUsers className="h-8 w-8 text-faint" />
        <p className="font-medium">No customers match these filters</p>
        <Button variant="secondary" onClick={clearFilters}>
          Clear filters
        </Button>
      </div>
    ) : (
      <div className="rounded-card border border-dashed border-line px-4 py-8 text-center">
        <p className="text-sm font-medium text-ink">No customers yet</p>
        <p className="mt-1 text-sm text-muted">
          {canWrite
            ? 'Add a customer or upload an Excel file to get started.'
            : 'Customers will appear here when they are added.'}
        </p>
      </div>
    )

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (c) => <span className="font-medium text-ink">{c.name || 'Unnamed customer'}</span>,
    },
    { key: 'mobile', header: 'Mobile', render: (c) => c.mobile || '—' },
    { key: 'wing', header: 'Wing', render: wingText },
    { key: 'planName', header: 'Plan', render: (c) => <PlanCell row={c} /> },
    { key: 'expires', header: 'Expiry', render: (c) => <Expiry row={c} now={now} /> },
    { key: 'status', header: 'Billing', render: (c) => <BillingChip status={c.status} /> },
    ...(showConn
      ? [
          {
            key: 'connection',
            header: 'Connection',
            render: (c) =>
              connLoading ? (
                <span className="text-sm text-muted">Checking…</span>
              ) : connFailed || !connections?.[c.id] ? (
                '—'
              ) : (
                <ConnectionStatus connection={connections[c.id]} />
              ),
          },
          {
            key: 'signal',
            header: 'Signal',
            render: (c) => (connLoading ? '' : formatSignal(connections?.[c.id]) || '—'),
          },
        ]
      : []),
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
          <p className="mt-1 text-xs text-muted">Wing: {wingText(c)}</p>
          {c.planName && <p className="mt-1 text-xs text-muted">Plan: {c.planName}</p>}
          {c.planExpiresAt && (
            <p className="mt-1 text-xs text-muted">
              Expires: <Expiry row={c} now={now} />
            </p>
          )}
          {showConn && (
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {connLoading ? (
                <span className="text-muted">Checking…</span>
              ) : connFailed || !connections?.[c.id] ? (
                <span className="text-muted">—</span>
              ) : (
                <>
                  <ConnectionStatus connection={connections[c.id]} className="!text-xs" />
                  <span className="text-muted">{formatSignal(connections[c.id])}</span>
                </>
              )}
            </p>
          )}
        </div>
        {c.status && <span className="shrink-0"><BillingChip status={c.status} /></span>}
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

  return (
    <>
      <PageHeader
        {...backProps}
        title="Customers"
        sub={building ? `${building.buildingName} · ${total}` : undefined}
        action={action}
      />

      {wings.length > 0 && (
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by wing">
          <WingChip active={!wingParam} onClick={() => selectWing(null)}>
            All ({total})
          </WingChip>
          {wings.map((w) => (
            <WingChip key={w.id} active={wingParam === w.id} onClick={() => selectWing(w.id)}>
              {w.name} ({counts.byWing[w.id] ?? 0})
            </WingChip>
          ))}
          {(counts.none > 0 || wingParam === 'none') && (
            <WingChip active={wingParam === 'none'} onClick={() => selectWing('none')}>
              No wing ({counts.none})
            </WingChip>
          )}
        </div>
      )}

      <SummaryTiles
        tiles={buildTiles({ total, counts: conn?.counts, connectionsOn: connTiles, tileId })}
        onPick={(t) => setTileId(t.id === 'total' || t.id === tileId ? null : t.id)}
      />

      <SearchInput
        className="mb-4"
        value={query}
        onChange={setQuery}
        placeholder="Search name, mobile or username"
      />

      {showConn && connFailed && <p className="mb-3 text-sm text-muted">Connection status unavailable</p>}

      <DataTable
        columns={columns}
        rows={rows}
        loading={rows === null}
        onRowClick={openCustomer}
        renderCard={renderCard}
        emptyState={emptyState}
      />

      {formFor && (
        <CustomerFormModal
          buildingId={buildingId}
          customer={formFor === 'new' ? null : formFor}
          wings={wings}
          onClose={() => setFormFor(null)}
          onSaved={() => {
            setFormFor(null)
            load()
          }}
        />
      )}

      {importOpen && building && (
        <ImportCustomersModal
          forcedBuilding={{ id: building.id, buildingName: building.buildingName }}
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
    </>
  )
}
