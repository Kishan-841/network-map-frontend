'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { PageHeader } from '@/components/ui/PageHeader'
import SocietyForm from '@/components/societies/SocietyForm'
import { buildSocietyEditBody, photosToForm } from '@/lib/society'

/** The society as the flat form state, plus the photos the form does not show. */
function toForm(b) {
  const { entrancePhotoUrl, permissionLetterUrl, otherPhotos } = photosToForm(b.photos)
  return {
    form: {
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
      permissionLetterUrl,
      entrancePhotoUrl,
      // A new remark for every edit — never the last one prefilled.
      remark: '',
    },
    otherPhotos,
  }
}

function AddSociety() {
  const router = useRouter()
  const params = useSearchParams()
  const editId = params.get('edit')
  // { id, form, otherPhotos } or { id, error }; a fresh add needs no load.
  const [loaded, setLoaded] = useState(null)

  useEffect(() => {
    if (!editId) return undefined
    let alive = true
    // The society endpoint: same scope as the list (another executive's → 404)
    // and every photo, so the edit can send the full set back.
    apiClient
      .get(`/permission-buildings/${editId}`)
      .then((res) => alive && setLoaded({ id: editId, ...toForm(res.data.data) }))
      .catch(
        (err) =>
          alive &&
          setLoaded({
            id: editId,
            error:
              err.response?.status === 404
                ? 'Society not found — it does not exist, or it is not one of yours.'
                : getApiErrorMessage(err, 'Could not load the society'),
          }),
      )
    return () => {
      alive = false
    }
  }, [editId])

  const current = editId ? (loaded?.id === editId ? loaded : null) : { form: {}, otherPhotos: [] }

  async function onSave(payload) {
    try {
      if (editId) {
        // Photos go through this PATCH (the full set) so the change is logged
        // with the remark — never through the per-photo routes.
        await apiClient.patch(`/buildings/${editId}`, buildSocietyEditBody(payload, { otherPhotos: current.otherPhotos }))
        router.push(`/societies/${editId}`)
      } else {
        const res = await apiClient.post('/buildings', payload)
        router.push(`/societies/${res.data.data.id}`)
      }
    } catch (err) {
      // SocietyForm shows err.message — hand it the API's words, not axios's.
      throw new Error(getApiErrorMessage(err, 'Could not save the society'))
    }
  }

  return (
    <main className="mx-auto max-w-2xl">
      <PageHeader
        title={editId ? 'Edit details' : 'Add building'}
        backHref={editId ? `/societies/${editId}` : '/societies'}
        backLabel={editId ? 'Society' : 'Society permissions'}
      />
      {!current && <p className="text-sm font-normal text-muted">Loading…</p>}
      {current?.error && <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{current.error}</p>}
      {current?.form && (
        <SocietyForm
          key={editId ?? 'new'}
          initial={current.form}
          onSave={onSave}
          saveLabel={editId ? 'Save changes' : 'Add building'}
          remarkLabel={editId ? 'What changed, and why?' : 'What happened on this visit?'}
        />
      )}
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
