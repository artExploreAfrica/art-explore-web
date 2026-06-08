import { z } from 'zod';

export const createExhibitionSchema = z.object({
  title: z.string().min(1, 'title is required'),
  date: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  time: z.string().optional(),
  socialLink: z.string().url().optional(),
});

/** Update: all fields optional, but at least one must be present. */
export const updateExhibitionSchema = createExhibitionSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update',
  });

/** Path params for nested exhibition routes. */
export const exhibitionParamsSchema = z.object({
  id: z.string().min(1),
  exhibitionId: z.string().min(1),
});

export type CreateExhibitionInput = z.infer<typeof createExhibitionSchema>;
export type UpdateExhibitionInput = z.infer<typeof updateExhibitionSchema>;
