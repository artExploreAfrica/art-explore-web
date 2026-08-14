import {
  ApprovalStatus,
  AuditAction,
  Prisma,
  Review,
  TargetModel,
} from '@prisma/client';
import prisma from '../config/db';
import { ConflictError, NotFoundError } from '../utils/AppError';
import { auditLog } from '../utils/auditLogger';
import { invalidateInstitutionCache } from '../utils/institutionCache';
import {
  sendSubmissionApprovedEmail,
  sendSubmissionRejectedEmail,
} from '../utils/mailer';
import { PaginationMeta } from '../utils/response';
import {
  CreateReviewInput,
  ListReviewSubmissionsQuery,
  ListReviewsQuery,
  UpdateReviewInput,
} from '../validators/review.validator';

interface ReviewListResult {
  data: Review[];
  pagination: PaginationMeta;
}

const paginate = (page: number, limit: number, total: number): PaginationMeta => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit) || 0,
});

/** Author fields safe to expose alongside a public review. */
const AUTHOR_SELECT = { id: true, fullName: true } as const;

/**
 * Recompute Institution.rating and reviewCount from APPROVED reviews only.
 * Denormalised so the public list can filter by `minRating` and sort by rating
 * with an index, instead of aggregating the Review table on every request.
 * `rating` returns to null when the last approved review goes away, which keeps
 * "no reviews yet" distinguishable from a genuine average of 0.
 */
export const recomputeInstitutionRating = async (institutionId: string): Promise<void> => {
  const agg = await prisma.review.aggregate({
    where: { institutionId, approvalStatus: ApprovalStatus.APPROVED },
    _avg: { rating: true },
    _count: { _all: true },
  });

  const count = agg._count._all;
  await prisma.institution.update({
    where: { id: institutionId },
    data: {
      // Store one decimal place — enough for a star display, and it keeps the
      // value stable rather than drifting through float noise on each write.
      rating: count > 0 && agg._avg.rating !== null
        ? Math.round(agg._avg.rating * 10) / 10
        : null,
      reviewCount: count,
    },
  });
};

/** The venue must be publicly visible before anyone can review it. */
const ensurePublicInstitution = async (institutionId: string): Promise<void> => {
  const institution = await prisma.institution.findFirst({
    where: {
      id: institutionId,
      isPublished: true,
      deletedAt: null,
      approvalStatus: ApprovalStatus.APPROVED,
    },
    select: { id: true },
  });
  if (!institution) throw NotFoundError('Institution');
};

/** Fetch a review the given user owns, or fail. */
const ensureOwnReview = async (userId: string, id: string): Promise<Review> => {
  const review = await prisma.review.findUnique({ where: { id } });
  // A review belonging to someone else is reported as missing rather than
  // forbidden — otherwise the 403/404 split confirms that an id exists.
  if (!review || review.userId !== userId) throw NotFoundError('Review');
  return review;
};

// ---------------------------------------------------------------------------
// Public reads
// ---------------------------------------------------------------------------

/** Approved reviews for a published venue, newest first. */
export const listForInstitution = async (
  institutionId: string,
  query: ListReviewsQuery,
): Promise<ReviewListResult> => {
  await ensurePublicInstitution(institutionId);

  const { page, limit } = query;
  const where: Prisma.ReviewWhereInput = {
    institutionId,
    approvalStatus: ApprovalStatus.APPROVED,
  };

  const [data, total] = await Promise.all([
    prisma.review.findMany({
      where,
      include: { user: { select: AUTHOR_SELECT } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.review.count({ where }),
  ]);

  return { data, pagination: paginate(page, limit, total) };
};

// ---------------------------------------------------------------------------
// Contributor writes
// ---------------------------------------------------------------------------

/**
 * A USER reviews a venue. Created PENDING — it neither appears publicly nor
 * moves the venue's average until an admin approves it. One per venue per user;
 * a second attempt is a conflict, not a duplicate row.
 */
export const create = async (
  userId: string,
  institutionId: string,
  input: CreateReviewInput,
): Promise<Review> => {
  await ensurePublicInstitution(institutionId);

  let review: Review;
  try {
    review = await prisma.review.create({
      data: {
        institutionId,
        userId,
        rating: input.rating,
        comment: input.comment,
        approvalStatus: ApprovalStatus.PENDING,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw ConflictError(
        'You have already reviewed this venue — edit your existing review instead',
      );
    }
    throw err;
  }

  await auditLog(userId, AuditAction.REVIEW_CREATE, TargetModel.REVIEW, review.id, {
    institutionId,
    rating: review.rating,
  });
  // Still PENDING, so no approved average changed and nothing public moved.
  return review;
};

/**
 * Edit own review. Any edit re-opens moderation: an approved review returns to
 * PENDING so a vetted 5-star comment cannot be quietly rewritten after the fact.
 * The average is recomputed because the row leaves the approved set.
 */
export const update = async (
  userId: string,
  id: string,
  input: UpdateReviewInput,
): Promise<Review> => {
  const current = await ensureOwnReview(userId, id);

  const review = await prisma.review.update({
    where: { id },
    data: {
      ...input,
      approvalStatus: ApprovalStatus.PENDING,
      reviewedById: null,
      reviewedAt: null,
      reviewNote: null,
    },
  });

  await recomputeInstitutionRating(current.institutionId);
  await auditLog(userId, AuditAction.REVIEW_UPDATE, TargetModel.REVIEW, id, {
    institutionId: current.institutionId,
    fields: Object.keys(input),
  });
  await invalidateInstitutionCache();
  return review;
};

/** Delete own review and drop it out of the venue's average. */
export const remove = async (userId: string, id: string): Promise<Review> => {
  const current = await ensureOwnReview(userId, id);

  const review = await prisma.review.delete({ where: { id } });

  await recomputeInstitutionRating(current.institutionId);
  await auditLog(userId, AuditAction.REVIEW_DELETE, TargetModel.REVIEW, id, {
    institutionId: current.institutionId,
  });
  await invalidateInstitutionCache();
  return review;
};

/** A USER's own reviews, any moderation status. */
export const listMine = async (
  userId: string,
  query: ListReviewsQuery,
): Promise<ReviewListResult> => {
  const { page, limit } = query;
  const where: Prisma.ReviewWhereInput = { userId };

  const [data, total] = await Promise.all([
    prisma.review.findMany({
      where,
      include: { institution: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.review.count({ where }),
  ]);

  return { data, pagination: paginate(page, limit, total) };
};

// ---------------------------------------------------------------------------
// Admin moderation
// ---------------------------------------------------------------------------

/** Moderation queue, filtered by status. */
export const listSubmissions = async (
  query: ListReviewSubmissionsQuery,
): Promise<ReviewListResult> => {
  const { page, limit, status } = query;
  const where: Prisma.ReviewWhereInput = { approvalStatus: status };

  const [data, total] = await Promise.all([
    prisma.review.findMany({
      where,
      include: {
        institution: { select: { id: true, name: true } },
        user: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.review.count({ where }),
  ]);

  return { data, pagination: paginate(page, limit, total) };
};

/** Fetch a review with its author, for approve/reject. */
const ensureForModeration = async (id: string) => {
  const review = await prisma.review.findUnique({
    where: { id },
    include: {
      user: { select: { email: true, fullName: true } },
      institution: { select: { name: true } },
    },
  });
  if (!review) throw NotFoundError('Review');
  return review;
};

/** Approve a review — it becomes public and joins the venue's average. */
export const approve = async (actorId: string, id: string): Promise<Review> => {
  const current = await ensureForModeration(id);

  const review = await prisma.review.update({
    where: { id },
    data: {
      approvalStatus: ApprovalStatus.APPROVED,
      reviewedById: actorId,
      reviewedAt: new Date(),
      reviewNote: null,
    },
  });

  await recomputeInstitutionRating(current.institutionId);
  await auditLog(actorId, AuditAction.APPROVE_REVIEW, TargetModel.REVIEW, id, {
    institutionId: current.institutionId,
  });

  void sendSubmissionApprovedEmail(
    current.user.email,
    current.user.fullName,
    `your review of ${current.institution.name}`,
  );

  await invalidateInstitutionCache();
  return review;
};

/** Reject a review with a required moderator note. */
export const reject = async (
  actorId: string,
  id: string,
  reviewNote: string,
): Promise<Review> => {
  const current = await ensureForModeration(id);

  const review = await prisma.review.update({
    where: { id },
    data: {
      approvalStatus: ApprovalStatus.REJECTED,
      reviewedById: actorId,
      reviewedAt: new Date(),
      reviewNote,
    },
  });

  await recomputeInstitutionRating(current.institutionId);
  await auditLog(actorId, AuditAction.REJECT_REVIEW, TargetModel.REVIEW, id, {
    institutionId: current.institutionId,
    reviewNote,
  });

  void sendSubmissionRejectedEmail(
    current.user.email,
    current.user.fullName,
    `your review of ${current.institution.name}`,
    reviewNote,
  );

  await invalidateInstitutionCache();
  return review;
};

/** Admin hard-delete of any review (spam removal). */
export const removeAsAdmin = async (actorId: string, id: string): Promise<Review> => {
  const existing = await prisma.review.findUnique({ where: { id } });
  if (!existing) throw NotFoundError('Review');

  const review = await prisma.review.delete({ where: { id } });

  await recomputeInstitutionRating(existing.institutionId);
  await auditLog(actorId, AuditAction.REVIEW_DELETE, TargetModel.REVIEW, id, {
    institutionId: existing.institutionId,
    byAdmin: true,
  });
  await invalidateInstitutionCache();
  return review;
};
