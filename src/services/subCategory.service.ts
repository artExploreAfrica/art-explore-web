import { AuditAction, Prisma, SubCategory, TargetModel } from '@prisma/client';
import prisma from '../config/db';
import { AppError, ConflictError, NotFoundError } from '../utils/AppError';
import { auditLog } from '../utils/auditLogger';
import { invalidateInstitutionCache } from '../utils/institutionCache';
import { PaginationMeta } from '../utils/response';
import {
  CreateSubCategoryInput,
  ListSubCategoriesQuery,
  UpdateSubCategoryInput,
} from '../validators/subCategory.validator';

interface ListResult {
  data: SubCategory[];
  pagination: PaginationMeta;
}

/** Paginated list, optionally filtered by institution type. */
export const list = async (query: ListSubCategoriesQuery): Promise<ListResult> => {
  const { page, limit, type } = query;
  const where: Prisma.SubCategoryWhereInput = { ...(type && { type }) };

  const [data, total] = await Promise.all([
    prisma.subCategory.findMany({
      where,
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.subCategory.count({ where }),
  ]);

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
  };
};

export const getById = async (id: string): Promise<SubCategory> => {
  const subCategory = await prisma.subCategory.findUnique({ where: { id } });
  if (!subCategory) throw NotFoundError('SubCategory');
  return subCategory;
};

export const create = async (
  actorId: string,
  input: CreateSubCategoryInput,
): Promise<SubCategory> => {
  let subCategory: SubCategory;
  try {
    subCategory = await prisma.subCategory.create({ data: input });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw ConflictError(`A sub-category "${input.name}" already exists for that type`);
    }
    throw err;
  }

  await auditLog(actorId, AuditAction.CREATE, TargetModel.SUBCATEGORY, subCategory.id, {
    name: subCategory.name,
    type: subCategory.type,
  });
  return subCategory;
};

export const update = async (
  actorId: string,
  id: string,
  input: UpdateSubCategoryInput,
): Promise<SubCategory> => {
  await getById(id);

  let subCategory: SubCategory;
  try {
    subCategory = await prisma.subCategory.update({ where: { id }, data: input });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw ConflictError('Another sub-category with that name already exists for that type');
    }
    throw err;
  }

  await auditLog(actorId, AuditAction.UPDATE, TargetModel.SUBCATEGORY, id, {
    fields: Object.keys(input),
  });
  // Sub-category name surfaces in institution payloads, so drop the cache.
  await invalidateInstitutionCache();
  return subCategory;
};

/** Delete — blocked while any institution still references this sub-category. */
export const remove = async (actorId: string, id: string): Promise<SubCategory> => {
  await getById(id);

  const inUse = await prisma.institution.count({ where: { subCategoryId: id } });
  if (inUse > 0) {
    throw new AppError(
      `Cannot delete: ${inUse} institution(s) still use this sub-category`,
      409,
    );
  }

  const subCategory = await prisma.subCategory.delete({ where: { id } });
  await auditLog(actorId, AuditAction.DELETE, TargetModel.SUBCATEGORY, id);
  await invalidateInstitutionCache();
  return subCategory;
};
