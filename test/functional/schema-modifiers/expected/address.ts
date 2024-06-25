import * as z from "zod"
import { addressTypeSchema } from "./addresstype"

export const addressBaseSchema = z.object({
  id: z.string(),
  type: addressTypeSchema,
  company: z.string().min(1).max(50).nullable(),
  address: z.string().min(1).max(50),
  zipCode: z.string().min(1).max(10),
  city: z.string().min(1).max(50),
})

export const addressSchema = addressBaseSchema

export const addressCreateSchema = addressSchema
  .extend({
    company: addressSchema.shape.company.unwrap(),
  }).partial({
    id: true,
    company: true,
  })

export const addressUpdateSchema = addressSchema
  .extend({
    company: addressSchema.shape.company.unwrap(),
  })
  .partial()
  
