'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import { isTeamLeader } from '@/lib/roles'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { DataTable } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import { Modal } from '@/components/ui/Modal'
import { Toast } from '@/components/ui/Toast'
import { LogMeetingModal } from '@/components/sales/LogMeetingModal'
import { IconOkCircle, IconPlus, IconPin } from '@/components/ui/icons'

const fmt = (iso) => new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const isToday = (iso) => {
  const d = new Date(iso)
  const n = new Date()
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
}
const mapHref = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`

const startOfDay = (d) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
const daysAgo = (n) => startOfDay(new Date(Date.now() - n * 86400000))
const PRESETS = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 days' },
  { key: 'custom', label: 'Custom' },
]

/** Full-photo detail of one meeting. */
function MeetingDetail({ meeting, onClose }) {
  return (
    <Modal open onClose={onClose} title="Meeting">
      <div className="flex flex-col gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={meeting.photoUrl} alt="Meeting" className="max-h-80 w-full rounded-card bg-paper object-cover" />
        <div className="rounded-btn bg-paper px-4 py-3">
          <p className="text-sm font-medium text-ink">{meeting.teamLeader?.name}</p>
          <p className="text-sm font-normal text-muted">{fmt(meeting.createdAt)}</p>
        </div>
        {meeting.note && <p className="text-sm font-normal text-ink">{meeting.note}</p>}
        <a
          href={mapHref(meeting.latitude, meeting.longitude)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium text-fiber underline-offset-2 hover:underline"
        >
          <IconPin className="h-4 w-4" aria-hidden="true" />
          {meeting.latitude.toFixed(5)}, {meeting.longitude.toFixed(5)} · Open in Maps
        </a>
      </div>
    </Modal>
  )
}

/**
 * Daily morning meetings. A team leader logs one a day (immutable — no editing
 * or replacing). A manager sees the whole team's; everyone gets a date filter,
 * a table that opens each meeting's detail, and pagination.
 */
export default function MeetingsPage() {
  const role = useAuthStore((s) => s.user?.role)
  const userId = useAuthStore((s) => s.user?.id)
  const isTL = isTeamLeader(role)

  const [range, setRange] = useState('7d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [page, setPage] = useState(1)
  const [meetings, setMeetings] = useState([])
  const [pagination, setPagination] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [logging, setLogging] = useState(false)
  const [toast, setToast] = useState(null)
  const [selected, setSelected] = useState(null)

  const window = useMemo(() => {
    if (range === 'today') return { from: startOfDay(new Date()).toISOString() }
    if (range === '7d') return { from: daysAgo(6).toISOString() }
    if (range === 'custom' && customFrom && customTo) {
      return { from: new Date(`${customFrom}T00:00:00`).toISOString(), to: new Date(`${customTo}T23:59:59`).toISOString() }
    }
    return {} // custom, not both dates yet → no date filter
  }, [range, customFrom, customTo])

  useEffect(() => setPage(1), [range, customFrom, customTo])

  const load = useCallback(() => {
    setLoading(true)
    apiClient
      .get('/sales/meetings', { params: { ...window, page, pageSize: 20 } })
      .then((res) => {
        setMeetings(res.data.data.items)
        setPagination(res.data.data.pagination)
        setLoading(false)
      })
      .catch((err) => {
        setError(getApiErrorMessage(err, 'Could not load meetings'))
        setLoading(false)
      })
  }, [window, page])
  useEffect(load, [load])

  const loggedToday = isTL && meetings.some((m) => m.teamLeader?.id === userId && isToday(m.createdAt))

  const columns = [
    {
      key: 'photo',
      header: '',
      className: 'w-14',
      render: (m) =>
        // eslint-disable-next-line @next/next/no-img-element
        <img src={m.photoUrl} alt="" className="h-10 w-10 rounded-btn bg-paper object-cover" />,
    },
    { key: 'tl', header: 'Team leader', render: (m) => <span className="font-medium text-ink">{m.teamLeader?.name}</span> },
    { key: 'when', header: 'When', className: 'whitespace-nowrap tabular-nums', render: (m) => fmt(m.createdAt) },
    { key: 'note', header: 'Note', render: (m) => <span className="line-clamp-1 text-muted">{m.note || '—'}</span> },
  ]

  const renderCard = (m) => (
    <button
      type="button"
      onClick={() => setSelected(m)}
      className="flex w-full items-center gap-3 rounded-card border border-line bg-card p-3 text-left"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={m.photoUrl} alt="" className="h-12 w-12 shrink-0 rounded-btn bg-paper object-cover" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{m.teamLeader?.name}</p>
        <p className="text-sm font-normal text-muted">{fmt(m.createdAt)}</p>
        {m.note && <p className="mt-0.5 line-clamp-1 text-sm font-normal text-muted">{m.note}</p>}
      </div>
    </button>
  )

  return (
    <main className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Field sales"
        title="Morning meetings"
        sub={isTL ? 'Log your team huddle each morning' : "Your team leaders' daily meetings"}
      />

      <Toast key={toast} message={toast} onDone={() => setToast(null)} />

      {/* Team leader's daily action (immutable once logged) */}
      {isTL && (
        <div className="mb-5">
          {loggedToday ? (
            <div className="inline-flex items-center gap-2 rounded-btn border border-line bg-card px-4 py-2.5 text-sm font-medium text-muted">
              <IconOkCircle className="h-5 w-5 text-ok" aria-hidden="true" />
              Today&apos;s meeting is logged
            </div>
          ) : (
            <Button className="w-full gap-2 sm:w-auto" onClick={() => setLogging(true)}>
              <IconPlus className="h-4.5 w-4.5" aria-hidden="true" />
              Log this morning&apos;s meeting
            </Button>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setRange(p.key)}
              className={`h-9 rounded-btn px-3 text-sm font-medium transition-colors ${
                range === p.key ? 'bg-fiber text-on-fiber' : 'border border-line text-muted hover:text-ink'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {range === 'custom' && (
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={customFrom}
              max={customTo || undefined}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-9 rounded-btn border border-line bg-card px-2 text-sm"
            />
            <span className="text-sm text-muted">to</span>
            <input
              type="date"
              value={customTo}
              min={customFrom || undefined}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-9 rounded-btn border border-line bg-card px-2 text-sm"
            />
          </div>
        )}
      </div>

      {error && <p className="mb-3 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>}

      <DataTable
        columns={columns}
        rows={meetings}
        loading={loading}
        keyField="id"
        onRowClick={setSelected}
        renderCard={renderCard}
        emptyState={<p className="text-sm font-normal text-muted">No meetings in this period.</p>}
      />
      <Pagination pagination={pagination} onChange={setPage} />

      {logging && (
        <LogMeetingModal
          onClose={() => setLogging(false)}
          onDone={() => {
            setLogging(false)
            setToast('Morning meeting logged')
            load()
          }}
        />
      )}
      {selected && <MeetingDetail meeting={selected} onClose={() => setSelected(null)} />}
    </main>
  )
}
