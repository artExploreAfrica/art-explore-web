import { Role } from '@prisma/client';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bearer, signAccess, stubActiveUser } from './helpers';

const mocks = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn(), count: vi.fn() },
    institution: { count: vi.fn(), groupBy: vi.fn(), findMany: vi.fn() },
    exhibition: { count: vi.fn() },
    review: { count: vi.fn() },
  },
  redis: { scan: vi.fn(), del: vi.fn() },
}));

vi.mock('../src/config/db', () => ({ default: mocks.prisma }));
vi.mock('../src/config/redis', () => ({ redis: mocks.redis }));

import app from '../src/app';

const adminToken = bearer(signAccess(Role.ADMIN, 'admin_1'));

beforeEach(() => {
  vi.clearAllMocks();
  stubActiveUser(mocks.prisma.user.findUnique, Role.ADMIN, { id: 'admin_1' });
  mocks.prisma.institution.count.mockResolvedValue(0);
  mocks.prisma.exhibition.count.mockResolvedValue(0);
  mocks.prisma.review.count.mockResolvedValue(0);
  mocks.prisma.user.count.mockResolvedValue(0);
  mocks.prisma.institution.findMany.mockResolvedValue([]);
  mocks.prisma.institution.groupBy.mockImplementation(({ by }: { by: string[] }) =>
    Promise.resolve(
      by[0] === 'type'
        ? [{ type: 'ART_GALLERY', _count: { _all: 3 } }]
        : [
            { subArea: 'Ikoyi', _count: { _all: 4 } },
            { subArea: 'ikoyi ', _count: { _all: 1 } }, // same place, different spelling
            { subArea: 'Yaba', _count: { _all: 2 } },
            { subArea: null, _count: { _all: 3 } },
          ],
    ),
  );
});

describe('GET /api/v1/admin/dashboard', () => {
  it('breaks listings down by sub-area, merging spellings, with a "not set" bucket', async () => {
    const res = await request(app).get('/api/v1/admin/dashboard').set(adminToken);

    expect(res.status).toBe(200);
    expect(mocks.prisma.institution.groupBy.mock.calls[1][0].by).toEqual(['subArea']);
    expect(res.body.data.bySubArea).toEqual([
      { subArea: 'Ikoyi', count: 5 },
      { subArea: null, count: 3 },
      { subArea: 'Yaba', count: 2 },
    ]);
    expect(res.body.data).not.toHaveProperty('byArea');
  });

  it('counts every pending submission, including public-form ones', async () => {
    await request(app).get('/api/v1/admin/dashboard').set(adminToken);

    // [total, published, pending]: the pending count has no submitter filter.
    expect(mocks.prisma.institution.count.mock.calls[2][0].where).toEqual({
      approvalStatus: 'PENDING',
      deletedAt: null,
    });
    expect(mocks.prisma.exhibition.count.mock.calls[0][0].where).toEqual({
      approvalStatus: 'PENDING',
    });
  });
});
