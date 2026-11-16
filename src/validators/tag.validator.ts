import { TagCategory } from '@prisma/client';
import { z } from 'zod';

/** What people see, e.g. "Yoruba History". */
const labelSchema = z
  .string()
  .trim()
  .min(1, 'label is required')
  .max(60, 'label must be 60 characters or fewer');

/**
 * The spaces carrying the tag, as a full replacement list: whatever is not in
 * it is unlinked. Ids are checked against the database in the service.
 */
const institutionIdsSchema = z
  .array(z.string().min(1))
  .max(1000, 'too many spaces in one request')
  .transform((ids) => [...new Set(ids)]);

/**
 * The space whose main photo fronts the tag on the home page; null clears it
 * (back to automatic). Must be one of the tag's spaces — checked in the service.
 */
const coverInstitutionIdSchema = z.string().min(1).nullable();

export const createTagSchema = z
  .object({
    label: labelSchema.optional(),
    // The machine slug. The admin no longer types it — it is generated from
    // the label (see tagNameFromLabel). Still accepted so older callers keep
    // working, and normalised either way.
    name: z.string().trim().min(1).max(60).optional(),
    // No longer chosen in the admin (tags aren't grouped any more). Still
    // accepted so older callers keep working; omitted → STYLE (the column is
    // NOT NULL, and dropping it would be a production database change).
    category: z.nativeEnum(TagCategory).optional(),
    institutionIds: institutionIdsSchema.optional(),
    coverInstitutionId: coverInstitutionIdSchema.optional(),
  })
  .refine((data) => data.label !== undefined || data.name !== undefined, {
    path: ['label'],
    message: 'label is required',
  });

export const updateTagSchema = z
  .object({
    label: labelSchema.optional(),
    name: z.string().trim().min(1).max(60).optional(),
    category: z.nativeEnum(TagCategory).optional(),
    institutionIds: institutionIdsSchema.optional(),
    coverInstitutionId: coverInstitutionIdSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update',
  });

export const listTagsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().optional(),
  category: z.nativeEnum(TagCategory).optional(),
});

export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
export type ListTagsQuery = z.infer<typeof listTagsQuerySchema>;
