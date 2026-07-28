import { Role } from '@prisma/client';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bearer, signAccess, stubActiveUser } from './helpers';

const mocks = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn() },
    institution: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  },
  redis: { scan: vi.fn(), del: vi.fn() },
}));

vi.mock('../src/config/db', () => ({ default: mocks.prisma }));
vi.mock('../src/config/redis', () => ({ redis: mocks.redis }));

import app from '../src/app';

const validBody = {
  name: 'New Gallery',
  type: 'ART_GALLERY',
  address: '1 Test St',
  area: 'ISLAND',
  lat: 6.45,
  lng: 3.4,
};

const stored = {
  id: 'inst_1',
  ...validBody,
  description: null,
  images: [],
  website: null,
  phone: null,
  email: null,
  openingHours: null,
  tags: [],
  isPublished: false,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const adminToken = bearer(signAccess(Role.ADMIN, 'admin_1'));

beforeEach(() => {
  vi.clearAllMocks();
  stubActiveUser(mocks.prisma.user.findUnique, Role.ADMIN, { id: 'admin_1' });
  mocks.redis.scan.mockResolvedValue(['0', []]);
  mocks.redis.del.mockResolvedValue(0);
  mocks.prisma.auditLog.create.mockResolvedValue({});
});

describe('POST /api/v1/admin/institutions', () => {
  it('401s without a token', async () => {
    const res = await request(app).post('/api/v1/admin/institutions').send(validBody);
    expect(res.status).toBe(401);
  });

  it('400s on an invalid body', async () => {
    const res = await request(app)
      .post('/api/v1/admin/institutions')
      .set(adminToken)
      .send({ name: 'Missing the rest' });

    expect(res.status).toBe(400);
  });

  it('201s and writes a CREATE audit log on a valid body', async () => {
    mocks.prisma.institution.create.mockResolvedValue(stored);

    const res = await request(app)
      .post('/api/v1/admin/institutions')
      .set(adminToken)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe('inst_1');
    expect(mocks.prisma.auditLog.create).toHaveBeenCalledOnce();
    expect(mocks.prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: 'CREATE',
      targetModel: 'INSTITUTION',
      targetId: 'inst_1',
    });
  });
});

describe('GET /api/v1/admin/institutions', () => {
  it('lists drafts and unpublished venues', async () => {
    mocks.prisma.institution.findMany.mockResolvedValue([stored]);
    mocks.prisma.institution.count.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/v1/admin/institutions?isPublished=false')
      .set(adminToken);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    const whereArg = mocks.prisma.institution.findMany.mock.calls[0][0].where;
    expect(whereArg.isPublished).toBe(false);
    expect(whereArg.deletedAt).toBeNull();
  });

  it('returns admin detail for an unpublished venue', async () => {
    mocks.prisma.institution.findFirst.mockResolvedValue(stored);

    const res = await request(app)
      .get('/api/v1/admin/institutions/inst_1')
      .set(adminToken);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('inst_1');
  });
});

describe('DELETE /api/v1/admin/institutions/:id', () => {
  it('soft-deletes by stamping deletedAt and logs DELETE', async () => {
    mocks.prisma.institution.findFirst.mockResolvedValue(stored);
    mocks.prisma.institution.update.mockResolvedValue({ ...stored, deletedAt: new Date() });

    const res = await request(app)
      .delete('/api/v1/admin/institutions/inst_1')
      .set(adminToken);

    expect(res.status).toBe(200);
    const updateData = mocks.prisma.institution.update.mock.calls[0][0].data;
    expect(updateData.deletedAt).toBeInstanceOf(Date);
    expect(updateData.isPublished).toBe(false);
    expect(mocks.prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: 'DELETE',
      targetModel: 'INSTITUTION',
    });
  });

  it('404s (and writes no audit log) when the institution is already deleted', async () => {
    mocks.prisma.institution.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .delete('/api/v1/admin/institutions/gone')
      .set(adminToken);

    expect(res.status).toBe(404);
    expect(mocks.prisma.institution.update).not.toHaveBeenCalled();
    expect(mocks.prisma.auditLog.create).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/admin/institutions/:id/publish', () => {
  it('publishes a draft and logs PUBLISH', async () => {
    mocks.prisma.institution.findFirst.mockResolvedValue({ ...stored, isPublished: false });
    mocks.prisma.institution.update.mockResolvedValue({ ...stored, isPublished: true });

    const res = await request(app)
      .post('/api/v1/admin/institutions/inst_1/publish')
      .set(adminToken);

    expect(res.status).toBe(200);
    expect(res.body.data.isPublished).toBe(true);
    expect(mocks.prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: 'PUBLISH',
    });
  });
});

describe('PUT /api/v1/admin/institutions/:id', () => {
  it('updates fields and logs UPDATE', async () => {
    mocks.prisma.institution.findFirst.mockResolvedValue(stored);
    mocks.prisma.institution.update.mockResolvedValue({ ...stored, name: 'Renamed' });

    const res = await request(app)
      .put('/api/v1/admin/institutions/inst_1')
      .set(adminToken)
      .send({ name: 'Renamed' });

    expect(res.status).toBe(200);
    expect(mocks.prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: 'UPDATE',
    });
  });
});
