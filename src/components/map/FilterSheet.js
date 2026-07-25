'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useZones } from '@/hooks/useZones'
import { useAuthStore } from '@/stores/auth-store'
import { apiClient } from '@/lib/api-client'

const selectClass =
  'min-h-12 w-full rounded-xl border border-line bg-card px-4 text-base outline-none focus:ring-2 focus:ring-fiber/30'

export function FilterSheet({ open, filters, onApply, onClose }) {
  const { zones } = useZones()
  const role = useAuthStore((s) => s.user?.role)
  const [surveyors, setSurveyors] = useState([])
  const [local, setLocal] = useState(filters)
  const canFilterSurveyor = role === 'ADMIN' || role === 'MANAGER'

  useEffect(() => setLocal(filters), [filters, open])

  useEffect(() => {
    if (canFilterSurveyor) {
      apiClient.get('/users').then((res) => setSurveyors(res.data.data))
    }
  }, [canFilterSurveyor])

  if (!open) return null

  const set = (key) => (e) => setLocal({ ...local, [key]: e.target.value })

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/50 lg:items-center lg:justify-center" onClick={onClose}>
      <div
        className="max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl bg-card p-6 pb-10 lg:max-w-md lg:rounded-2xl lg:pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line lg:hidden" />
        <h2 className="mb-4 text-lg font-semibold tracking-tight">Filters</h2>

        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted">Zone</label>
            <select className={selectClass} value={local.zoneId ?? ''} onChange={set('zoneId')}>
              <option value="">All zones</option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>{zone.name}</option>
              ))}
            </select>
          </div>

          {canFilterSurveyor && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted">Surveyor</label>
              <select
                className={selectClass}
                value={local.createdById ?? ''}
                onChange={set('createdById')}
              >
                <option value="">All surveyors</option>
                {surveyors.map((surveyor) => (
                  <option key={surveyor.id} value={surveyor.id}>{surveyor.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input id="dateFrom" label="From" type="date" value={local.dateFrom ?? ''} onChange={set('dateFrom')} />
            <Input id="dateTo" label="To" type="date" value={local.dateTo ?? ''} onChange={set('dateTo')} />
          </div>

          <div className="mt-2 flex gap-3">
            <Button variant="secondary" fullWidth onClick={() => { onApply({}); onClose() }}>
              Clear
            </Button>
            <Button fullWidth onClick={() => { onApply(local); onClose() }}>
              Apply
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
