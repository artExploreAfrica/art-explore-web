import {
  AuditAction,
  Institution,
  Prisma,
  TargetModel,
} from '@prisma/client';
import prisma from '../config/db';
import { NotFoundError } from '../utils/AppError';
import { auditLog } from '../utils/auditLogger';
import {
  getCached,
  invalidateInstitutionCache,
  listCacheKey,
  MAP_CACHE_KEY,
  setCached,
} from '../utils/institutionCache';
import { PaginationMeta } from '../utils/response';
import {
  CreateInstitutionInput,
  ListInstitutionsQuery,
  UpdateInstitutionInput,
} from '../validators/institution.validator';

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

  const { page, limit, area, type, search } = query;

  const where: Prisma.InstitutionWhereInput = {
    isPublished: true,
    ...(area && { area }),
    ...(type && { type }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } },
      ],
    }),
  };

  const [data, total] = await Promise.all([
    prisma.institution.findMany({
      where,
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
    where: { id, isPublished: true },
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
    where: { isPublished: true },
    select: { id: true, name: true, lat: true, lng: true, type: true },
  });

  await setCached(MAP_CACHE_KEY, pins);
  return pins;
};

// ---------------------------------------------------------------------------
// Admin writes — each invalidates the cache and writes an audit log entry.
// ---------------------------------------------------------------------------

export const create = async (
  actorId: string,
  input: CreateInstitutionInput,
): Promise<Institution> => {
  const institution = await prisma.institution.create({
    data: {
      ...input,
      openingHours: input.openingHours ?? Prisma.JsonNull,
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

  const institution = await prisma.institution.update({
    where: { id },
    data: {
      ...input,
      ...(input.openingHours !== undefined && {
        openingHours: input.openingHours ?? Prisma.JsonNull,
      }),
    },
  });

  await auditLog(actorId, AuditAction.UPDATE, TargetModel.INSTITUTION, id, {
    fields: Object.keys(input),
  });
  await invalidateInstitutionCache();
  return institution;
};

/** Soft delete — sets isPublished:false (Guide §3.2). */
export const softDelete = async (actorId: string, id: string): Promise<Institution> => {
  await ensureExists(id);

  const institution = await prisma.institution.update({
    where: { id },
    data: { isPublished: false },
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

/** Admin-facing fetch (ignores isPublished). */
const ensureExists = async (id: string): Promise<Institution> => {
  const institution = await prisma.institution.findUnique({ where: { id } });
  if (!institution) throw NotFoundError('Institution');
  return institution;
};
