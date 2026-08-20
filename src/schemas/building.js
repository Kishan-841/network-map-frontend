import { z } from 'zod'

const optionalPositiveInt = z
  .union([z.literal(''), z.coerce.number().int().positive()])
  .transform((v) => (v === '' ? undefined : v))
  .optional()

const optionalNonNegative = z
  .union([z.literal(''), z.coerce.number().nonnegative()])
  .transform((v) => (v === '' ? undefined : v))
  .optional()

/** Acquisition agents log a pincode + contact person instead of a zone. */
export const acquisitionDetailsSchema = z.object({
  pincode: z.string().min(1, 'Select your pincode'),
  contactName: z.string().trim().min(1, 'Contact name is required').max(120),
  contactPhone: z
    .string()
    .trim()
    .min(6, 'Enter a valid phone number')
    .max(20),
  contactEmail: z.union([z.string().trim().email('Enter a valid email'), z.literal('')]).optional(),
  designation: z.string().min(1, 'Select a designation'),
  designationOther: z.string().trim().max(100).optional(),
  wings: optionalPositiveInt,
  floors: optionalPositiveInt,
  homePass: optionalNonNegative,
  buildingType: z.string().optional(),
  remarks: z.string().max(1000).optional(),
}).refine((v) => v.designation !== 'OTHER' || Boolean(v.designationOther?.trim()), {
  message: 'Describe the designation',
  path: ['designationOther'],
})

export const buildingDetailsSchema = z.object({
  zoneId: z.string().min(1, 'Select a zone'),
  wings: optionalPositiveInt,
  floors: optionalPositiveInt,
  homePass: optionalNonNegative,
  buildingType: z.string().optional(),
  remarks: z.string().max(1000).optional(),
  amountPaid: optionalNonNegative,
})
