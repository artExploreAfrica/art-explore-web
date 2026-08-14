import { Area, InstitutionType } from '@prisma/client';
import { z } from 'zod';

/**
 * Which slice of the calendar a public read wants. `live` is the default so
 * exhibition lists agree with `Institution.hasExhibition`, which has always
 * required the run to not have finished.
 */
export const exhibitionScopeSchema = z.enum(['live', 'past', 'all']).optional().default('live');

/** Opening/closing time on a 24-hour clock, e.g. "10:00". */
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be a time in HH:mm format');

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
      data.startDate === undefined || data.endDate === undefined || data.endDate >= data.startDate,
    endNotBeforeStart,
  );

/**
 * A USER proposing an exhibition names the venue it belongs to. Approval state
 * is never taken from the request — the service forces PENDING and inactive.
 *
 * `images` is omitted deliberately: a contributor cannot hand us arbitrary
 * third-party URLs to serve. They upload through
 * POST /submissions/exhibitions/:id/images, which puts the bytes in our bucket.
 */
/**
 * Refuses a client-supplied `images` key instead of dropping it.
 *
 * The key stays in the schema shape on purpose: `.omit()` would strip it before
 * validation ever ran, and the contributor would believe their pictures were
 * attached when nothing was stored. Unknown keys are still stripped elsewhere —
 * a caller trying to self-approve is ignored rather than refused — but silently
 * losing someone's uploads is a different kind of failure.
 */
const noClientImages = z.undefined({
  invalid_type_error: 'images cannot be set directly — upload them to this submission instead',
});

export const submitExhibitionSchema = exhibitionFields
  .omit({ images: true })
  .extend({
    institutionId: z.string().min(1, 'institutionId is required'),
    images: noClientImages,
  })
  .refine((data) => data.endDate >= data.startDate, endNotBeforeStart);

/** Editing an own submission — same fields minus images, at least one present. */
export const updateSubmittedExhibitionSchema = exhibitionFields
  .omit({ images: true })
  .partial()
  .extend({ images: noClientImages })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update',
  })
  .refine(
    (data) =>
      data.startDate === undefined || data.endDate === undefined || data.endDate >= data.startDate,
    endNotBeforeStart,
  );

/** Public per-venue exhibition list. */
export const listExhibitionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  scope: exhibitionScopeSchema,
});

/**
 * Admin per-venue exhibition list. Same paging as the public one, but `scope`
 * defaults to `all` — an admin managing a venue needs to see finished runs and
 * pending/inactive ones too, which is exactly what the public list hides.
 */
export const adminListExhibitionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  scope: z.enum(['live', 'past', 'all']).optional().default('all'),
});

/** Public cross-venue "what's on" list. */
export const listPublicExhibitionsQuerySchema = listExhibitionsQuerySchema.extend({
  area: z.nativeEnum(Area).optional(),
  type: z.nativeEnum(InstitutionType).optional(),
  institutionId: z.string().optional(),
  search: z.string().trim().optional(),
});

/** Path params for nested exhibition routes. */
export const exhibitionParamsSchema = z.object({
  id: z.string().min(1),
  exhibitionId: z.string().min(1),
});

export const setExhibitionActiveSchema = z.object({
  isActive: z.boolean(),
});

export type ExhibitionScope = z.infer<typeof exhibitionScopeSchema>;
export type SubmitExhibitionInput = z.infer<typeof submitExhibitionSchema>;
export type UpdateSubmittedExhibitionInput = z.infer<typeof updateSubmittedExhibitionSchema>;
export type CreateExhibitionInput = z.infer<typeof createExhibitionSchema>;
export type UpdateExhibitionInput = z.infer<typeof updateExhibitionSchema>;
export type SetExhibitionActiveInput = z.infer<typeof setExhibitionActiveSchema>;
export type ListExhibitionsQuery = z.infer<typeof listExhibitionsQuerySchema>;
export type AdminListExhibitionsQuery = z.infer<typeof adminListExhibitionsQuerySchema>;
export type ListPublicExhibitionsQuery = z.infer<typeof listPublicExhibitionsQuerySchema>;