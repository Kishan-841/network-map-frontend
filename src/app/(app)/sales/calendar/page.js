'use client'

import { useAuthStore } from '@/stores/auth-store'
import { receivesVisitTasks } from '@/lib/roles'
import { PageHeader } from '@/components/ui/PageHeader'
import { PlanCalendar } from '@/components/sales/plan/PlanCalendar'

/** Your own visit plan — Month / Week / Day, with Check in on today's tasks. */
export default function CalendarPage() {
  const role = useAuthStore((s) => s.user?.role)
  if (!receivesVisitTasks(role)) {
    return <PageHeader title="Calendar" sub="Only sales executives and team leaders are given visits to make." />
  }
  return (
    <main className="mx-auto max-w-5xl">
      <PageHeader title="Calendar" sub="The buildings planned for you, day by day" />
      <PlanCalendar canCheckIn />
    </main>
  )
}
