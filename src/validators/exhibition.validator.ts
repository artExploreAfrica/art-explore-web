import { z } from 'zod';

/** Opening/closing time on a 24-hour clock, e.g. "10:00". */
const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be a time in HH:mm format');

const endNotBeforeStart = {
  path: ['endDate'],
  message: 'endDate must be on or after startDate',
};

/** Field shape shared by create/update — kept a plain object so `.partial()` works. */
const exhibitionFields = z.object({
  name: z.string().min(1, 'name is required'),
  images: z.array(z.string().url()).optional().default([]),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  startTime: timeSchema,
  endTime: timeSchema,
  link: z.string().url().optional(),
  description: z.string().optional(),
});

export const createExhibitionSchema = exhibitionFields.refine(
  (data) => data.endDate >= data.startDate,
  endNotBeforeStart,
);

/**
 * Update: all fields optional, but at least one must be present. The date-order
 * check can only run when both dates are supplied — a partial update sending
 * one date is validated against the stored value in exhibition.service.
 */
export const updateExhibitionSchema = exhibitionFields
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update',
  })
  .refine(
    (data) =>
      data.startDate === undefined ||
      data.endDate === undefined ||
      data.endDate >= data.startDate,
    endNotBeforeStart,
  );

/**
 * A USER proposing an exhibition names the venue it belongs to. Approval state
 * is never taken from the request — the service forces PENDING and inactive.
 */
export const submitExhibitionSchema = exhibitionFields
  .extend({ institutionId: z.string().min(1, 'institutionId is required') })
  .refine((data) => data.endDate >= data.startDate, endNotBeforeStart);

/** Path params for nested exhibition routes. */
export const exhibitionParamsSchema = z.object({
  id: z.string().min(1),
  exhibitionId: z.string().min(1),
});

export const setExhibitionActiveSchema = z.object({
  isActive: z.boolean(),
});

export type SubmitExhibitionInput = z.infer<typeof submitExhibitionSchema>;
export type CreateExhibitionInput = z.infer<typeof createExhibitionSchema>;
export type UpdateExhibitionInput = z.infer<typeof updateExhibitionSchema>;
export type SetExhibitionActiveInput = z.infer<typeof setExhibitionActiveSchema>;
