'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { Section } from '@/components/fiber/details/DetailParts'
import { MaterialList } from '@/components/societies/MaterialList'
import { surveyStatusLabel } from '@/lib/society-survey'

/** GET …/survey answers the survey or null (possibly wrapped as { survey }). */
const unwrap = (data) => (data && typeof data === 'object' && 'survey' in data ? data.survey : (data ?? null))

/**
 * The "Materials" block in the Buildings drawer for a society: what the
 * surveyor asked for, and where the request stands. Hidden when there is no
 * survey yet or the viewer may not read it (the API answers 403/404).
 * `survey` may be passed in when the building read already carries it.
 */
export function SocietyMaterials({ buildingId, survey: given }) {
  const [loaded, setLoaded] = useState(null) // { id, survey }

  useEffect(() => {
    if (given !== undefined) return undefined
    let alive = true
    apiClient
      .get(`/permission-buildings/${buildingId}/survey`)
      .then((res) => alive && setLoaded({ id: buildingId, survey: unwrap(res.data.data) }))
      .catch(() => alive && setLoaded({ id: buildingId, survey: null }))
    return () => {
      alive = false
    }
  }, [buildingId, given])

  const survey = given !== undefined ? given : loaded?.id === buildingId ? loaded.survey : null
  if (!survey?.status) return null
  return (
    <Section title="Materials">
      <p className="text-xs font-medium text-muted">Request: {surveyStatusLabel(survey.status)}</p>
      <MaterialList materials={survey.materials} compact />
    </Section>
  )
}
