import { ApprovalStatus } from '@prisma/client';
import prisma from '../config/db';

export interface DashboardCounts {
  institutions: {
    total: number;
    published: number;
    drafts: number;
  };
  pendingSubmissions: number;
  admins: number;
}

/** Aggregate counts for the admin dashboard (Guide §3.3). */
export const getCounts = async (): Promise<DashboardCounts> => {
  const [total, published, pendingSubmissions, admins] = await Promise.all([
    prisma.institution.count({ where: { deletedAt: null } }),
    prisma.institution.count({ where: { isPublished: true, deletedAt: null } }),
    prisma.institution.count({
      where: { approvalStatus: ApprovalStatus.PENDING, deletedAt: null },
    }),
    prisma.user.count(),
  ]);

  return {
    institutions: {
      total,
      published,
      drafts: total - published,
    },
    pendingSubmissions,
    admins,
  };
};
