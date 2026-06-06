import { AuditAction, Prisma, Tag, TargetModel } from '@prisma/client';
import prisma from '../config/db';
import { ConflictError, NotFoundError } from '../utils/AppError';
import { auditLog } from '../utils/auditLogger';
import { invalidateInstitutionCache } from '../utils/institutionCache';
import { PaginationMeta } from '../utils/response';
import {
  CreateTagInput,
  ListTagsQuery,
  UpdateTagInput,
} from '../validators/tag.validator';

interface ListResult {
  data: Tag[];
  pagination: PaginationMeta;
}

/** Paginated tag list with optional name search. */
export const list = async (query: ListTagsQuery): Promise<ListResult> => {
  const { page, limit, search } = query;
  const where: Prisma.TagWhereInput = {
    ...(search && { name: { contains: search, mode: 'insensitive' } }),
  };

  const [data, total] = await Promise.all([
    prisma.tag.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.tag.count({ where }),
  ]);

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
  };
};

export const getById = async (id: string): Promise<Tag> => {
  const tag = await prisma.tag.findUnique({ where: { id } });
  if (!tag) throw NotFoundError('Tag');
  return tag;
};

export const create = async (actorId: string, input: CreateTagInput): Promise<Tag> => {
  let tag: Tag;
  try {
    tag = await prisma.tag.create({ data: { name: input.name } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw ConflictError(`A tag named "${input.name}" already exists`);
    }
    throw err;
  }

  await auditLog(actorId, AuditAction.CREATE, TargetModel.TAG, tag.id, { name: tag.name });
  await invalidateInstitutionCache();
  return tag;
};

export const update = async (
  actorId: string,
  id: string,
  input: UpdateTagInput,
): Promise<Tag> => {
  await getById(id);

  let tag: Tag;
  try {
    tag = await prisma.tag.update({ where: { id }, data: { name: input.name } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw ConflictError(`A tag named "${input.name}" already exists`);
    }
    throw err;
  }

  await auditLog(actorId, AuditAction.UPDATE, TargetModel.TAG, id, { name: tag.name });
  await invalidateInstitutionCache();
  return tag;
};

/** Delete a tag. The implicit join rows are removed by the FK cascade. */
export const remove = async (actorId: string, id: string): Promise<Tag> => {
  await getById(id);
  const tag = await prisma.tag.delete({ where: { id } });
  await auditLog(actorId, AuditAction.DELETE, TargetModel.TAG, id);
  await invalidateInstitutionCache();
  return tag;
};
