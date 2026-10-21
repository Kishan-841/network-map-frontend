'use client'

import { use } from 'react'
import { CustomerDetail } from '@/components/customers/CustomerDetail'
import { safeBackHref } from '@/lib/customer-filters'

/** A customer opened from the Customers tab: Back returns to that list with its filters (?back=). */
export default function CustomerPage({ params, searchParams }) {
  const { customerId } = use(params)
  const { back } = use(searchParams)
  return <CustomerDetail customerId={customerId} backHref={safeBackHref(back)} backLabel="Customers" />
}
