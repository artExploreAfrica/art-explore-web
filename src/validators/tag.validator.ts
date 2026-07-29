import { TagCategory } from '@prisma/client';
import { z } from 'zod';

export const createTagSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  label: z.string().trim().min(1).optional(),
  category: z.nativeEnum(TagCategory),
});

export const updateTagSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    label: z.string().trim().min(1).optional(),
    category: z.nativeEnum(TagCategory).optional(),
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
