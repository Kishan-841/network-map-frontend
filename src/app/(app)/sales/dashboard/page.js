'use client'

import { useAuthStore } from '@/stores/auth-store'
import { canAssignSalesBuildings, isSalesExecutive } from '@/lib/roles'
import { PageHeader } from '@/components/ui/PageHeader'
import { SalesDashboard } from '@/components/sales/SalesDashboard'
import { MyPerformance } from '@/components/sales/MyPerformance'

/**
 * The Field-sales dashboard tab, by role:
 *  - manager / team leader / admin: the team dashboard — a team leader tracks
 *    their executives, a manager tracks leaders AND executives; every visit
 *    drills into its own detail page.
 *  - sales executive: their OWN performance (visits, activities, inquiries),
 *    computed from their scoped visits — no team data.
 */
export default function SalesDashboardPage() {
  const role = useAuthStore((s) => s.user?.role)
  const isTeamView = canAssignSalesBuildings(role) // ADMIN / SALES_MANAGER / TEAM_LEADER
  const isMine = isSalesExecutive(role)

  return (
    <main className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Field sales"
        title={isMine ? 'My work' : 'Dashboard'}
        sub={isMine ? 'Your visits, activities and inquiries' : "Your team's field activity and performance"}
      />
      {isTeamView ? (
        <SalesDashboard />
      ) : isMine ? (
        <MyPerformance />
      ) : (
        <p className="text-sm font-normal text-muted">This dashboard is for the field-sales team.</p>
      )}
    </main>
  )
}
