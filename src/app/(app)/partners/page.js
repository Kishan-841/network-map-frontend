'use client'

import { useEffect, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { DataTable } from '@/components/ui/DataTable'
import { IconPlus, IconUsers } from '@/components/ui/icons'

const STATUS_STYLE = {
  REGISTERED: 'bg-paper text-muted',
  PENDING_APPROVAL: 'bg-doc-tint text-doc',
  APPROVED: 'bg-ok-tint text-ok',
  REJECTED: 'bg-bad-tint text-bad',
  SUSPENDED: 'bg-bad-tint text-bad',
}
const STATUS_LABEL = {
  REGISTERED: 'Signed up',
  PENDING_APPROVAL: 'Awaiting approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  SUSPENDED: 'Suspended',
}
const TYPE_LABEL = {
  AGENT: 'Agent',
  SOCIETY_REPRESENTATIVE: 'Society rep',
  RETAIL_SHOP: 'Retail shop',
  DSA: 'DSA',
}
const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' })

/**
 * The invite link is shown ONCE. We only ever stored its hash, so if it is
 * lost the honest answer is to issue a new one — which the copy says.
 */
function InviteModal({ invite, onClose }) {
  const [copied, setCopied] = useState(false)
  return (
    <Modal
      open
      onClose={onClose}
      title="Invite link"
      footer={
        <Button fullWidth onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm font-normal text-muted">
          Send this to your partner. It works once, and expires in 7 days — anyone who
          signs up through it is mapped to you.
        </p>
        <div className="break-all rounded-btn bg-paper px-3 py-2.5 text-sm">{invite.url}</div>
        <Button
          variant="secondary"
          onClick={() => {
            navigator.clipboard?.writeText(invite.url)
            setCopied(true)
          }}
        >
          {copied ? 'Copied' : 'Copy link'}
        </Button>
        <p className="text-xs font-normal text-muted">
          We do not store the link itself, only a fingerprint of it — so this is the only
          time it can be shown. Lost it? Just create another.
        </p>
      </div>
    </Modal>
  )
}

export default function PartnersPage() {
  const [partners, setPartners] = useState(null)
  const [invites, setInvites] = useState([])
  const [newInvite, setNewInvite] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([apiClient.get('/partners'), apiClient.get('/partner-invites')])
      .then(([p, i]) => {
        if (cancelled) return
        setPartners(p.data.data)
        setInvites(i.data.data)
      })
      .catch((err) => !cancelled && setError(getApiErrorMessage(err, 'Could not load your partners')))
    return () => {
      cancelled = true
    }
  }, [tick])

  async function createInvite() {
    setBusy(true)
    setError(null)
    try {
      const res = await apiClient.post('/partner-invites')
      setNewInvite(res.data.data)
      setTick((t) => t + 1)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not create an invite'))
    } finally {
      setBusy(false)
    }
  }

  async function revoke(id) {
    setBusy(true)
    try {
      await apiClient.post(`/partner-invites/${id}/revoke`)
      setTick((t) => t + 1)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not revoke that invite'))
    } finally {
      setBusy(false)
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'Partner',
      render: (p) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{p.name}</p>
          <p className="truncate text-xs font-normal text-muted">{p.email}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (p) => (
        <div className="min-w-0">
          <p className="truncate text-sm">{TYPE_LABEL[p.type] ?? p.type}</p>
          {p.companyName && (
            <p className="truncate text-xs font-normal text-muted">{p.companyName}</p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) => (
        <span
          className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
            STATUS_STYLE[p.status] ?? 'bg-paper text-muted'
          }`}
        >
          {STATUS_LABEL[p.status] ?? p.status}
        </span>
      ),
    },
    {
      key: 'onboardedAt',
      header: 'Joined',
      render: (p) => dateFormat.format(new Date(p.onboardedAt)),
      className: 'tabular-nums text-muted',
    },
  ]

  const pendingInvites = invites.filter((i) => !i.usedAt && !i.revokedAt)

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">
      <PageHeader
        title="Partners"
        sub="Referral partners you have onboarded"
        action={
          <Button loading={busy} onClick={createInvite}>
            <IconPlus className="h-4.5 w-4.5" />
            Invite a partner
          </Button>
        }
      />

      {error && (
        <p className="mb-3 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>
      )}

      {pendingInvites.length > 0 && (
        <section className="mb-4 rounded-card bg-card p-4 shadow-soft">
          <p className="text-xs font-medium uppercase tracking-wide text-faint">
            Invites waiting to be used
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {pendingInvites.map((invite) => (
              <li key={invite.id} className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted">
                  Sent {dateFormat.format(new Date(invite.createdAt))} · expires{' '}
                  {dateFormat.format(new Date(invite.expiresAt))}
                </span>
                <button
                  type="button"
                  onClick={() => revoke(invite.id)}
                  className="shrink-0 text-sm font-medium text-bad underline-offset-2 hover:underline"
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <DataTable
        columns={columns}
        rows={partners}
        loading={partners === null}
        keyField="id"
        renderCard={(p) => (
          <div className="rounded-card bg-card p-4 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-bold">{p.name}</p>
                <p className="truncate text-sm font-normal text-muted">{p.email}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                  STATUS_STYLE[p.status] ?? 'bg-paper text-muted'
                }`}
              >
                {STATUS_LABEL[p.status] ?? p.status}
              </span>
            </div>
            <p className="mt-2 text-xs font-normal text-faint">
              {TYPE_LABEL[p.type] ?? p.type}
              {p.companyName ? ` · ${p.companyName}` : ''}
            </p>
          </div>
        )}
        emptyState={
          <div className="flex flex-col items-center rounded-card bg-card px-6 py-16 text-center shadow-soft">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-fiber-tint text-fiber">
              <IconUsers className="h-7 w-7" strokeWidth={1.8} />
            </span>
            <p className="mt-4 font-bold">No partners yet</p>
            <p className="mt-1 max-w-sm text-sm font-normal text-muted">
              Create an invite link and send it to someone you have pitched. Whoever signs up
              through it is mapped to you.
            </p>
          </div>
        }
      />

      {newInvite && <InviteModal invite={newInvite} onClose={() => setNewInvite(null)} />}
    </main>
  )
}
