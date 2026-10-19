'use client'

import { use, useCallback, useEffect, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { IconEdit } from '@/components/ui/icons'
import { useAuthStore } from '@/stores/auth-store'
import { CustomerFormModal } from '@/components/customers/CustomerFormModal'
import { ConnectionCard } from '@/components/customers/ConnectionCard'

const when = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Kolkata',
})

const fmtWhen = (iso) => (iso ? when.format(new Date(iso)) : null)
const rupees = (n) => (n == null ? null : `₹${Number(n).toLocaleString('en-IN')}`)
const days = (n) => (n == null ? null : `${n} day${n === 1 ? '' : 's'}`)
const yesNo = (v) => (v == null ? null : v ? 'Yes' : 'No')

/** Card section of label/value rows. Hides rows without values, and itself when empty. */
function Section({ title, rows }) {
  const visible = rows.filter(([, value]) => value != null && value !== '')
  if (visible.length === 0) return null
  return (
    <section className="mt-5">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">{title}</p>
      <div className="rounded-card bg-card px-5 py-2 shadow-soft">
        {visible.map(([label, value], i) => (
          <div
            key={label}
            className={`flex items-baseline justify-between gap-4 py-3 ${
              i > 0 ? 'border-t border-line/60' : ''
            }`}
          >
            <span className="shrink-0 text-sm font-normal text-muted">{label}</span>
            <span className="text-right text-sm font-medium">{value}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

/**
 * One customer in full — every field recorded for it, read-only. The building
 * it belongs to is named in the header and links back; Edit lives on this
 * page (the form modal), and deleting stays on the customers list.
 */
export default function CustomerDetailPage({ params }) {
  const { id, customerId } = use(params)
  const [customer, setCustomer] = useState(null)
  const [error, setError] = useState(null)
  const [editOpen, setEditOpen] = useState(false)
  const isAdmin = useAuthStore((s) => s.user?.role) === 'ADMIN'

  const load = useCallback(
    () =>
      apiClient
        .get(`/customers/${customerId}`)
        .then((res) => setCustomer(res.data.data))
        .catch((err) => setError(getApiErrorMessage(err, 'Customer not found'))),
    [customerId],
  )

  useEffect(() => {
    load()
  }, [load])

  if (error) {
    return (
      <main className="mx-auto max-w-2xl">
        <PageHeader backHref={`/buildings/${id}/customers`} backLabel="Customers" title="Not found" sub={error} />
      </main>
    )
  }

  if (!customer) {
    return (
      <main className="mx-auto max-w-2xl">
        <div className="animate-pulse">
          <div className="h-4 w-24 rounded bg-line/70" />
          <div className="mt-6 h-7 w-1/2 rounded bg-line" />
          <div className="mt-3 h-4 w-3/4 rounded bg-line/70" />
          <div className="mt-8 h-48 rounded-card bg-line/40" />
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl">
      <PageHeader
        backHref={`/buildings/${id}/customers`}
        backLabel="Customers"
        title={customer.name}
        sub={customer.building?.buildingName}
        action={
          isAdmin ? (
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              <IconEdit className="h-4 w-4 shrink-0" strokeWidth={1.8} />
              Edit
            </Button>
          ) : null
        }
      />

      <Section
        title="Customer"
        rows={[
          ['Username', customer.username],
          ['Mobile', customer.mobile],
          ['E-Mail', customer.email],
          ['Wing', customer.wing?.name ?? 'No wing'],
        ]}
      />

      <ConnectionCard customerId={customerId} isAdmin={isAdmin} />

      <Section
        title="Network (from sheet)"
        rows={[
          ['PON number', customer.ponNumber],
          ['OLT', customer.olt],
        ]}
      />

      <Section
        title="Address"
        rows={[
          ['Address', customer.address],
          ['Site', customer.site],
          ['Operator', customer.operator],
          ['Network zone', customer.networkZone],
        ]}
      />

      <Section
        title="Plan"
        rows={[
          ['Plan', customer.planName],
          ['Amount', rupees(customer.planAmount)],
          ['Validity', days(customer.planValidityDays)],
          ['Auto renewal', yesNo(customer.autoRenewal)],
          ['Activated', fmtWhen(customer.planActivatedAt)],
          ['Expires', fmtWhen(customer.planExpiresAt)],
          ['Status', customer.status],
          ['Ageing', days(customer.ageingDays)],
        ]}
      />

      <Section title="Record" rows={[['Added', fmtWhen(customer.createdAt)]]} />

      {editOpen && (
        <CustomerFormModal
          buildingId={customer.building.id}
          customer={customer}
          wings={customer.wings ?? []}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false)
            load()
          }}
        />
      )}
    </main>
  )
}
