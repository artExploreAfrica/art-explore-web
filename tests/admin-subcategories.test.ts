import { Role } from '@prisma/client';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bearer, signAccess } from './helpers';

const mocks = vi.hoisted(() => ({
  prisma: {
    subCategory: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    institution: { count: vi.fn() },
    auditLog: { create: vi.fn() },
  },
  redis: { scan: vi.fn(), del: vi.fn() },
}));

vi.mock('../src/config/db', () => ({ default: mocks.prisma }));
vi.mock('../src/config/redis', () => ({ redis: mocks.redis }));

import app from '../src/app';

const adminToken = bearer(signAccess(Role.ADMIN, 'admin_1'));
const userToken = bearer(signAccess(Role.USER, 'user_1'));

const stored = {
  id: 'sc_1',
  name: 'Contemporary',
  type: 'GALLERY',
  description: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.redis.scan.mockResolvedValue(['0', []]);
  mocks.redis.del.mockResolvedValue(0);
  mocks.prisma.auditLog.create.mockResolvedValue({});
});

describe('POST /api/v1/admin/subcategories', () => {
  it('403s for a USER role', async () => {
    const res = await request(app)
      .post('/api/v1/admin/subcategories')
      .set(userToken)
      .send({ name: 'Contemporary', type: 'GALLERY' });

    expect(res.status).toBe(403);
  });

  it('201s and writes a CREATE audit log', async () => {
    mocks.prisma.subCategory.create.mockResolvedValue(stored);

    const res = await request(app)
      .post('/api/v1/admin/subcategories')
      .set(adminToken)
      .send({ name: 'Contemporary', type: 'GALLERY' });

    expect(res.status).toBe(201);
    expect(mocks.prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: 'CREATE',
      targetModel: 'SUBCATEGORY',
      targetId: 'sc_1',
    });
  });
});

describe('DELETE /api/v1/admin/subcategories/:id', () => {
  it('409s when institutions still reference it', async () => {
    mocks.prisma.subCategory.findUnique.mockResolvedValue(stored);
    mocks.prisma.institution.count.mockResolvedValue(3);

    const res = await request(app)
      .delete('/api/v1/admin/subcategories/sc_1')
      .set(adminToken);

    expect(res.status).toBe(409);
    expect(mocks.prisma.subCategory.delete).not.toHaveBeenCalled();
  });

  it('200s and logs DELETE when unused', async () => {
    mocks.prisma.subCategory.findUnique.mockResolvedValue(stored);
    mocks.prisma.institution.count.mockResolvedValue(0);
    mocks.prisma.subCategory.delete.mockResolvedValue(stored);

    const res = await request(app)
      .delete('/api/v1/admin/subcategories/sc_1')
      .set(adminToken);

    expect(res.status).toBe(200);
    expect(mocks.prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: 'DELETE',
      targetModel: 'SUBCATEGORY',
    });
  });
});

describe('GET /api/v1/subcategories (public)', () => {
  it('200s without auth', async () => {
    mocks.prisma.subCategory.findMany.mockResolvedValue([stored]);
    mocks.prisma.subCategory.count.mockResolvedValue(1);

    const res = await request(app).get('/api/v1/subcategories');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});
