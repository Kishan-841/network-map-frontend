'use client'

import { apiClient } from '@/lib/api-client'
import { PageHeader } from '@/components/ui/PageHeader'
import { RevenueCalculator } from '@/components/revenue/RevenueCalculator'

/** The employee runs this in front of a partner during the pitch. */
export default function StaffCalculatorPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 lg:px-8">
      <PageHeader
        title="Revenue calculator"
        sub="Show a partner what they could earn"
      />
      <RevenueCalculator client={apiClient} endpoint="/rate-card" />
    </main>
  )
}
