import { Prisma } from '@prisma/client';
import prisma from '../config/db';
import { PaginationMeta } from '../utils/response';
import { AuditLogQuery } from '../validators/audit.validator';

type AuditLogWithActor = Prisma.AuditLogGetPayload<{
  include: { actor: { select: { id: true; fullName: true; email: true } } };
}>;

interface ListResult {
  data: AuditLogWithActor[];
  pagination: PaginationMeta;
}

/**
 * Paginated audit trail, newest first, with the acting admin attached.
 * Optionally filtered by actor, action, target model, and timestamp range.
 */
export const list = async (query: AuditLogQuery): Promise<ListResult> => {
  const { page, limit, actorId, action, targetModel, from, to } = query;

  const where: Prisma.AuditLogWhereInput = {
    ...(actorId && { actorId }),
    ...(action && { action }),
    ...(targetModel && { targetModel }),
    ...((from || to) && {
      timestamp: { ...(from && { gte: from }), ...(to && { lte: to }) },
    }),
  };

  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { actor: { select: { id: true, fullName: true, email: true } } },
      orderBy: { timestamp: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
  };
};
