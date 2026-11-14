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
  subArea: string | null;
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
  // Breakdowns for the dashboard's distribution panels. Zero-count types/sub-areas
  // are omitted (groupBy only returns rows that exist) — the UI treats an
  // absent entry as 0 rather than requiring a padded fixed-length array here.
  byType: { type: string; count: number }[];
  bySubArea: { subArea: string | null; count: number }[];
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
    bySubAreaRaw,
    recent,
  ] = await Promise.all([
    prisma.institution.count({ where: { deletedAt: null } }),
    prisma.institution.count({ where: { isPublished: true, deletedAt: null } }),
    // Every PENDING row is waiting on review — including suggestions from the
    // public form, which have no submitter account (only review produces PENDING).
    prisma.institution.count({
      where: { approvalStatus: ApprovalStatus.PENDING, deletedAt: null },
    }),
    // Contributor queues, so the dashboard shows every kind of work waiting.
    prisma.exhibition.count({ where: { approvalStatus: ApprovalStatus.PENDING } }),
    prisma.review.count({ where: { approvalStatus: ApprovalStatus.PENDING } }),
    prisma.user.count({ where: { role: { in: STAFF_ROLES } } }),
    prisma.user.count({ where: { role: Role.USER } }),
    prisma.institution.groupBy({
      by: ['type'],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    prisma.institution.groupBy({
      by: ['subArea'],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    prisma.institution.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        name: true,
        type: true,
        area: true,
        subArea: true,
        isPublished: true,
        createdAt: true,
      },
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
    // Grouped by neighbourhood (sub-area) rather than Island/Mainland, which
    // was too coarse to be useful. Spellings are free text, so they're merged
    // case- and space-insensitively; rows with none recorded land in a
    // `null` bucket that the panel shows as "Not set".
    bySubArea: Array.from(
      bySubAreaRaw
        .reduce((acc, row) => {
          const name = row.subArea?.trim() || null;
          const key = name?.toLowerCase() ?? '';
          const entry = acc.get(key) ?? { subArea: name, count: 0 };
          entry.count += row._count._all;
          acc.set(key, entry);
          return acc;
        }, new Map<string, { subArea: string | null; count: number }>())
        .values(),
    ).sort((a, b) => b.count - a.count),
    recent,
  };
};
