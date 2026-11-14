import { ApprovalStatus, Area, InstitutionSubType, InstitutionType } from '@prisma/client';
import { z } from 'zod';
import { institutionFieldsSchema, openingHoursSchema } from './institution.validator';

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
 * A signed-out visitor adding a new space from the home page ("Add a New
 * Space"). Captures everything a full catalogue entry holds, so a reviewer can
 * approve it without chasing details. What stays admin-only: tags,
 * sub-category and publish state (editorial calls), and images — the visitor
 * gives `photoLinks` instead, which go into the internal `notes` for the
 * reviewer, so nothing is uploaded anonymously.
 *
 * Coordinates are optional (most people don't know them) but come as a pair;
 * without them the reviewer pins the venue from the address or `mapUrl`.
 *
 * The visitor's own name and email never become venue fields — they are
 * written into `notes` so a reviewer can follow up.
 *
 * `company` is a honeypot: the form hides it from people, so anything in
 * it means a bot filled the form. The controller drops those silently.
 */
export const publicSubmissionSchema = z
  .object({
    name: z.string().trim().min(1, 'name is required').max(200),
    type: z.nativeEnum(InstitutionType),
    subType: z.nativeEnum(InstitutionSubType).optional(),
    area: z.nativeEnum(Area),
    address: z.string().trim().min(1, 'address is required').max(300),
    subArea: z.string().trim().max(100).optional(),
    mapUrl: z.string().trim().url('mapUrl must be a valid URL').max(500).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    website: z.string().trim().url('website must be a valid URL').max(300).optional(),
    instagram: z.string().trim().max(100).optional(),
    phone: z.string().trim().max(50).optional(),
    email: z.string().trim().email('email must be a valid email').max(200).optional(),
    openingHours: openingHoursSchema.optional(),
    hasResidency: z.boolean().optional(),
    description: z.string().trim().max(2000).optional(),
    photoLinks: z
      .array(z.string().trim().url('each photo link must be a valid URL').max(500))
      .max(5, 'at most 5 photo links')
      .optional(),
    submitterName: z.string().trim().max(100).optional(),
    submitterEmail: z.string().trim().email('submitterEmail must be a valid email').max(200).optional(),
    company: z.string().optional(),
  })
  .refine((d) => (d.lat === undefined) === (d.lng === undefined), {
    path: ['lng'],
    message: 'lat and lng must be given together',
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
export type PublicSubmissionInput = z.infer<typeof publicSubmissionSchema>;
export type UpdateSubmissionInput = z.infer<typeof updateSubmissionSchema>;
export type ListSubmissionsQuery = z.infer<typeof listSubmissionsQuerySchema>;
export type MySubmissionsQuery = z.infer<typeof mySubmissionsQuerySchema>;
export type RejectInput = z.infer<typeof rejectSchema>;
