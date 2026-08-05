import { ApprovalStatus } from '@prisma/client';
import { z } from 'zod';
import { createInstitutionSchema } from './institution.validator';

/**
 * A USER submitting an institution cannot set its publish state — that is an
 * admin decision made after approval. Everything else mirrors the admin create.
 */
export const submitInstitutionSchema = createInstitutionSchema.omit({
  isPublished: true,
});

/**
 * Editing an own submission: same fields, all optional, at least one present.
 * The service forces the row back to PENDING, so nothing here can set state.
 */
export const updateSubmissionSchema = submitInstitutionSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update',
  });

/** Admin filter for the review queue. */
export const listSubmissionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.nativeEnum(ApprovalStatus).optional().default(ApprovalStatus.PENDING),
});

/** A USER listing their own submissions (any status). */
export const mySubmissionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const rejectSchema = z.object({
  reviewNote: z.string().min(1, 'reviewNote is required'),
});

export type SubmitInstitutionInput = z.infer<typeof submitInstitutionSchema>;
export type UpdateSubmissionInput = z.infer<typeof updateSubmissionSchema>;
export type ListSubmissionsQuery = z.infer<typeof listSubmissionsQuerySchema>;
export type MySubmissionsQuery = z.infer<typeof mySubmissionsQuerySchema>;
export type RejectInput = z.infer<typeof rejectSchema>;
