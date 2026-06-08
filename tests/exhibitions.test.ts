import { Role } from '@prisma/client';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bearer, signAccess } from './helpers';

const mocks = vi.hoisted(() => ({
  prisma: {
    institution: { findFirst: vi.fn(), update: vi.fn() },
    exhibition: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  },
  redis: { scan: vi.fn(), del: vi.fn() },
}));

vi.mock('../src/config/db', () => ({ default: mocks.prisma }));
vi.mock('../src/config/redis', () => ({ redis: mocks.redis }));

import app from '../src/app';

const adminToken = bearer(signAccess(Role.ADMIN, 'admin_1'));

const exhibition = {
  id: 'ex_1',
  institutionId: 'inst_1',
  title: 'Spring Show',
  date: new Date('2026-07-01'),
  endDate: null,
  time: null,
  image: null,
  socialLink: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.redis.scan.mockResolvedValue(['0', []]);
  mocks.redis.del.mockResolvedValue(0);
  mocks.prisma.auditLog.create.mockResolvedValue({});
});

describe('POST /api/v1/admin/institutions/:id/exhibitions', () => {
  it('404s when the institution is missing', async () => {
    mocks.prisma.institution.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/admin/institutions/inst_1/exhibitions')
      .set(adminToken)
      .send({ title: 'Spring Show', date: '2026-07-01' });

    expect(res.status).toBe(404);
    expect(mocks.prisma.exhibition.create).not.toHaveBeenCalled();
  });

  it('201s, recomputes hasActiveExhibition, and logs CREATE', async () => {
    mocks.prisma.institution.findFirst.mockResolvedValue({ id: 'inst_1' });
    mocks.prisma.exhibition.create.mockResolvedValue(exhibition);
    mocks.prisma.exhibition.count.mockResolvedValue(1);
    mocks.prisma.institution.update.mockResolvedValue({});

    const res = await request(app)
      .post('/api/v1/admin/institutions/inst_1/exhibitions')
      .set(adminToken)
      .send({ title: 'Spring Show', date: '2026-07-01' });

    expect(res.status).toBe(201);
    // hasActiveExhibition recomputed from the exhibition count.
    expect(mocks.prisma.institution.update.mock.calls[0][0].data).toMatchObject({
      hasActiveExhibition: true,
    });
    expect(mocks.prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: 'CREATE',
      targetModel: 'EXHIBITION',
      targetId: 'ex_1',
    });
  });
});

describe('GET /api/v1/institutions/:id/exhibitions (public)', () => {
  it('404s for an unpublished/unapproved institution', async () => {
    mocks.prisma.institution.findFirst.mockResolvedValue(null);

    const res = await request(app).get('/api/v1/institutions/inst_1/exhibitions');

    expect(res.status).toBe(404);
  });

  it('200s and returns exhibitions for a published institution', async () => {
    mocks.prisma.institution.findFirst.mockResolvedValue({ id: 'inst_1' });
    mocks.prisma.exhibition.findMany.mockResolvedValue([exhibition]);

    const res = await request(app).get('/api/v1/institutions/inst_1/exhibitions');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});
