import { Area, InstitutionType } from '@prisma/client';
import { z } from 'zod';

/** Reusable opening-hours JSON shape: { "mon": "9am-5pm", ... }. */
const openingHoursSchema = z.record(z.string(), z.string());

export const createInstitutionSchema = z.object({
  name: z.string().min(1, 'name is required'),
  description: z.string().optional(),
  type: z.nativeEnum(InstitutionType),
  address: z.string().min(1, 'address is required'),
  area: z.nativeEnum(Area),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  website: z.string().url().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  openingHours: openingHoursSchema.optional(),
  tags: z.array(z.string()).optional().default([]),
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
  search: z.string().trim().optional(),
});

export const idParamSchema = z.object({
  id: z.string().min(1),
});

export type CreateInstitutionInput = z.infer<typeof createInstitutionSchema>;
export type UpdateInstitutionInput = z.infer<typeof updateInstitutionSchema>;
export type ListInstitutionsQuery = z.infer<typeof listInstitutionsQuerySchema>;
