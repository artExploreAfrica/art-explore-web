import { AuditAction, Prisma, Tag, TagCategory, TargetModel } from '@prisma/client';
import prisma from '../config/db';
import { AppError, ConflictError, NotFoundError } from '../utils/AppError';
import { auditLog } from '../utils/auditLogger';
import { invalidateInstitutionCache } from '../utils/institutionCache';
import { PaginationMeta } from '../utils/response';
import {
  CreateTagInput,
  ListTagsQuery,
  UpdateTagInput,
} from '../validators/tag.validator';

interface ListResult<T = Tag> {
  data: T[];
  pagination: PaginationMeta;
}

/** A space as the admin's Tags page shows it: enough to recognise and pick. */
const SPACE_SUMMARY = {
  id: true,
  name: true,
  images: true,
  isPublished: true,
} satisfies Prisma.InstitutionSelect;

/**
 * The machine slug for a tag, derived from what the admin typed:
 * "Yoruba History" → "YORUBA_HISTORY", "Workshops & Classes" →
 * "WORKSHOPS_CLASSES". One fixed format is what stops "women owned",
 * "Women-Owned" and "WOMEN_OWNED" from becoming three different tags.
 */
export const tagNameFromLabel = (text: string): string =>
  text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // é → e
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);

const slugOrThrow = (text: string): string => {
  const name = tagNameFromLabel(text);
  if (!name) throw new AppError('The tag name must contain letters or numbers', 400);
  return name;
};

/** Refuse a tag whose name or label matches another one, ignoring case. */
const ensureNoClash = async (name: string, label: string, exceptId?: string): Promise<void> => {
  const clash = await prisma.tag.findFirst({
    where: {
      ...(exceptId && { id: { not: exceptId } }),
      OR: [
        { name: { equals: name, mode: 'insensitive' } },
        { label: { equals: label, mode: 'insensitive' } },
      ],
    },
    select: { label: true },
  });
  if (clash) throw ConflictError(`A tag called "${clash.label}" already exists`);
};

/** Every id must be a real, non-deleted space — no silent partial saves. */
const ensureSpacesExist = async (ids: string[]): Promise<void> => {
  if (ids.length === 0) return;
  const found = await prisma.institution.findMany({
    where: { id: { in: ids }, deletedAt: null },
    select: { id: true },
  });
  if (found.length !== ids.length) {
    const known = new Set(found.map((s) => s.id));
    const missing = ids.filter((id) => !known.has(id));
    throw new AppError(`Unknown or deleted space(s): ${missing.join(', ')}`, 400, { missing });
  }
};

/** A cover has to be one of the tag's spaces, and has to have a photo to show. */
const ensureValidCover = async (coverId: string, spaceIds: Set<string>): Promise<void> => {
  if (!spaceIds.has(coverId)) {
    throw new AppError('The cover must be one of the spaces that have this tag', 400);
  }
  const space = await prisma.institution.findFirst({
    where: { id: coverId, deletedAt: null },
    select: { images: true },
  });
  if (!space?.images.length) {
    throw new AppError(
      'That space has no photo yet — choose a space with a photo, or add one to it first',
      400,
    );
  }
};

const rethrowDuplicate = (err: unknown, label: string): never => {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    throw ConflictError(`A tag called "${label}" already exists`);
  }
  throw err;
};

/** Paginated tag list with optional name search and category filter. Public. */
export const list = async (query: ListTagsQuery): Promise<ListResult> => {
  const { page, limit, search, category } = query;
  const where: Prisma.TagWhereInput = {
    ...(search && { name: { contains: search, mode: 'insensitive' } }),
    ...(category && { category }),
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

const ADMIN_LIST_INCLUDE = {
  _count: { select: { institutions: true } },
  coverInstitution: { select: SPACE_SUMMARY },
} satisfies Prisma.TagInclude;

export type AdminTagRow = Prisma.TagGetPayload<{ include: typeof ADMIN_LIST_INCLUDE }>;

/** Admin list: the public list plus how many spaces carry each tag and its cover. */
export const listForAdmin = async (query: ListTagsQuery): Promise<ListResult<AdminTagRow>> => {
  const { page, limit, search, category } = query;
  const where: Prisma.TagWhereInput = {
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { label: { contains: search, mode: 'insensitive' } },
      ],
    }),
    ...(category && { category }),
  };

  const [data, total] = await Promise.all([
    prisma.tag.findMany({
      where,
      include: ADMIN_LIST_INCLUDE,
      orderBy: { label: 'asc' },
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

const ADMIN_DETAIL_INCLUDE = {
  institutions: {
    where: { deletedAt: null },
    select: SPACE_SUMMARY,
    orderBy: { name: 'asc' },
  },
  coverInstitution: { select: SPACE_SUMMARY },
} satisfies Prisma.TagInclude;

export type AdminTagDetail = Prisma.TagGetPayload<{ include: typeof ADMIN_DETAIL_INCLUDE }>;

/** One tag with its spaces, for the admin's edit form. */
export const getForAdmin = async (id: string): Promise<AdminTagDetail> => {
  const tag = await prisma.tag.findUnique({ where: { id }, include: ADMIN_DETAIL_INCLUDE });
  if (!tag) throw NotFoundError('Tag');
  return tag;
};

export type SpaceOption = Prisma.InstitutionGetPayload<{ select: typeof SPACE_SUMMARY }>;

/**
 * Every space a tag can be linked to, for the tag form's picker: all
 * non-deleted spaces, drafts included (a draft can be tagged before it is
 * published). One small row each, so the whole catalogue fits one response.
 */
export const listSpaceOptions = async (): Promise<SpaceOption[]> =>
  prisma.institution.findMany({
    where: { deletedAt: null },
    select: SPACE_SUMMARY,
    orderBy: { name: 'asc' },
    take: 5000,
  });

export const getById = async (id: string): Promise<Tag> => {
  const tag = await prisma.tag.findUnique({ where: { id } });
  if (!tag) throw NotFoundError('Tag');
  return tag;
};

export const create = async (actorId: string, input: CreateTagInput): Promise<Tag> => {
  // The validator guarantees at least one of label/name.
  const label = (input.label ?? input.name) as string;
  const name = slugOrThrow(input.name ?? label);
  await ensureNoClash(name, label);

  const spaceIds = input.institutionIds ?? [];
  await ensureSpacesExist(spaceIds);
  const coverId = input.coverInstitutionId ?? null;
  if (coverId) await ensureValidCover(coverId, new Set(spaceIds));

  let tag: Tag;
  try {
    tag = await prisma.tag.create({
      data: {
        name,
        label,
        category: input.category ?? TagCategory.STYLE,
        ...(spaceIds.length > 0 && {
          institutions: { connect: spaceIds.map((id) => ({ id })) },
        }),
        ...(coverId && { coverInstitutionId: coverId }),
      },
    });
  } catch (err) {
    return rethrowDuplicate(err, label);
  }

  await auditLog(actorId, AuditAction.CREATE, TargetModel.TAG, tag.id, {
    name: tag.name,
    label: tag.label,
    ...(spaceIds.length > 0 && { spaces: spaceIds.length }),
    ...(coverId && { coverInstitutionId: coverId }),
  });
  await invalidateInstitutionCache();
  return tag;
};

export const update = async (
  actorId: string,
  id: string,
  input: UpdateTagInput,
): Promise<Tag> => {
  const current = await prisma.tag.findUnique({
    where: { id },
    include: { institutions: { select: { id: true } } },
  });
  if (!current) throw NotFoundError('Tag');

  // The slug only changes when a caller explicitly sends one: the home page
  // finds its six cards by name, so renaming the label must not move it.
  const name = input.name !== undefined ? slugOrThrow(input.name) : current.name;
  const label = input.label ?? current.label;
  if (name !== current.name || label !== current.label) await ensureNoClash(name, label, id);

  const before = new Set(current.institutions.map((s) => s.id));
  const after = new Set(input.institutionIds ?? before);
  if (input.institutionIds) await ensureSpacesExist(input.institutionIds);

  // An explicit choice is validated; an untouched cover whose space was just
  // unlinked falls back to automatic rather than pointing outside the tag.
  let coverId = current.coverInstitutionId;
  if (input.coverInstitutionId !== undefined) {
    coverId = input.coverInstitutionId;
    if (coverId) await ensureValidCover(coverId, after);
  } else if (coverId && !after.has(coverId)) {
    coverId = null;
  }

  let tag: Tag;
  try {
    tag = await prisma.tag.update({
      where: { id },
      data: {
        ...(name !== current.name && { name }),
        ...(label !== current.label && { label }),
        ...(input.category !== undefined && { category: input.category }),
        ...(input.institutionIds && {
          institutions: { set: input.institutionIds.map((sid) => ({ id: sid })) },
        }),
        ...(coverId !== current.coverInstitutionId && { coverInstitutionId: coverId }),
      },
    });
  } catch (err) {
    return rethrowDuplicate(err, label);
  }

  const linked = [...after].filter((s) => !before.has(s)).length;
  const unlinked = [...before].filter((s) => !after.has(s)).length;
  await auditLog(actorId, AuditAction.UPDATE, TargetModel.TAG, id, {
    name: tag.name,
    fields: Object.keys(input),
    ...(input.institutionIds && { linked, unlinked, spaces: after.size }),
    ...(coverId !== current.coverInstitutionId && { coverInstitutionId: coverId }),
  });
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
