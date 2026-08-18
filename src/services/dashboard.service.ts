import { ApprovalStatus, Role } from '@prisma/client';
import prisma from '../config/db';

const STAFF_ROLES: Role[] = [Role.SUPER_ADMIN, Role.ADMIN];

// The dashboard's "recent additions" panel needs just enough per row to
// identify the institution and where it stands — not the full record.
export interface RecentInstitution {
  id: string;
  name: string;
  type: string;
  area: string | null;
  isPublished: boolean;
  createdAt: Date;
}

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
  // Breakdowns for the dashboard's distribution panels. Zero-count types/areas
  // are omitted (groupBy only returns rows that exist) — the UI treats an
  // absent entry as 0 rather than requiring a padded fixed-length array here.
  byType: { type: string; count: number }[];
  byArea: { area: string; count: number }[];
  recent: RecentInstitution[];
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
    byTypeRaw,
    byAreaRaw,
    recent,
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
    prisma.institution.groupBy({
      by: ['type'],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    prisma.institution.groupBy({
      by: ['area'],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    prisma.institution.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, name: true, type: true, area: true, isPublished: true, createdAt: true },
    }),
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
    byType: byTypeRaw
      .map((row) => ({ type: row.type, count: row._count._all }))
      .sort((a, b) => b.count - a.count),
    // Institutions with no area recorded fall under "OTHER" rather than a
    // separate null bucket — the public filter already treats them the same
    // way. groupBy can return both a real 'OTHER' group and a null group, so
    // merge by label instead of assuming one row per label.
    byArea: Array.from(
      byAreaRaw
        .reduce((acc, row) => {
          const label = row.area ?? 'OTHER';
          acc.set(label, (acc.get(label) ?? 0) + row._count._all);
          return acc;
        }, new Map<string, number>())
        .entries(),
    )
      .map(([area, count]) => ({ area, count }))
      .sort((a, b) => b.count - a.count),
    recent,
  };
};
