import prisma from '../config/db';

export interface DashboardCounts {
  institutions: {
    total: number;
    published: number;
    drafts: number;
  };
  admins: number;
}

/** Aggregate counts for the admin dashboard (Guide §3.3). */
export const getCounts = async (): Promise<DashboardCounts> => {
  const [total, published, admins] = await Promise.all([
    prisma.institution.count(),
    prisma.institution.count({ where: { isPublished: true } }),
    prisma.user.count(),
  ]);

  return {
    institutions: {
      total,
      published,
      drafts: total - published,
    },
    admins,
  };
};
