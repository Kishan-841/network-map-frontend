'use client'

import { useAuthStore } from '@/stores/auth-store'
import { canAssignSalesBuildings } from '@/lib/roles'
import { PageHeader } from '@/components/ui/PageHeader'
import { SalesDashboard } from '@/components/sales/SalesDashboard'

/**
 * The team dashboard, on its own tab. A team leader tracks their executives; a
 * sales manager tracks their team leaders AND executives. Every visit drills
 * into its own detail page. Executives never see this (backend-gated too).
 */
export default function SalesDashboardPage() {
  const role = useAuthStore((s) => s.user?.role)
  const allowed = canAssignSalesBuildings(role) // ADMIN / SALES_MANAGER / TEAM_LEADER

  return (
    <main className="mx-auto max-w-5xl">
      <PageHeader eyebrow="Field sales" title="Dashboard" sub="Your team's field activity and performance" />
      {allowed ? (
        <SalesDashboard />
      ) : (
        <p className="text-sm font-normal text-muted">This dashboard is for managers and team leaders.</p>
      )}
    </main>
  )
}
