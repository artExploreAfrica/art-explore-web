import {
  ApprovalStatus,
  AuditAction,
  Institution,
  Prisma,
  TargetModel,
} from '@prisma/client';
import prisma from '../config/db';
import { AppError, NotFoundError } from '../utils/AppError';
import { auditLog } from '../utils/auditLogger';
import {
  getCached,
  invalidateInstitutionCache,
  listCacheKey,
  MAP_CACHE_KEY,
  setCached,
} from '../utils/institutionCache';
import {
  sendSubmissionApprovedEmail,
  sendSubmissionRejectedEmail,
} from '../utils/mailer';
import { PaginationMeta } from '../utils/response';
import { deleteS3ObjectByUrl } from '../utils/s3Uploader';
import {
  AdminListInstitutionsQuery,
  CreateInstitutionInput,
  ListInstitutionsQuery,
  UpdateInstitutionInput,
} from '../validators/institution.validator';
import {
  ListSubmissionsQuery,
  MySubmissionsQuery,
  SubmitInstitutionInput,
} from '../validators/submission.validator';

interface ListResult {
  data: Institution[];
  pagination: PaginationMeta;
}

/**
 * Public paginated list with area/type filters and text search.
 * Only published institutions are returned. Cached for 60s.
 */
export const listPublished = async (query: ListInstitutionsQuery): Promise<ListResult> => {
  const cacheKey = listCacheKey(query);
  const cached = await getCached<ListResult>(cacheKey);
  if (cached) return cached;

  const { page, limit, area, type, subCategoryId, tag, search } = query;

  const where: Prisma.InstitutionWhereInput = {
    isPublished: true,
    deletedAt: null,
    approvalStatus: ApprovalStatus.APPROVED,
    ...(area && { area }),
    ...(type && { type }),
    ...(subCategoryId && { subCategoryId }),
    // Tag filter accepts either the tag id or the slug (`name`).
    ...(tag && { tags: { some: { OR: [{ id: tag }, { name: tag }] } } }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { some: { name: { contains: search, mode: 'insensitive' } } } },
      ],
    }),
  };

  const [data, total] = await Promise.all([
    prisma.institution.findMany({
      where,
      include: { tags: true, subCategory: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.institution.count({ where }),
  ]);

  const result: ListResult = {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    },
  };

  await setCached(cacheKey, result);
  return result;
};

/** Single published institution by id. */
export const getById = async (id: string): Promise<Institution> => {
  const institution = await prisma.institution.findFirst({
    where: {
      id,
      isPublished: true,
      deletedAt: null,
      approvalStatus: ApprovalStatus.APPROVED,
    },
    include: { tags: true, subCategory: true },
  });
  if (!institution) throw NotFoundError('Institution');
  return institution;
};

export type MapPin = Pick<Institution, 'id' | 'name' | 'lat' | 'lng' | 'type'>;

/** Lightweight list for map rendering. Cached for 60s. */
export const getMapPins = async (): Promise<MapPin[]> => {
  const cached = await getCached<MapPin[]>(MAP_CACHE_KEY);
  if (cached) return cached;

  const pins = await prisma.institution.findMany({
    where: {
      isPublished: true,
      deletedAt: null,
      approvalStatus: ApprovalStatus.APPROVED,
    },
    select: { id: true, name: true, lat: true, lng: true, type: true },
  });

  await setCached(MAP_CACHE_KEY, pins);
  return pins;
};

// ---------------------------------------------------------------------------
// Admin reads — full catalogue (drafts, unpublished, pending); not soft-deleted.
// ---------------------------------------------------------------------------

export const listForAdmin = async (query: AdminListInstitutionsQuery): Promise<ListResult> => {
  const { page, limit, area, type, subCategoryId, tag, search, isPublished, approvalStatus } =
    query;

  const where: Prisma.InstitutionWhereInput = {
    deletedAt: null,
    ...(area && { area }),
    ...(type && { type }),
    ...(subCategoryId && { subCategoryId }),
    ...(tag && { tags: { some: { OR: [{ id: tag }, { name: tag }] } } }),
    ...(isPublished !== undefined && { isPublished }),
    ...(approvalStatus && { approvalStatus }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { some: { name: { contains: search, mode: 'insensitive' } } } },
      ],
    }),
  };

  const [data, total] = await Promise.all([
    prisma.institution.findMany({
      where,
      include: { tags: true, subCategory: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.institution.count({ where }),
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    },
  };
};

/** Admin detail — any non-deleted institution regardless of publish/approval. */
export const getByIdForAdmin = async (id: string): Promise<Institution> => {
  const institution = await prisma.institution.findFirst({
    where: { id, deletedAt: null },
    include: { tags: true, subCategory: true },
  });
  if (!institution) throw NotFoundError('Institution');
  return institution;
};

// ---------------------------------------------------------------------------
// Admin writes — each invalidates the cache and writes an audit log entry.
// ---------------------------------------------------------------------------

export const create = async (
  actorId: string,
  input: CreateInstitutionInput,
): Promise<Institution> => {
  const { tagIds, openingHours, ...rest } = input;

  const institution = await prisma.institution.create({
    data: {
      ...rest,
      openingHours: openingHours ?? Prisma.JsonNull,
      ...(tagIds && tagIds.length > 0 && {
        tags: { connect: tagIds.map((id) => ({ id })) },
      }),
    },
  });

  await auditLog(actorId, AuditAction.CREATE, TargetModel.INSTITUTION, institution.id, {
    name: institution.name,
  });
  await invalidateInstitutionCache();
  return institution;
};

export const update = async (
  actorId: string,
  id: string,
  input: UpdateInstitutionInput,
): Promise<Institution> => {
  await ensureExists(id);

  const { tagIds, openingHours, ...rest } = input;

  const institution = await prisma.institution.update({
    where: { id },
    data: {
      ...rest,
      ...(openingHours !== undefined && {
        openingHours: openingHours ?? Prisma.JsonNull,
      }),
      // `set` replaces the full tag list; only apply when tagIds was supplied.
      ...(tagIds !== undefined && {
        tags: { set: tagIds.map((id) => ({ id })) },
      }),
    },
  });

  await auditLog(actorId, AuditAction.UPDATE, TargetModel.INSTITUTION, id, {
    fields: Object.keys(input),
  });
  await invalidateInstitutionCache();
  return institution;
};

/**
 * Soft delete — stamps `deletedAt` so the record is excluded from every read and
 * can no longer be edited or published. Also clears `isPublished` for consistency.
 * Distinct from unpublish, which only toggles `isPublished` (Guide §3.2).
 */
export const softDelete = async (actorId: string, id: string): Promise<Institution> => {
  await ensureExists(id);

  const institution = await prisma.institution.update({
    where: { id },
    data: { deletedAt: new Date(), isPublished: false },
  });

  await auditLog(actorId, AuditAction.DELETE, TargetModel.INSTITUTION, id);
  await invalidateInstitutionCache();
  return institution;
};

/** Toggle publish status; logs PUBLISH or UNPUBLISH accordingly. */
export const togglePublish = async (actorId: string, id: string): Promise<Institution> => {
  const current = await ensureExists(id);
  const nextPublished = !current.isPublished;

  const institution = await prisma.institution.update({
    where: { id },
    data: { isPublished: nextPublished },
  });

  await auditLog(
    actorId,
    nextPublished ? AuditAction.PUBLISH : AuditAction.UNPUBLISH,
    TargetModel.INSTITUTION,
    id,
  );
  await invalidateInstitutionCache();
  return institution;
};

/** Append an uploaded image URL to the institution and log it. */
export const addImage = async (
  actorId: string,
  id: string,
  imageUrl: string,
): Promise<Institution> => {
  const current = await ensureExists(id);

  const institution = await prisma.institution.update({
    where: { id },
    data: { images: [...current.images, imageUrl] },
  });

  await auditLog(actorId, AuditAction.IMAGE_UPLOAD, TargetModel.INSTITUTION, id, {
    imageUrl,
  });
  await invalidateInstitutionCache();
  return institution;
};

/** Remove an image URL from the institution and best-effort delete the S3 object. */
export const removeImage = async (
  actorId: string,
  id: string,
  imageUrl: string,
): Promise<Institution> => {
  const current = await ensureExists(id);

  if (!current.images.includes(imageUrl)) {
    throw new AppError('Image URL not found on this institution', 404);
  }

  const institution = await prisma.institution.update({
    where: { id },
    data: { images: current.images.filter((url) => url !== imageUrl) },
  });

  await deleteS3ObjectByUrl(imageUrl);

  await auditLog(actorId, AuditAction.UPDATE, TargetModel.INSTITUTION, id, {
    removedImageUrl: imageUrl,
  });
  await invalidateInstitutionCache();
  return institution;
};

// ---------------------------------------------------------------------------
// Submission / approval workflow (Feature 5)
// ---------------------------------------------------------------------------

/**
 * A USER submits an institution. It is created PENDING and unpublished — never
 * visible publicly until an admin approves and publishes it.
 */
export const submit = async (
  userId: string,
  input: SubmitInstitutionInput,
): Promise<Institution> => {
  const { tagIds, openingHours, ...rest } = input;

  const institution = await prisma.institution.create({
    data: {
      ...rest,
      openingHours: openingHours ?? Prisma.JsonNull,
      approvalStatus: ApprovalStatus.PENDING,
      isPublished: false,
      submittedById: userId,
      ...(tagIds && tagIds.length > 0 && {
        tags: { connect: tagIds.map((id) => ({ id })) },
      }),
    },
  });

  await auditLog(userId, AuditAction.SUBMIT, TargetModel.INSTITUTION, institution.id, {
    name: institution.name,
  });
  // Not public yet — no cache invalidation needed.
  return institution;
};

/** A USER's own submissions, any status. */
export const listMine = async (
  userId: string,
  query: MySubmissionsQuery,
): Promise<ListResult> => {
  const { page, limit } = query;
  const where: Prisma.InstitutionWhereInput = { submittedById: userId, deletedAt: null };

  const [data, total] = await Promise.all([
    prisma.institution.findMany({
      where,
      include: { tags: true, subCategory: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.institution.count({ where }),
  ]);

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
  };
};

/** Admin review queue — user-submitted venues only, filtered by approval status. */
export const listSubmissions = async (
  query: ListSubmissionsQuery,
): Promise<ListResult> => {
  const { page, limit, status } = query;
  const where: Prisma.InstitutionWhereInput = {
    approvalStatus: status,
    deletedAt: null,
    submittedById: { not: null },
  };

  const [data, total] = await Promise.all([
    prisma.institution.findMany({
      where,
      include: { tags: true, subCategory: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.institution.count({ where }),
  ]);

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
  };
};

/** Approve a submission. Does not publish — admin publishes separately. */
export const approve = async (actorId: string, id: string): Promise<Institution> => {
  const current = await prisma.institution.findFirst({
    where: { id, deletedAt: null },
    include: { submittedBy: { select: { email: true, fullName: true } } },
  });
  if (!current) throw NotFoundError('Institution');

  const institution = await prisma.institution.update({
    where: { id },
    data: {
      approvalStatus: ApprovalStatus.APPROVED,
      reviewedById: actorId,
      reviewedAt: new Date(),
      reviewNote: null,
    },
  });

  await auditLog(actorId, AuditAction.APPROVE_INSTITUTION, TargetModel.INSTITUTION, id);

  if (current.submittedBy) {
    void sendSubmissionApprovedEmail(
      current.submittedBy.email,
      current.submittedBy.fullName,
      current.name,
    );
  }

  return institution;
};

/** Reject a submission with a required reviewer note. */
export const reject = async (
  actorId: string,
  id: string,
  reviewNote: string,
): Promise<Institution> => {
  const current = await prisma.institution.findFirst({
    where: { id, deletedAt: null },
    include: { submittedBy: { select: { email: true, fullName: true } } },
  });
  if (!current) throw NotFoundError('Institution');

  const institution = await prisma.institution.update({
    where: { id },
    data: {
      approvalStatus: ApprovalStatus.REJECTED,
      reviewedById: actorId,
      reviewedAt: new Date(),
      reviewNote,
      isPublished: false,
    },
  });

  await auditLog(actorId, AuditAction.REJECT_INSTITUTION, TargetModel.INSTITUTION, id, {
    reviewNote,
  });
  await invalidateInstitutionCache();

  if (current.submittedBy) {
    void sendSubmissionRejectedEmail(
      current.submittedBy.email,
      current.submittedBy.fullName,
      current.name,
      reviewNote,
    );
  }

  return institution;
};

/** Admin-facing fetch (ignores isPublished, but excludes soft-deleted records). */
const ensureExists = async (id: string): Promise<Institution> => {
  const institution = await prisma.institution.findFirst({
    where: { id, deletedAt: null },
  });
  if (!institution) throw NotFoundError('Institution');
  return institution;
};
