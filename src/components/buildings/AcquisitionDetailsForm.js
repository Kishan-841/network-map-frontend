'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { IconCamera } from '@/components/ui/icons'
import { useBuildingTypes } from '@/hooks/useBuildingTypes'
import { useAuthStore } from '@/stores/auth-store'
import { acquisitionDetailsSchema } from '@/schemas/building'
import { DESIGNATIONS } from '@/lib/roles'

function SectionLabel({ children }) {
  return <p className="mt-2 text-xs font-medium uppercase tracking-wide text-faint">{children}</p>
}

/** Camera-first single-photo field (agents shoot these on site). */
function PhotoField({ id, label, required, onChange }) {
  const [name, setName] = useState(null)
  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer items-center gap-3 rounded-btn border px-4 py-3 transition-colors ${
        name ? 'border-fiber bg-fiber-tint/40' : 'border-line bg-card hover:border-fiber/50'
      }`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-fiber-tint text-fiber">
        <IconCamera className="h-5 w-5" strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">
          {label}
          {required && <span className="text-bad"> *</span>}
        </span>
        <span className="block truncate text-xs font-normal text-muted">
          {name ?? 'Tap to capture'}
        </span>
      </span>
      <input
        id={id}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null
          setName(file?.name ?? null)
          onChange(file)
        }}
      />
    </label>
  )
}

/**
 * Acquisition capture form: pincode (from the agent's assignment), the
 * contact person they met, and the two mandatory proof photos.
 */
export function AcquisitionDetailsForm({ onSubmit, submitting, serverError }) {
  const { types: buildingTypes } = useBuildingTypes()
  const pincodes = useAuthStore((s) => s.user?.pincodes ?? [])
  const [files, setFiles] = useState({ selfie: null, contactPhoto: null, entrancePhoto: null })
  const [photoError, setPhotoError] = useState(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(acquisitionDetailsSchema),
    defaultValues: { pincode: pincodes.length === 1 ? pincodes[0].pincode : '' },
  })
  const designation = watch('designation')

  function submit(values) {
    // Both proof photos are required by the API too — fail fast here.
    if (!files.selfie || !files.contactPhoto) {
      setPhotoError('Your selfie and a photo of the contact person are both required')
      return
    }
    setPhotoError(null)
    onSubmit(values, files)
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
      <SectionLabel>Location</SectionLabel>
      {pincodes.length === 0 ? (
        <p className="rounded-btn bg-warn-tint px-4 py-3 text-sm font-normal text-warn">
          No pincodes assigned to you yet — contact your team lead.
        </p>
      ) : (
        <Select id="pincode" label="Pincode" error={errors.pincode?.message} {...register('pincode')}>
          <option value="">Select pincode…</option>
          {pincodes.map((p) => (
            <option key={p.pincode} value={p.pincode}>
              {p.pincode}
              {p.city?.name ? ` · ${p.city.name}` : ''}
            </option>
          ))}
        </Select>
      )}

      <SectionLabel>Contact person</SectionLabel>
      <Input
        id="contactName"
        label="Name"
        placeholder="Who did you meet?"
        error={errors.contactName?.message}
        {...register('contactName')}
      />
      <Input
        id="contactPhone"
        label="Phone"
        inputMode="tel"
        placeholder="10-digit mobile"
        error={errors.contactPhone?.message}
        {...register('contactPhone')}
      />
      <Select
        id="designation"
        label="Designation"
        error={errors.designation?.message}
        {...register('designation')}
      >
        <option value="">Select designation…</option>
        {DESIGNATIONS.map((d) => (
          <option key={d.value} value={d.value}>
            {d.label}
          </option>
        ))}
      </Select>
      {designation === 'OTHER' && (
        <Input
          id="designationOther"
          label="Designation (other)"
          placeholder="e.g. Society architect"
          error={errors.designationOther?.message}
          {...register('designationOther')}
        />
      )}
      <Input
        id="contactEmail"
        label="Email (optional)"
        inputMode="email"
        error={errors.contactEmail?.message}
        {...register('contactEmail')}
      />

      <SectionLabel>Proof photos</SectionLabel>
      <PhotoField
        id="selfie"
        label="Your selfie at the building"
        required
        onChange={(f) => setFiles((s) => ({ ...s, selfie: f }))}
      />
      <PhotoField
        id="contactPhoto"
        label="Photo of the contact person"
        required
        onChange={(f) => setFiles((s) => ({ ...s, contactPhoto: f }))}
      />
      <PhotoField
        id="entrancePhoto"
        label="Building entrance (optional)"
        onChange={(f) => setFiles((s) => ({ ...s, entrancePhoto: f }))}
      />
      {photoError && (
        <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{photoError}</p>
      )}

      <SectionLabel>Building (optional — can be filled later)</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <Input id="wings" label="Wings" inputMode="numeric" error={errors.wings?.message} {...register('wings')} />
        <Input id="floors" label="Floors" inputMode="numeric" error={errors.floors?.message} {...register('floors')} />
      </div>
      <Input
        id="homePass"
        label="Home pass"
        inputMode="numeric"
        error={errors.homePass?.message}
        {...register('homePass')}
      />
      <Select id="buildingType" label="Building type" {...register('buildingType')}>
        <option value="">Select type…</option>
        {buildingTypes.map((t) => (
          <option key={t.id} value={t.name}>
            {t.name}
          </option>
        ))}
      </Select>
      <Textarea id="remarks" label="Remarks" rows={2} {...register('remarks')} />

      {serverError && (
        <p className="rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{serverError}</p>
      )}
      <Button type="submit" fullWidth loading={submitting} disabled={pincodes.length === 0}>
        Save building
      </Button>
    </form>
  )
}
