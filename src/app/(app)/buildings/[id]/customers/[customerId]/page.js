'use client'

import { use } from 'react'
import { CustomerDetail } from '@/components/customers/CustomerDetail'

/** A customer opened from its building: Back returns to that building's customers. */
export default function BuildingCustomerPage({ params }) {
  const { id, customerId } = use(params)
  return <CustomerDetail customerId={customerId} backHref={`/buildings/${id}/customers`} backLabel="Customers" />
}
