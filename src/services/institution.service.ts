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
  UpdateSubmissionInput,
} from '../validators/submission.validator';

interface ListResult {
  data: Institution[];
  pagination: PaginationMeta;
}

type SortKey = 'newest' | 'oldest' | 'name' | 'rating';

/**
 * Ordering for the catalogue. Rating sorts nulls last so unreviewed venues
 * never outrank reviewed ones, with a name tiebreak to keep pages stable.
 */
const orderFor = (sort: SortKey): Prisma.InstitutionOrderByWithRelationInput[] => {
  switch (sort) {
    case 'oldest':
      return [{ createdAt: 'asc' }];
    case 'name':
      return [{ name: 'asc' }];
    case 'rating':
      return [{ rating: { sort: 'desc', nulls: 'last' } }, { name: 'asc' }];
    case 'newest':
    default:
      return [{ createdAt: 'desc' }];
  }
};

/**
 * Ids of venues currently within their trading hours, resolved in SQL against
 * the JSONB `openingHours` column so the filter composes with pagination
 * instead of forcing every row into memory.
 *
 * Semantics deliberately match the client's `isOpenNow`: a venue with no hours
 * recorded counts as open (unknown, not closed), a day set to null is closed,
 * and a `close` earlier than `open` means the venue trades past midnight.
 * "Now" is the server's clock — the deployment runs on Lagos time (WAT, no DST).
 */
const openNowInstitutionIds = async (): Promise<string[]> => {
  const now = new Date();
  const day = String(now.getDay());
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes(),
  ).padStart(2, '0')}`;

  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "Institution"
    WHERE "deletedAt" IS NULL
      AND (
        -- "Hours unknown" arrives two ways: a true SQL NULL, and the JSONB
        -- 'null' that Prisma.JsonNull writes when a venue is saved without
        -- hours. Both must count as unknown or every such venue silently
        -- disappears from the openNow results.
        "openingHours" IS NULL
        OR jsonb_typeof("openingHours") = 'null'
        OR (
          jsonb_typeof("openingHours" -> ${day}) = 'object'
          AND (
            CASE
              WHEN ("openingHours" -> ${day} ->> 'close')
                 > ("openingHours" -> ${day} ->> 'open')
                THEN ${hhmm} >= ("openingHours" -> ${day} ->> 'open')
                 AND ${hhmm} <  ("openingHours" -> ${day} ->> 'close')
              ELSE ${hhmm} >= ("openingHours" -> ${day} ->> 'open')
                OR ${hhmm} <  ("openingHours" -> ${day} ->> 'close')
            END
          )
        )
      )
  `;

  return rows.map((r) => r.id);
};

/**
 * Public paginated list with area/type filters and text search.
 * Only published institutions are returned. Cached for 60s.
 */
export const listPublished = async (query: ListInstitutionsQuery): Promise<ListResult> => {
  const cacheKey = listCacheKey(query);
  const cached = await getCached<ListResult>(cacheKey);
  if (cached) return cached;

  const {
    page,
    limit,
    area,
    type,
    subCategoryId,
    tag,
    search,
    minRating,
    openNow,
    hasExhibition,
    sort,
  } = query;

  const where: Prisma.InstitutionWhereInput = {
    isPublished: true,
    deletedAt: null,
    approvalStatus: ApprovalStatus.APPROVED,
    ...(area && { area }),
    ...(type && { type }),
    ...(subCategoryId && { subCategoryId }),
    // Tag filter accepts either the tag id or the slug (`name`).
    ...(tag && { tags: { some: { OR: [{ id: tag }, { name: tag }] } } }),
    ...(minRating !== undefined && { rating: { gte: minRating } }),
    ...(hasExhibition !== undefined && { hasExhibition }),
    ...(openNow && { id: { in: await openNowInstitutionIds() } }),
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
      orderBy: orderFor(sort),
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
  const {
    page,
    limit,
    area,
    type,
    subCategoryId,
    tag,
    search,
    isPublished,
    approvalStatus,
    minRating,
    openNow,
    hasExhibition,
    deleted,
    sort,
  } = query;

  const where: Prisma.InstitutionWhereInput = {
    // `deleted=true` inverts the default so soft-deleted rows can be found and
    // restored; without it they stay hidden as before.
    deletedAt: deleted ? { not: null } : null,
    ...(area && { area }),
    ...(type && { type }),
    ...(subCategoryId && { subCategoryId }),
    ...(tag && { tags: { some: { OR: [{ id: tag }, { name: tag }] } } }),
    ...(isPublished !== undefined && { isPublished }),
    ...(approvalStatus && { approvalStatus }),
    ...(minRating !== undefined && { rating: { gte: minRating } }),
    ...(hasExhibition !== undefined && { hasExhibition }),
    ...(openNow && { id: { in: await openNowInstitutionIds() } }),
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
      orderBy: orderFor(sort),
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

/**
 * Undo a soft delete. Deliberately does NOT republish — restoring brings the
 * record back into the admin catalogue, and making it public again is the same
 * separate, audited decision it was the first time.
 */
export const restore = async (actorId: string, id: string): Promise<Institution> => {
  const current = await prisma.institution.findUnique({ where: { id } });
  if (!current) throw NotFoundError('Institution');
  if (current.deletedAt === null) {
    throw new AppError('Institution is not deleted', 400);
  }

  const institution = await prisma.institution.update({
    where: { id },
    data: { deletedAt: null },
  });

  await auditLog(actorId, AuditAction.RESTORE, TargetModel.INSTITUTION, id, {
    name: institution.name,
  });
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

/**
 * Fetch a submission the given user owns and is still allowed to change.
 * APPROVED submissions are frozen — once a venue is in the catalogue its
 * content is the admin's, not the submitter's.
 */
const ensureEditableSubmission = async (
  userId: string,
  id: string,
): Promise<Institution> => {
  const institution = await prisma.institution.findFirst({
    where: { id, submittedById: userId, deletedAt: null },
  });
  // Someone else's submission is reported as missing rather than forbidden, so
  // the response never confirms that an id exists.
  if (!institution) throw NotFoundError('Submission');

  if (institution.approvalStatus === ApprovalStatus.APPROVED) {
    throw new AppError(
      'This submission has been approved and can no longer be changed — contact an admin',
      409,
    );
  }
  return institution;
};

/**
 * A USER edits their own pending or rejected submission. A rejected one returns
 * to PENDING with the old reviewer note cleared, which is what makes "fix it and
 * resubmit" possible without opening a duplicate.
 */
export const updateMine = async (
  userId: string,
  id: string,
  input: UpdateSubmissionInput,
): Promise<Institution> => {
  await ensureEditableSubmission(userId, id);

  const { tagIds, openingHours, ...rest } = input;

  const institution = await prisma.institution.update({
    where: { id },
    data: {
      ...rest,
      ...(openingHours !== undefined && {
        openingHours: openingHours ?? Prisma.JsonNull,
      }),
      ...(tagIds !== undefined && { tags: { set: tagIds.map((t) => ({ id: t })) } }),
      approvalStatus: ApprovalStatus.PENDING,
      reviewedById: null,
      reviewedAt: null,
      reviewNote: null,
    },
  });

  await auditLog(userId, AuditAction.UPDATE, TargetModel.INSTITUTION, id, {
    fields: Object.keys(input),
    bySubmitter: true,
  });
  // Never public in either state, so no cache work is needed.
  return institution;
};

/**
 * A USER withdraws their own submission. Soft-deleted like any other removal so
 * the record — and its audit trail — survives.
 */
export const withdrawMine = async (userId: string, id: string): Promise<Institution> => {
  await ensureEditableSubmission(userId, id);

  const institution = await prisma.institution.update({
    where: { id },
    data: { deletedAt: new Date(), isPublished: false },
  });

  await auditLog(userId, AuditAction.WITHDRAW, TargetModel.INSTITUTION, id, {
    name: institution.name,
  });
  return institution;
};

/**
 * Resolve an own editable submission before uploading, so an unauthorised id
 * never reaches the bucket. Without this the bytes land under
 * `institutions/{id}/` for any id the caller names — including someone else's
 * submission or a published venue — before the ownership check runs.
 */
export const getMineForUpload = async (
  userId: string,
  id: string,
): Promise<Institution> => ensureEditableSubmission(userId, id);

/** Attach an uploaded image to the submitter's own pending/rejected submission. */
export const addImageToMine = async (
  userId: string,
  id: string,
  imageUrl: string,
): Promise<Institution> => {
  const current = await ensureEditableSubmission(userId, id);

  const institution = await prisma.institution.update({
    where: { id },
    data: { images: [...current.images, imageUrl] },
  });

  await auditLog(userId, AuditAction.IMAGE_UPLOAD, TargetModel.INSTITUTION, id, {
    imageUrl,
    bySubmitter: true,
  });
  return institution;
};

/** Remove an image from the submitter's own pending/rejected submission. */
export const removeImageFromMine = async (
  userId: string,
  id: string,
  imageUrl: string,
): Promise<Institution> => {
  const current = await ensureEditableSubmission(userId, id);

  if (!current.images.includes(imageUrl)) {
    throw new AppError('Image URL not found on this submission', 404);
  }

  const institution = await prisma.institution.update({
    where: { id },
    data: { images: current.images.filter((url) => url !== imageUrl) },
  });

  await deleteS3ObjectByUrl(imageUrl);

  await auditLog(userId, AuditAction.UPDATE, TargetModel.INSTITUTION, id, {
    removedImageUrl: imageUrl,
    bySubmitter: true,
  });
  return institution;
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
  // An already-published venue becomes publicly visible the moment it is
  // approved, so the list/map cache has to drop just like it does on reject.
  await invalidateInstitutionCache();

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
