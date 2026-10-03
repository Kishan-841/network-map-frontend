'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Input, Select } from '@/components/ui/Input'
import { DataTable } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { IconUserPlus, IconOkCircle } from '@/components/ui/icons'

const TYPE_LABEL = {
  AGENT: 'Agent',
  SOCIETY_REPRESENTATIVE: 'Society rep',
  RETAIL_SHOP: 'Retail shop',
  DSA: 'DSA',
}

const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' })

/** The one link that could still be used. */
const liveInvite = (r) =>
  (r.invites ?? []).find(
    (i) => !i.usedAt && !i.revokedAt && new Date(i.expiresAt).getTime() > Date.now(),
  ) ?? null

/**
 * Where an introduction has got to, read from what actually happened rather
 * than from a status somebody remembered to set.
 *
 * "Onboarded" means the link was USED — issuing one proves nothing, and a
 * manager who has sent three links has still onboarded nobody.
 */
function stageOf(r) {
  if (r.status === 'JOINED' || (r.invites ?? []).some((i) => i.usedAt)) {
    return { key: 'ONBOARDED', label: 'Onboarded', tone: 'bg-ok-tint text-ok' }
  }
  if (r.status === 'DECLINED') {
    return { key: 'DECLINED', label: 'Not going ahead', tone: 'bg-paper text-faint' }
  }
  if (liveInvite(r)) {
    return { key: 'INVITED', label: 'Invite sent', tone: 'bg-scan-tint text-scan' }
  }
  return { key: 'WAITING', label: 'To contact', tone: 'bg-fiber-tint text-fiber' }
}

function StageBadge({ referral }) {
  const stage = stageOf(referral)
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${stage.tone}`}
    >
      {stage.label}
    </span>
  )
}

/**
 * The link, shown once.
 *
 * The raw token is never stored — the server hands it back on creation and
 * cannot produce it again — so this says so plainly rather than letting
 * someone close the dialog and come looking for it later.
 */
function InviteLinkModal({ referral, invite, onClose }) {
  const [copied, setCopied] = useState(false)
  const expires = new Date(invite.expiresAt)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(invite.url)
      setCopied(true)
    } catch {
      // Clipboard access can be refused; the link is on screen to select.
      setCopied(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Invite link for ${referral.name}`}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-normal text-muted">
            Expires {expires.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Done
            </Button>
            <Button onClick={copy}>{copied ? 'Copied' : 'Copy link'}</Button>
          </div>
        </div>
      }
    >
      <p className="text-sm font-normal text-muted">
        Send this to {referral.name} on {referral.mobile}. It works once — when they use it, this
        introduction shows as onboarded and they are attributed to you.
      </p>
      <p className="mt-3 break-all rounded-btn bg-paper px-3 py-2.5 font-mono text-xs">
        {invite.url}
      </p>
      <p className="mt-3 rounded-btn bg-warn-tint px-3 py-2 text-xs font-normal text-warn">
        Copy it now — this is the only time it is shown. If you lose it, send a new link, which
        cancels this one.
      </p>
    </Modal>
  )
}

/**
 * People your partners have introduced.
 *
 * Its own tab rather than a panel on Partners: these are not partners yet, and
 * the work here is a different job — call them, then send a link.
 */
export default function ReferralsPage() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [stage, setStage] = useState('')
  const [busy, setBusy] = useState(null)
  const [showing, setShowing] = useState(null)

  const load = useCallback(
    () =>
      apiClient
        .get('/partner-referrals')
        .then((res) => setRows(res.data.data))
        .catch((err) => setError(getApiErrorMessage(err, 'Could not load referrals'))),
    [],
  )

  useEffect(() => {
    load()
  }, [load])

  const invite = async (referral) => {
    setError(null)
    setBusy(referral.id)
    try {
      const res = await apiClient.post(`/partner-referrals/${referral.id}/invite`)
      setShowing({ referral, invite: res.data.data })
      await load()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not create an invite link'))
    } finally {
      setBusy(null)
    }
  }

  const shown = useMemo(() => {
    if (!rows) return null
    const q = search.trim().toLowerCase()
    return rows.filter(
      (r) =>
        (!stage || stageOf(r).key === stage) &&
        (!q ||
          [r.name, r.mobile, r.referredBy?.name]
            .filter(Boolean)
            .some((f) => f.toLowerCase().includes(q))),
    )
  }, [rows, search, stage])

  const actionFor = (r) => {
    const stageKey = stageOf(r).key
    if (stageKey === 'ONBOARDED') {
      return (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-ok">
          <IconOkCircle className="h-4 w-4" strokeWidth={2} />
          Joined
        </span>
      )
    }
    return (
      <button
        type="button"
        onClick={() => invite(r)}
        disabled={busy === r.id}
        className="whitespace-nowrap rounded-btn border border-line px-3 py-1.5 text-xs font-medium transition-colors hover:border-fiber/60 hover:text-fiber disabled:opacity-50"
      >
        {busy === r.id ? 'Creating…' : stageKey === 'INVITED' ? 'New link' : 'Send invite'}
      </button>
    )
  }

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{r.name}</p>
          <p className="truncate text-xs font-normal text-muted">
            from {r.referredBy?.name ?? 'a partner'}
          </p>
        </div>
      ),
    },
    {
      key: 'mobile',
      header: 'Mobile',
      render: (r) => (r.mobile ? `+91 ${r.mobile}` : '—'),
      className: 'whitespace-nowrap tabular-nums text-muted',
    },
    { key: 'type', header: 'Type', render: (r) => TYPE_LABEL[r.type] ?? r.type },
    { key: 'stage', header: 'Status', render: (r) => <StageBadge referral={r} /> },
    {
      key: 'createdAt',
      header: 'Introduced',
      render: (r) => dateFormat.format(new Date(r.createdAt)),
      className: 'tabular-nums text-muted',
    },
    { key: 'action', header: 'Action', render: actionFor, className: 'w-px' },
  ]

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">
      <PageHeader title="Referrals" sub="People your partners have introduced" />

      {error && (
        <p className="mb-3 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">
          {error}
        </p>
      )}

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Input
            id="referrals-search"
            placeholder="Search name, mobile or the partner who introduced them…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select id="referrals-stage" value={stage} onChange={(e) => setStage(e.target.value)}>
          <option value="">Every stage</option>
          <option value="WAITING">To contact</option>
          <option value="INVITED">Invite sent</option>
          <option value="ONBOARDED">Onboarded</option>
          <option value="DECLINED">Not going ahead</option>
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={shown}
        loading={rows === null}
        keyField="id"
        renderCard={(r) => (
          <div className="rounded-card bg-card p-4 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-bold">{r.name}</p>
                <p className="truncate text-sm font-normal tabular-nums text-muted">
                  +91 {r.mobile}
                </p>
                <p className="truncate text-xs font-normal text-faint">
                  {TYPE_LABEL[r.type] ?? r.type} · from {r.referredBy?.name ?? 'a partner'}
                </p>
              </div>
              <StageBadge referral={r} />
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
              <span className="text-xs font-normal text-faint">
                Introduced {dateFormat.format(new Date(r.createdAt))}
              </span>
              {actionFor(r)}
            </div>
          </div>
        )}
        emptyState={
          <div className="flex flex-col items-center rounded-card bg-card px-6 py-16 text-center shadow-soft">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-fiber-tint text-fiber">
              <IconUserPlus className="h-7 w-7" strokeWidth={1.8} />
            </span>
            <p className="mt-4 font-bold">
              {rows?.length ? 'Nothing matches these filters' : 'No referrals yet'}
            </p>
            <p className="mt-1 max-w-sm text-sm font-normal text-muted">
              {rows?.length
                ? 'Try a different search or stage.'
                : 'When your partners introduce someone who could also send us customers, they will appear here.'}
            </p>
          </div>
        }
      />

      {showing && (
        <InviteLinkModal
          referral={showing.referral}
          invite={showing.invite}
          onClose={() => setShowing(null)}
        />
      )}
    </main>
  )
}
