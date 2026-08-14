import { ApprovalStatus } from '@prisma/client';
import { z } from 'zod';
import { institutionFieldsSchema } from './institution.validator';

/**
 * A USER submitting an institution cannot set its publish state — that is an
 * admin decision made after approval. Everything else mirrors the admin create.
 *
 * Derived from the lenient base rather than the strict admin
 * `createInstitutionSchema`: a contributor sending `approvalStatus` should have
 * it ignored, not be refused.
 */
export const submitInstitutionSchema = institutionFieldsSchema.omit({
  isPublished: true,
});

/**
 * Fixing and resubmitting a REJECTED submission: same fields, all optional,
 * at least one present. Only usable while REJECTED — a still-PENDING
 * submission is locked until reviewed, and an APPROVED one is frozen for
 * good. The service enforces which status is editable; this just shapes the body.
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
