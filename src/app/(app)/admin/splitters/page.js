'use client'

import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable } from '@/components/ui/DataTable'
import { SearchInput } from '@/components/ui/SearchInput'
import { Pagination } from '@/components/ui/Pagination'
import { useClientTable } from '@/hooks/useClientTable'
import { useSplitters } from '@/hooks/useSplitters'
import { POINT_COLORS, RATIO_LABELS } from '@/lib/fiber/constants'
import { useAuthStore } from '@/stores/auth-store'
import DetailDrawer from '@/components/fiber/details/DetailDrawer'
import { useDetailStack } from '@/components/fiber/details/useDetailStack'

const ratioLabel = (s) => RATIO_LABELS[s.ratio] ?? s.ratio

// Where a splitter sits: inside a closure, or straight on a fiber line.
const whereLabel = (s) => (s.closure ? `Closure ${s.closure.code}` : s.onFiber ? `On ${s.onFiber.name}` : '—')

// A splitter has no zone of its own — search what a person would type: its
// code, the ratio, the closure it is in, or the fibers it touches.
const splitterSearchText = (s) => [s.code, ratioLabel(s), s.closure?.code, s.onFiber?.name, s.inputFiber?.name]

const portsLabel = (s) => `${s.portsUsed} / ${s.portsTotal}`

export default function AdminSplittersPage() {
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'ADMIN'
  const { splitters, loading } = useSplitters()
  const table = useClientTable(splitters, { getSearchText: splitterSearchText })
  const router = useRouter()
  // A row opens the right-hand detail drawer; links inside it walk the network.
  const details = useDetailStack()

  const columns = [
    { key: 'code', header: 'Code', render: (s) => <span className="font-mono font-bold">{s.code}</span> },
    { key: 'ratio', header: 'Ratio', className: 'tabular-nums', render: ratioLabel },
    { key: 'type', header: 'Type', render: (s) => s.location ?? '—' },
    { key: 'where', header: 'Where', render: whereLabel },
    { key: 'ports', header: 'Ports used', className: 'tabular-nums', render: portsLabel },
  ]

  const renderCard = (s) => (
    <button
      type="button"
      onClick={() => details.open('splitter', s.id)}
      className="flex w-full items-center gap-2 rounded-card border-l-4 bg-card p-3 text-left shadow-soft transition-transform active:scale-[0.99]"
      style={{ borderLeftColor: POINT_COLORS.SPLITTER }}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate font-mono font-bold">
          {s.code} · {ratioLabel(s)}
        </span>
        <span className="block truncate text-sm font-normal text-muted">
          {whereLabel(s)} · {portsLabel(s)} ports used
        </span>
      </span>
    </button>
  )

  return (
    <main className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Administration"
        title="Splitters"
        sub={isAdmin ? 'Every splitter on the network' : "Splitters on your zones' cables, and any you added"}
        backHref="/dashboard"
        backLabel="Dashboard"
      />

      <SearchInput
        value={table.search}
        onChange={table.onSearchChange}
        placeholder="Search splitters by code, ratio, closure or fiber…"
        className="mb-4"
      />

      <DataTable
        columns={columns}
        rows={table.rows}
        loading={loading}
        keyField="id"
        onRowClick={(row) => details.open('splitter', row.id)}
        renderCard={renderCard}
        emptyState={
          <p className="text-sm font-normal text-muted">
            No splitters yet. Add one in a closure, or place one on a line in the fiber editor.
          </p>
        }
      />

      <Pagination pagination={table.pagination} onChange={table.onPageChange} />

      <DetailDrawer
        stack={details.stack}
        onOpen={details.push}
        onBack={details.back}
        onClose={details.close}
        onEditFiber={(fiber) => router.push(`/admin/fiber?edit=${fiber.id}`)}
        onEditPop={(pop) => router.push(`/admin/pops?edit=${pop.id}`)}
      />
    </main>
  )
}
