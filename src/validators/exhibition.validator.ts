import { z } from 'zod';

export const createExhibitionSchema = z.object({
  name: z.string().min(1, 'name is required'),
  images: z.array(z.string().url()).optional().default([]),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  startTime: z.string().min(1, 'startTime is required'),
  endTime: z.string().min(1, 'endTime is required'),
  link: z.string().url().optional(),
  description: z.string().optional(),
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

export const setExhibitionActiveSchema = z.object({
  isActive: z.boolean(),
});

export type CreateExhibitionInput = z.infer<typeof createExhibitionSchema>;
export type UpdateExhibitionInput = z.infer<typeof updateExhibitionSchema>;
export type SetExhibitionActiveInput = z.infer<typeof setExhibitionActiveSchema>;
