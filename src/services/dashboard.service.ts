import { ApprovalStatus, Role } from '@prisma/client';
import prisma from '../config/db';

const STAFF_ROLES: Role[] = [Role.SUPER_ADMIN, Role.ADMIN];

export interface DashboardCounts {
  institutions: {
    total: number;
    published: number;
    drafts: number;
  };
  pendingSubmissions: number;
  pendingExhibitions: number;
  pendingReviews: number;
  admins: number;
  publicUsers: number;
}

/** Aggregate counts for the admin dashboard (Guide §3.3). */
export const getCounts = async (): Promise<DashboardCounts> => {
  const [
    total,
    published,
    pendingSubmissions,
    pendingExhibitions,
    pendingReviews,
    admins,
    publicUsers,
  ] = await Promise.all([
    prisma.institution.count({ where: { deletedAt: null } }),
    prisma.institution.count({ where: { isPublished: true, deletedAt: null } }),
    prisma.institution.count({
      where: {
        approvalStatus: ApprovalStatus.PENDING,
        deletedAt: null,
        submittedById: { not: null },
      },
    }),
    // Contributor queues, so the dashboard shows every kind of work waiting.
    prisma.exhibition.count({
      where: {
        approvalStatus: ApprovalStatus.PENDING,
        submittedById: { not: null },
      },
    }),
    prisma.review.count({ where: { approvalStatus: ApprovalStatus.PENDING } }),
    prisma.user.count({ where: { role: { in: STAFF_ROLES } } }),
    prisma.user.count({ where: { role: Role.USER } }),
  ]);

  return {
    institutions: {
      total,
      published,
      drafts: total - published,
    },
    pendingSubmissions,
    pendingExhibitions,
    pendingReviews,
    admins,
    publicUsers,
  };
};
