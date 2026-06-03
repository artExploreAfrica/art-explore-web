import { Prisma } from '@prisma/client';
import prisma from '../config/db';
import { PaginationMeta } from '../utils/response';
import { PaginationQuery } from '../validators/user.validator';

type AuditLogWithActor = Prisma.AuditLogGetPayload<{
  include: { actor: { select: { id: true; fullName: true; email: true } } };
}>;

interface ListResult {
  data: AuditLogWithActor[];
  pagination: PaginationMeta;
}

/** Paginated audit trail, newest first, with the acting admin attached. */
export const list = async (query: PaginationQuery): Promise<ListResult> => {
  const { page, limit } = query;

  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      include: { actor: { select: { id: true, fullName: true, email: true } } },
      orderBy: { timestamp: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count(),
  ]);

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
  };
};
