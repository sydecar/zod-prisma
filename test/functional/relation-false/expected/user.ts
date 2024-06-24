import * as z from "zod"

export const userBaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
})

export const userSchema = userBaseSchema

export const userCreateSchema = userSchema.partial({
  id: true,
})

export const userUpdateSchema = userSchema
  .partial()
  
