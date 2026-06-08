import { InstitutionType } from '@prisma/client';
import { z } from 'zod';

export const createSubCategorySchema = z.object({
  name: z.string().min(1, 'name is required'),
  type: z.nativeEnum(InstitutionType),
  description: z.string().optional(),
});

/** Update: all fields optional, but at least one must be present. */
export const updateSubCategorySchema = createSubCategorySchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update',
  });

/** Query params for the list endpoints. */
export const listSubCategoriesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  type: z.nativeEnum(InstitutionType).optional(),
});

export type CreateSubCategoryInput = z.infer<typeof createSubCategorySchema>;
export type UpdateSubCategoryInput = z.infer<typeof updateSubCategorySchema>;
export type ListSubCategoriesQuery = z.infer<typeof listSubCategoriesQuerySchema>;
