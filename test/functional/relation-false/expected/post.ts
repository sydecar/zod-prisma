import * as z from "zod"

export const postBaseSchema = z.object({
  id: z.string(),
  title: z.string(),
  contents: z.string(),
  userId: z.string(),
})

export const postSchema = postBaseSchema

export const postCreateSchema = postSchema.partial({
  id: true,
  userId: true,
})

export const postUpdateSchema = postSchema
  .partial()
  
