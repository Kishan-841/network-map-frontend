'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Toast } from '@/components/ui/Toast'
import SocietyForm from '@/components/societies/SocietyForm'

// updateBuildingSchema is .strict() and excludes contact/photos/placeId and the
// permission letter, so an edit sends only the fields it accepts.
function editBody(payload) {
  const { documentUrl, ...permission } = payload.permission ?? {}
  return {
    buildingName: payload.buildingName,
    formattedAddress: payload.formattedAddress,
    latitude: payload.latitude,
    longitude: payload.longitude,
    zoneId: payload.zoneId,
    details: payload.details,
    permission,
  }
}

function AddSociety() {
  const router = useRouter()
  const params = useSearchParams()
  const editId = params.get('edit')
  const [initial, setInitial] = useState(editId ? null : {})
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!editId) return
    apiClient
      .get(`/buildings/${editId}`)
      .then((res) => {
        const b = res.data.data
        setInitial({
          buildingName: b.buildingName ?? '',
          formattedAddress: b.formattedAddress ?? '',
          placeId: b.placeId ?? null,
          latitude: String(b.latitude),
          longitude: String(b.longitude),
          zoneId: b.zoneId ?? '',
          wings: b.details?.wings != null ? String(b.details.wings) : '',
          floors: b.details?.floors != null ? String(b.details.floors) : '',
          homePass: b.details?.homePass != null ? String(b.details.homePass) : '',
          contactName: b.contact?.contactName ?? '',
          contactPhone: b.contact?.contactPhone ?? '',
          designation: b.contact?.designation ?? 'SECRETARY',
          designationOther: b.contact?.designationOther ?? '',
          contactEmail: b.contact?.contactEmail ?? '',
          permissionStatus: b.permission?.permissionStatus ?? '',
          societyOffer: b.permission?.societyOffer ?? '',
          paymentType: b.permission?.paymentType ?? '',
          amountPaid: b.permission?.amountPaid != null ? String(b.permission.amountPaid) : '',
          demoCount: b.permission?.demoCount != null ? String(b.permission.demoCount) : '',
          permissionLetterUrl: b.permission?.documentUrl ?? '',
          entrancePhotoUrl: '',
        })
      })
      .catch((err) => setToast(getApiErrorMessage(err, 'Could not load the society')))
  }, [editId])

  async function onSave(payload) {
    if (editId) await apiClient.patch(`/buildings/${editId}`, editBody(payload))
    else await apiClient.post('/buildings', payload)
    router.push('/societies')
  }

  if (initial === null) return <p className="p-6 text-sm font-normal text-muted">Loading…</p>

  return (
    <main className="mx-auto max-w-2xl">
      <PageHeader eyebrow="Permission" title={editId ? 'Edit society' : 'Add society'} />
      <Toast key={toast} message={toast} onDone={() => setToast(null)} />
      <SocietyForm initial={initial} onSave={onSave} saveLabel={editId ? 'Save changes' : 'Add society'} />
    </main>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<p className="p-6 text-sm font-normal text-muted">Loading…</p>}>
      <AddSociety />
    </Suspense>
  )
}
