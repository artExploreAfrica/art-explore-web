import { ApprovalStatus } from '@prisma/client';
import { z } from 'zod';

/** Whole stars only, 1–5 — the scale the frontend renders and filters on. */
const ratingSchema = z.coerce
  .number()
  .int('rating must be a whole number of stars')
  .min(1, 'rating must be between 1 and 5')
  .max(5, 'rating must be between 1 and 5');

/**
 * A contributor's review. Moderation state is never taken from the request —
 * the service forces PENDING, exactly like institution and exhibition submissions.
 */
export const createReviewSchema = z.object({
  rating: ratingSchema,
  comment: z.string().trim().max(2000, 'comment must be 2000 characters or fewer').optional(),
});

/** Edit own review: at least one field, and editing re-opens moderation. */
export const updateReviewSchema = z
  .object({
    rating: ratingSchema.optional(),
    comment: z
      .string()
      .trim()
      .max(2000, 'comment must be 2000 characters or fewer')
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update',
  });

/** Public list of approved reviews for one venue. */
export const listReviewsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

/** Admin moderation queue. */
export const listReviewSubmissionsQuerySchema = listReviewsQuerySchema.extend({
  status: z.nativeEnum(ApprovalStatus).optional().default(ApprovalStatus.PENDING),
});

export const reviewIdParamSchema = z.object({
  id: z.string().min(1),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;
export type ListReviewsQuery = z.infer<typeof listReviewsQuerySchema>;
export type ListReviewSubmissionsQuery = z.infer<typeof listReviewSubmissionsQuerySchema>;
