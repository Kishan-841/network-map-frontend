'use client'

import { partnerApi } from '@/lib/partner-api-client'
import { RevenueCalculator } from '@/components/revenue/RevenueCalculator'

export default function PartnerCalculatorPage() {
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">What you could earn</h1>
      <p className="mt-1 text-sm font-normal text-muted">
        Put in how many customers you think you can bring, and we will show you the money.
      </p>
      <div className="mt-4">
        <RevenueCalculator client={partnerApi} endpoint="/partner/rate-card" />
      </div>
    </>
  )
}
