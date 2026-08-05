import {
  ApprovalStatus,
  AuditAction,
  Exhibition,
  Prisma,
  TargetModel,
} from '@prisma/client';
import prisma from '../config/db';
import { AppError, NotFoundError } from '../utils/AppError';
import { auditLog } from '../utils/auditLogger';
import {
  exhibitionListCacheKey,
  getCached,
  invalidateInstitutionCache,
  setCached,
} from '../utils/institutionCache';
import {
  sendSubmissionApprovedEmail,
  sendSubmissionRejectedEmail,
} from '../utils/mailer';
import { PaginationMeta } from '../utils/response';
import { deleteS3ObjectByUrl } from '../utils/s3Uploader';
import {
  CreateExhibitionInput,
  ExhibitionScope,
  ListExhibitionsQuery,
  ListPublicExhibitionsQuery,
  SubmitExhibitionInput,
  UpdateExhibitionInput,
  UpdateSubmittedExhibitionInput,
} from '../validators/exhibition.validator';
import {
  ListSubmissionsQuery,
  MySubmissionsQuery,
} from '../validators/submission.validator';

/** Admin-facing fetch of the parent institution (excludes soft-deleted). */
const ensureInstitution = async (institutionId: string): Promise<void> => {
  const institution = await prisma.institution.findFirst({
    where: { id: institutionId, deletedAt: null },
    select: { id: true },
  });
  if (!institution) throw NotFoundError('Institution');
};

const ensureExhibition = async (
  institutionId: string,
  exhibitionId: string,
): Promise<Exhibition> => {
  const exhibition = await prisma.exhibition.findFirst({
    where: { id: exhibitionId, institutionId },
  });
  if (!exhibition) throw NotFoundError('Exhibition');
  return exhibition;
};

/** Midnight today — an exhibition whose last day is today is still running. */
const startOfToday = (): Date => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

/** An exhibition the public should currently see: approved, active, not finished. */
export const liveExhibitionWhere = (): Prisma.ExhibitionWhereInput => ({
  approvalStatus: ApprovalStatus.APPROVED,
  isActive: true,
  endDate: { gte: startOfToday() },
});

/**
 * Recompute Institution.hasExhibition: true when the institution has at least
 * one approved, active exhibition that has not finished yet.
 *
 * Called after every write, but the date half goes stale on its own with no
 * write to trigger a refresh — scripts/recompute-has-exhibition.ts sweeps every
 * institution on a schedule to catch exhibitions that simply ended.
 */
export const recomputeHasExhibition = async (institutionId: string): Promise<void> => {
  const liveCount = await prisma.exhibition.count({
    where: { institutionId, ...liveExhibitionWhere() },
  });
  await prisma.institution.update({
    where: { id: institutionId },
    data: { hasExhibition: liveCount > 0 },
  });
};

interface ExhibitionListResult {
  data: Exhibition[];
  pagination: PaginationMeta;
}

const paginate = (page: number, limit: number, total: number): PaginationMeta => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit) || 0,
});

// ---------------------------------------------------------------------------
// Contributor submission & admin approval (mirrors the Institution flow).
// ---------------------------------------------------------------------------

/**
 * A USER proposes an exhibition for a venue. Always lands PENDING and inactive —
 * approval state is never taken from the request. Approving does not make it
 * public; an admin still activates it, matching "approved ≠ published".
 */
export const submit = async (
  userId: string,
  input: SubmitExhibitionInput,
): Promise<Exhibition> => {
  const { institutionId, ...rest } = input;

  // Only venues the submitter can actually see are valid targets.
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

  const exhibition = await prisma.exhibition.create({
    data: {
      ...rest,
      institutionId,
      approvalStatus: ApprovalStatus.PENDING,
      isActive: false,
      submittedById: userId,
    },
  });

  await auditLog(userId, AuditAction.SUBMIT, TargetModel.EXHIBITION, exhibition.id, {
    institutionId,
    name: exhibition.name,
  });
  // Not public yet — no cache invalidation needed.
  return exhibition;
};

/** A USER's own exhibition submissions, any status. */
export const listMine = async (
  userId: string,
  query: MySubmissionsQuery,
): Promise<ExhibitionListResult> => {
  const { page, limit } = query;
  const where: Prisma.ExhibitionWhereInput = { submittedById: userId };

  const [data, total] = await Promise.all([
    prisma.exhibition.findMany({
      where,
      include: { institution: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.exhibition.count({ where }),
  ]);

  return { data, pagination: paginate(page, limit, total) };
};

/**
 * Fetch an exhibition submission the given user owns and may still change.
 * Approved ones are frozen — they are live content the admin now owns.
 */
const ensureEditableSubmission = async (
  userId: string,
  id: string,
): Promise<Exhibition> => {
  const exhibition = await prisma.exhibition.findFirst({
    where: { id, submittedById: userId },
  });
  // Reported as missing rather than forbidden so the response never confirms
  // that someone else's id exists.
  if (!exhibition) throw NotFoundError('Submission');

  if (exhibition.approvalStatus === ApprovalStatus.APPROVED) {
    throw new AppError(
      'This submission has been approved and can no longer be changed — contact an admin',
      409,
    );
  }
  return exhibition;
};

/**
 * A USER edits their own pending or rejected exhibition submission. A rejected
 * one returns to PENDING with the reviewer note cleared so it can be fixed and
 * resubmitted rather than duplicated.
 */
export const updateMine = async (
  userId: string,
  id: string,
  input: UpdateSubmittedExhibitionInput,
): Promise<Exhibition> => {
  const current = await ensureEditableSubmission(userId, id);

  // A partial update supplying only one date is checked against the stored
  // value, so the merged range can never end up inverted.
  const startDate = input.startDate ?? current.startDate;
  const endDate = input.endDate ?? current.endDate;
  if (endDate < startDate) {
    throw new AppError('endDate must be on or after startDate', 400);
  }

  const exhibition = await prisma.exhibition.update({
    where: { id },
    data: {
      ...input,
      approvalStatus: ApprovalStatus.PENDING,
      isActive: false,
      approvedById: null,
      approvedAt: null,
      reviewNote: null,
    },
  });

  await auditLog(userId, AuditAction.EXHIBITION_UPDATE, TargetModel.EXHIBITION, id, {
    institutionId: current.institutionId,
    fields: Object.keys(input),
    bySubmitter: true,
  });
  return exhibition;
};

/**
 * A USER withdraws their own exhibition submission. Exhibitions carry no
 * `deletedAt`, and a never-approved proposal has no public history worth
 * keeping, so this is a hard delete — the audit entry is the record.
 */
export const withdrawMine = async (userId: string, id: string): Promise<Exhibition> => {
  const current = await ensureEditableSubmission(userId, id);

  const exhibition = await prisma.exhibition.delete({ where: { id } });

  await recomputeHasExhibition(current.institutionId);
  await auditLog(userId, AuditAction.WITHDRAW, TargetModel.EXHIBITION, id, {
    institutionId: current.institutionId,
    name: current.name,
  });
  return exhibition;
};

/**
 * Resolve an own editable submission before uploading, so the S3 key can be
 * built from the real institutionId and an unauthorised id never reaches the
 * bucket in the first place.
 */
export const getMineForUpload = async (
  userId: string,
  id: string,
): Promise<Exhibition> => ensureEditableSubmission(userId, id);

/** Attach an uploaded image to the submitter's own pending/rejected submission. */
export const addImageToMine = async (
  userId: string,
  id: string,
  imageUrl: string,
): Promise<Exhibition> => {
  const current = await ensureEditableSubmission(userId, id);

  const exhibition = await prisma.exhibition.update({
    where: { id },
    data: { images: [...current.images, imageUrl] },
  });

  await auditLog(userId, AuditAction.IMAGE_UPLOAD, TargetModel.EXHIBITION, id, {
    institutionId: current.institutionId,
    imageUrl,
    bySubmitter: true,
  });
  return exhibition;
};

/** Remove an image from the submitter's own pending/rejected submission. */
export const removeImageFromMine = async (
  userId: string,
  id: string,
  imageUrl: string,
): Promise<Exhibition> => {
  const current = await ensureEditableSubmission(userId, id);

  if (!current.images.includes(imageUrl)) {
    throw new AppError('Image URL not found on this submission', 404);
  }

  const exhibition = await prisma.exhibition.update({
    where: { id },
    data: { images: current.images.filter((url) => url !== imageUrl) },
  });

  await deleteS3ObjectByUrl(imageUrl);

  await auditLog(userId, AuditAction.EXHIBITION_UPDATE, TargetModel.EXHIBITION, id, {
    institutionId: current.institutionId,
    removedImageUrl: imageUrl,
    bySubmitter: true,
  });
  return exhibition;
};

/** Admin review queue — user-submitted exhibitions only, filtered by status. */
export const listSubmissions = async (
  query: ListSubmissionsQuery,
): Promise<ExhibitionListResult> => {
  const { page, limit, status } = query;
  const where: Prisma.ExhibitionWhereInput = {
    approvalStatus: status,
    submittedById: { not: null },
  };

  const [data, total] = await Promise.all([
    prisma.exhibition.findMany({
      where,
      include: {
        institution: { select: { id: true, name: true } },
        submittedBy: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.exhibition.count({ where }),
  ]);

  return { data, pagination: paginate(page, limit, total) };
};

/** Fetch a submission with its submitter, for approve/reject. */
const ensureForReview = async (id: string) => {
  const exhibition = await prisma.exhibition.findUnique({
    where: { id },
    include: { submittedBy: { select: { email: true, fullName: true } } },
  });
  if (!exhibition) throw NotFoundError('Exhibition');
  return exhibition;
};

/** Approve a submitted exhibition. Does not activate — admin does that separately. */
export const approve = async (actorId: string, id: string): Promise<Exhibition> => {
  const current = await ensureForReview(id);

  const exhibition = await prisma.exhibition.update({
    where: { id },
    data: {
      approvalStatus: ApprovalStatus.APPROVED,
      approvedById: actorId,
      approvedAt: new Date(),
      reviewNote: null,
    },
  });

  await recomputeHasExhibition(current.institutionId);
  await auditLog(actorId, AuditAction.APPROVE_EXHIBITION, TargetModel.EXHIBITION, id, {
    institutionId: current.institutionId,
  });

  if (current.submittedBy) {
    void sendSubmissionApprovedEmail(
      current.submittedBy.email,
      current.submittedBy.fullName,
      current.name,
    );
  }

  await invalidateInstitutionCache();
  return exhibition;
};

/** Reject a submitted exhibition with a required reviewer note. */
export const reject = async (
  actorId: string,
  id: string,
  reviewNote: string,
): Promise<Exhibition> => {
  const current = await ensureForReview(id);

  const exhibition = await prisma.exhibition.update({
    where: { id },
    data: {
      approvalStatus: ApprovalStatus.REJECTED,
      isActive: false,
      reviewNote,
      // approvedById/approvedAt only ever mean "approved by" — the rejecting
      // admin is recorded in the audit log below.
      approvedById: null,
      approvedAt: null,
    },
  });

  await recomputeHasExhibition(current.institutionId);
  await auditLog(actorId, AuditAction.REJECT_EXHIBITION, TargetModel.EXHIBITION, id, {
    institutionId: current.institutionId,
    reviewNote,
  });

  if (current.submittedBy) {
    void sendSubmissionRejectedEmail(
      current.submittedBy.email,
      current.submittedBy.fullName,
      current.name,
      reviewNote,
    );
  }

  await invalidateInstitutionCache();
  return exhibition;
};

/**
 * Date half of the public filter for a given scope. `live` is the default so a
 * venue's exhibition list agrees with its `hasExhibition` flag; `past` and `all`
 * exist for archive views, which previously had no way to be expressed.
 */
const scopeWhere = (scope: ExhibitionScope): Prisma.ExhibitionWhereInput => {
  switch (scope) {
    case 'past':
      return { endDate: { lt: startOfToday() } };
    case 'all':
      return {};
    case 'live':
    default:
      return { endDate: { gte: startOfToday() } };
  }
};

/** Public read — only for a published, approved institution. */
export const listForInstitution = async (
  institutionId: string,
  query: ListExhibitionsQuery,
): Promise<ExhibitionListResult> => {
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

  const { page, limit, scope } = query;
  const where: Prisma.ExhibitionWhereInput = {
    institutionId,
    approvalStatus: ApprovalStatus.APPROVED,
    isActive: true,
    ...scopeWhere(scope),
  };

  const [data, total] = await Promise.all([
    prisma.exhibition.findMany({
      where,
      orderBy: { startDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.exhibition.count({ where }),
  ]);

  return { data, pagination: paginate(page, limit, total) };
};

/**
 * Public "what's on" across every venue — the cross-institution read the
 * per-venue endpoint could never answer. Cached under the institution cache
 * prefix so existing writes already invalidate it.
 */
export const listPublic = async (
  query: ListPublicExhibitionsQuery,
): Promise<ExhibitionListResult> => {
  const cacheKey = exhibitionListCacheKey(query);
  const cached = await getCached<ExhibitionListResult>(cacheKey);
  if (cached) return cached;

  const { page, limit, scope, area, type, institutionId, search } = query;

  const where: Prisma.ExhibitionWhereInput = {
    approvalStatus: ApprovalStatus.APPROVED,
    isActive: true,
    ...scopeWhere(scope),
    ...(institutionId && { institutionId }),
    // The parent venue must itself be publicly visible.
    institution: {
      isPublished: true,
      deletedAt: null,
      approvalStatus: ApprovalStatus.APPROVED,
      ...(area && { area }),
      ...(type && { type }),
    },
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { institution: { name: { contains: search, mode: 'insensitive' } } },
      ],
    }),
  };

  const [data, total] = await Promise.all([
    prisma.exhibition.findMany({
      where,
      include: {
        institution: {
          select: { id: true, name: true, area: true, type: true, lat: true, lng: true },
        },
      },
      // Soonest-ending first: what is about to close is the most useful thing
      // to surface on a "what's on" screen.
      orderBy: [{ endDate: 'asc' }, { startDate: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.exhibition.count({ where }),
  ]);

  const result: ExhibitionListResult = {
    data,
    pagination: paginate(page, limit, total),
  };

  await setCached(cacheKey, result);
  return result;
};

export const create = async (
  actorId: string,
  institutionId: string,
  input: CreateExhibitionInput,
): Promise<Exhibition> => {
  await ensureInstitution(institutionId);

  // Admins create exhibitions directly — they bypass the approval queue (v2).
  const exhibition = await prisma.exhibition.create({
    data: {
      ...input,
      institutionId,
      approvalStatus: ApprovalStatus.APPROVED,
      isActive: true,
      submittedById: actorId,
      approvedById: actorId,
      approvedAt: new Date(),
    },
  });

  await recomputeHasExhibition(institutionId);
  await auditLog(
    actorId,
    AuditAction.EXHIBITION_CREATE,
    TargetModel.EXHIBITION,
    exhibition.id,
    { institutionId, name: exhibition.name },
  );
  await invalidateInstitutionCache();
  return exhibition;
};

export const update = async (
  actorId: string,
  institutionId: string,
  exhibitionId: string,
  input: UpdateExhibitionInput,
): Promise<Exhibition> => {
  const current = await ensureExhibition(institutionId, exhibitionId);

  // A partial update supplying only one date is validated against the stored
  // value, so the merged range can never end up inverted.
  const startDate = input.startDate ?? current.startDate;
  const endDate = input.endDate ?? current.endDate;
  if (endDate < startDate) {
    throw new AppError('endDate must be on or after startDate', 400);
  }

  const exhibition = await prisma.exhibition.update({
    where: { id: exhibitionId },
    data: input,
  });

  await recomputeHasExhibition(institutionId);
  await auditLog(
    actorId,
    AuditAction.EXHIBITION_UPDATE,
    TargetModel.EXHIBITION,
    exhibitionId,
    { institutionId, fields: Object.keys(input) },
  );
  await invalidateInstitutionCache();
  return exhibition;
};

export const remove = async (
  actorId: string,
  institutionId: string,
  exhibitionId: string,
): Promise<Exhibition> => {
  await ensureExhibition(institutionId, exhibitionId);

  const exhibition = await prisma.exhibition.delete({ where: { id: exhibitionId } });

  await recomputeHasExhibition(institutionId);
  await auditLog(
    actorId,
    AuditAction.EXHIBITION_DELETE,
    TargetModel.EXHIBITION,
    exhibitionId,
    { institutionId },
  );
  await invalidateInstitutionCache();
  return exhibition;
};

/** Attach an uploaded image URL to an exhibition and log it. */
export const addImage = async (
  actorId: string,
  institutionId: string,
  exhibitionId: string,
  imageUrl: string,
): Promise<Exhibition> => {
  const current = await ensureExhibition(institutionId, exhibitionId);

  const exhibition = await prisma.exhibition.update({
    where: { id: exhibitionId },
    data: { images: [...current.images, imageUrl] },
  });

  await auditLog(actorId, AuditAction.IMAGE_UPLOAD, TargetModel.EXHIBITION, exhibitionId, {
    institutionId,
    imageUrl,
  });
  await invalidateInstitutionCache();
  return exhibition;
};

/** Toggle whether an exhibition is publicly active. */
export const setActive = async (
  actorId: string,
  institutionId: string,
  exhibitionId: string,
  isActive: boolean,
): Promise<Exhibition> => {
  await ensureExhibition(institutionId, exhibitionId);

  const exhibition = await prisma.exhibition.update({
    where: { id: exhibitionId },
    data: { isActive },
  });

  // isActive is one of the three conditions in liveExhibitionWhere(), so
  // toggling it changes whether the venue still has a live exhibition.
  await recomputeHasExhibition(institutionId);
  await auditLog(
    actorId,
    AuditAction.EXHIBITION_UPDATE,
    TargetModel.EXHIBITION,
    exhibitionId,
    { institutionId, isActive },
  );
  await invalidateInstitutionCache();
  return exhibition;
};

/** Remove an image URL from an exhibition and best-effort delete the S3 object. */
export const removeImage = async (
  actorId: string,
  institutionId: string,
  exhibitionId: string,
  imageUrl: string,
): Promise<Exhibition> => {
  const current = await ensureExhibition(institutionId, exhibitionId);

  if (!current.images.includes(imageUrl)) {
    throw new AppError('Image URL not found on this exhibition', 404);
  }

  const exhibition = await prisma.exhibition.update({
    where: { id: exhibitionId },
    data: { images: current.images.filter((url) => url !== imageUrl) },
  });

  await deleteS3ObjectByUrl(imageUrl);

  await auditLog(actorId, AuditAction.EXHIBITION_UPDATE, TargetModel.EXHIBITION, exhibitionId, {
    institutionId,
    removedImageUrl: imageUrl,
  });
  await invalidateInstitutionCache();
  return exhibition;
};
