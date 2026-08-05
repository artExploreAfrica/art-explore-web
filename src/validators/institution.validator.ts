import { ApprovalStatus, Area, InstitutionType } from '@prisma/client';
import { z } from 'zod';

/** Time on a 24-hour clock, e.g. "09:30". Zero-padded so it sorts lexically. */
const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be a time in HH:mm format');

/**
 * One day's trading hours, or null when the venue is closed that day.
 * A `close` earlier than `open` is allowed and means the venue trades past
 * midnight (e.g. 20:00 → 02:00); the openNow filter handles the wrap.
 */
const dayHoursSchema = z
  .object({ open: timeSchema, close: timeSchema })
  .strict()
  .nullable();

/**
 * Opening hours keyed by JavaScript day index — "0" = Sunday … "6" = Saturday,
 * matching `Date.prototype.getDay()` so the client can index it directly:
 *
 *   { "0": null, "1": { "open": "10:00", "close": "18:00" }, ... }
 *
 * `.strict()` rejects the old freeform `{ "mon": "9am-5pm" }` shape outright —
 * unparseable hours are what made the "Open Now" filter inert.
 */
export const openingHoursSchema = z
  .object({
    '0': dayHoursSchema.optional(),
    '1': dayHoursSchema.optional(),
    '2': dayHoursSchema.optional(),
    '3': dayHoursSchema.optional(),
    '4': dayHoursSchema.optional(),
    '5': dayHoursSchema.optional(),
    '6': dayHoursSchema.optional(),
  })
  .strict();

/** Query-string boolean (`true`/`false`). */
const booleanQuerySchema = z
  .enum(['true', 'false'])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === 'true'));

/** Ordering for the public/admin catalogue list. */
export const institutionSortSchema = z
  .enum(['newest', 'oldest', 'name', 'rating'])
  .optional()
  .default('newest');

export const createInstitutionSchema = z.object({
  name: z.string().min(1, 'name is required'),
  description: z.string().optional(),
  type: z.nativeEnum(InstitutionType),
  address: z.string().min(1, 'address is required'),
  area: z.nativeEnum(Area),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  website: z.string().url().optional(),
  instagram: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  openingHours: openingHoursSchema.optional(),
  subCategoryId: z.string().optional(),
  tagIds: z.array(z.string()).optional().default([]),
  isPublished: z.boolean().optional().default(false),
});

/** Update: all fields optional, but at least one must be present. */
export const updateInstitutionSchema = createInstitutionSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update',
  });

/** Query params for the public list endpoint. */
export const listInstitutionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  area: z.nativeEnum(Area).optional(),
  type: z.nativeEnum(InstitutionType).optional(),
  subCategoryId: z.string().optional(),
  tag: z.string().optional(),
  search: z.string().trim().optional(),
  // Only venues whose average approved rating is at least this value.
  minRating: z.coerce.number().min(0).max(5).optional(),
  // Only venues currently within their trading hours for the server's day/time.
  openNow: booleanQuerySchema,
  hasExhibition: booleanQuerySchema,
  sort: institutionSortSchema,
});

/** Admin catalogue list — includes drafts / unpublished / pending. */
export const adminListInstitutionsQuerySchema = listInstitutionsQuerySchema.extend({
  isPublished: booleanQuerySchema,
  approvalStatus: z.nativeEnum(ApprovalStatus).optional(),
  // Soft-deleted rows are hidden by default; `deleted=true` shows only those,
  // which is the only way to find a record in order to restore it.
  deleted: booleanQuerySchema,
});

export const idParamSchema = z.object({
  id: z.string().min(1),
});

export const removeImageSchema = z.object({
  url: z.string().url('url must be a valid image URL'),
});

export type CreateInstitutionInput = z.infer<typeof createInstitutionSchema>;
export type UpdateInstitutionInput = z.infer<typeof updateInstitutionSchema>;
export type ListInstitutionsQuery = z.infer<typeof listInstitutionsQuerySchema>;
export type AdminListInstitutionsQuery = z.infer<typeof adminListInstitutionsQuerySchema>;
export type RemoveImageInput = z.infer<typeof removeImageSchema>;
