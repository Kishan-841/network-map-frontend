'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import { isTeamLeader } from '@/lib/roles'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { LogMeetingModal } from '@/components/sales/LogMeetingModal'
import { IconOkCircle, IconPlus, IconPin } from '@/components/ui/icons'

const fmt = (iso) => new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const isToday = (iso) => {
  const d = new Date(iso)
  const n = new Date()
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
}
const mapHref = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`

/**
 * The daily morning meetings tab. A team leader logs one meeting a day (photo +
 * location); a team leader sees their own, a sales manager their team's.
 */
export default function MeetingsPage() {
  const role = useAuthStore((s) => s.user?.role)
  const userId = useAuthStore((s) => s.user?.id)
  const isTL = isTeamLeader(role)

  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [logging, setLogging] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    apiClient
      .get('/sales/meetings')
      .then((res) => {
        setMeetings(res.data.data)
        setLoading(false)
      })
      .catch((err) => {
        setError(getApiErrorMessage(err, 'Could not load meetings'))
        setLoading(false)
      })
  }, [])
  useEffect(load, [load])

  const loggedToday = isTL && meetings.some((m) => m.teamLeader?.id === userId && isToday(m.createdAt))

  return (
    <main className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Field sales"
        title="Morning meetings"
        sub={isTL ? 'Log your team huddle each morning' : "Your team leaders' daily meetings"}
      />

      {/* Team leader's daily action */}
      {isTL && (
        <div className="mb-6">
          {loggedToday ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-ok/40 bg-ok-tint px-4 py-3">
              <span className="inline-flex items-center gap-2 text-sm font-medium text-ok">
                <IconOkCircle className="h-5 w-5" aria-hidden="true" />
                Today&apos;s meeting is logged
              </span>
              <button
                type="button"
                onClick={() => setLogging(true)}
                className="text-sm font-medium text-fiber underline-offset-2 hover:underline"
              >
                Replace
              </button>
            </div>
          ) : (
            <Button className="w-full gap-2" onClick={() => setLogging(true)}>
              <IconPlus className="h-4.5 w-4.5" aria-hidden="true" />
              Log this morning&apos;s meeting
            </Button>
          )}
        </div>
      )}

      {error && <p className="mb-3 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>}
      {loading && <p className="text-sm font-normal text-muted">Loading…</p>}
      {!loading && meetings.length === 0 && (
        <p className="rounded-card border border-dashed border-line bg-card px-4 py-8 text-center text-sm text-muted">
          No meetings logged yet.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {meetings.map((m) => (
          <div key={m.id} className="flex gap-3 rounded-card border border-line bg-card p-3 shadow-soft">
            <a href={m.photoUrl} target="_blank" rel="noreferrer" className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={m.photoUrl}
                alt="Meeting"
                className="h-20 w-20 rounded-btn bg-paper object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            </a>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{m.teamLeader?.name}</p>
              <p className="text-sm font-normal text-muted">{fmt(m.createdAt)}</p>
              {m.note && <p className="mt-1 line-clamp-2 text-sm font-normal text-ink">{m.note}</p>}
              <a
                href={mapHref(m.latitude, m.longitude)}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-fiber underline-offset-2 hover:underline"
              >
                <IconPin className="h-3.5 w-3.5" aria-hidden="true" />
                View location
              </a>
            </div>
          </div>
        ))}
      </div>

      {logging && <LogMeetingModal onClose={() => setLogging(false)} onDone={() => (setLogging(false), load())} />}
    </main>
  )
}
