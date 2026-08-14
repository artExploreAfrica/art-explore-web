/**
 * Regressions for defects found in the backend audit. Each test here failed
 * against the pre-fix code — they exist to keep these from coming back.
 */
import { Role } from '@prisma/client';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bearer, signAccess, stubActiveUser } from './helpers';

const mocks = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn() },
    institution: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), count: vi.fn() },
    exhibition: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  },
  redis: { scan: vi.fn(), del: vi.fn(), get: vi.fn(), set: vi.fn() },
}));

vi.mock('../src/config/db', () => ({ default: mocks.prisma }));
vi.mock('../src/config/redis', () => ({ redis: mocks.redis }));

import app from '../src/app';

const adminToken = bearer(signAccess(Role.ADMIN, 'admin_1'));

const exhibition = {
  id: 'ex_1',
  institutionId: 'inst_1',
  name: 'Spring Show',
  images: [],
  startDate: new Date('2026-07-01'),
  endDate: new Date('2026-07-10'),
  startTime: '10:00',
  endTime: '18:00',
  link: null,
  description: null,
  approvalStatus: 'APPROVED',
  submittedById: 'admin_1',
  approvedById: 'admin_1',
  approvedAt: new Date(),
  reviewNote: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  stubActiveUser(mocks.prisma.user.findUnique, Role.ADMIN, { id: 'admin_1' });
  mocks.redis.scan.mockResolvedValue(['0', []]);
  mocks.redis.del.mockResolvedValue(0);
  mocks.redis.get.mockResolvedValue(null);
  mocks.redis.set.mockResolvedValue('OK');
  mocks.prisma.auditLog.create.mockResolvedValue({});
});

describe('deactivating an exhibition recomputes hasExhibition', () => {
  it('sets hasExhibition=false when the last live exhibition is switched off', async () => {
    mocks.prisma.exhibition.findFirst.mockResolvedValue(exhibition);
    mocks.prisma.exhibition.update.mockResolvedValue({ ...exhibition, isActive: false });
    mocks.prisma.exhibition.count.mockResolvedValue(0);
    mocks.prisma.institution.update.mockResolvedValue({});

    const res = await request(app)
      .post('/api/v1/admin/institutions/inst_1/exhibitions/ex_1/activate')
      .set(adminToken)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    // Previously setActive skipped the recompute entirely, so the venue kept
    // advertising an exhibition that was no longer showing.
    expect(mocks.prisma.institution.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { hasExhibition: false } }),
    );
  });

  it('counts only approved, active, unfinished exhibitions', async () => {
    mocks.prisma.exhibition.findFirst.mockResolvedValue(exhibition);
    mocks.prisma.exhibition.update.mockResolvedValue(exhibition);
    mocks.prisma.exhibition.count.mockResolvedValue(1);
    mocks.prisma.institution.update.mockResolvedValue({});

    await request(app)
      .post('/api/v1/admin/institutions/inst_1/exhibitions/ex_1/activate')
      .set(adminToken)
      .send({ isActive: true });

    const where = mocks.prisma.exhibition.count.mock.calls[0][0].where;
    expect(where).toMatchObject({ approvalStatus: 'APPROVED', isActive: true });
    expect(where.endDate).toHaveProperty('gte');
  });
});

describe('upload failures are client errors, not 500s', () => {
  beforeEach(() => {
    mocks.prisma.institution.findFirst.mockResolvedValue({ id: 'inst_1', images: [] });
  });

  it('400s on a non-image file', async () => {
    const res = await request(app)
      .post('/api/v1/admin/institutions/inst_1/images')
      .set(adminToken)
      .attach('image', Buffer.from('not an image'), {
        filename: 'evil.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('413s on a file over the 5 MB limit', async () => {
    const res = await request(app)
      .post('/api/v1/admin/institutions/inst_1/images')
      .set(adminToken)
      .attach('image', Buffer.alloc(6 * 1024 * 1024, 1), {
        filename: 'big.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(413);
    expect(res.body.errors).toMatchObject({ code: 'LIMIT_FILE_SIZE' });
  });

  it('400s on the wrong multipart field name', async () => {
    const res = await request(app)
      .post('/api/v1/admin/institutions/inst_1/images')
      .set(adminToken)
      .attach('photo', Buffer.from([0xff, 0xd8, 0xff]), {
        filename: 'a.jpg',
        contentType: 'image/jpeg',
      });

    expect(res.status).toBe(400);
    expect(res.body.errors).toMatchObject({ code: 'LIMIT_UNEXPECTED_FILE' });
  });
});

describe('approving a submission drops the public cache', () => {
  it('invalidates so an already-published venue appears immediately', async () => {
    mocks.prisma.institution.findFirst.mockResolvedValue({
      id: 'inst_1',
      name: 'Gallery',
      submittedBy: null,
    });
    mocks.prisma.institution.update.mockResolvedValue({ id: 'inst_1' });

    const res = await request(app)
      .post('/api/v1/admin/institutions/inst_1/approve')
      .set(adminToken)
      .send();

    expect(res.status).toBe(200);
    // reject() always invalidated; approve() used to skip it.
    expect(mocks.redis.scan).toHaveBeenCalled();
  });
});

describe('public exhibition reads agree with hasExhibition', () => {
  it('defaults to live only — a finished run is excluded', async () => {
    mocks.prisma.institution.findFirst.mockResolvedValue({ id: 'inst_1' });
    mocks.prisma.exhibition.findMany.mockResolvedValue([]);
    mocks.prisma.exhibition.count.mockResolvedValue(0);

    const res = await request(app).get('/api/v1/institutions/inst_1/exhibitions');

    expect(res.status).toBe(200);
    const where = mocks.prisma.exhibition.findMany.mock.calls[0][0].where;
    expect(where.endDate).toHaveProperty('gte');
  });

  it('scope=past flips the date filter for archive views', async () => {
    mocks.prisma.institution.findFirst.mockResolvedValue({ id: 'inst_1' });
    mocks.prisma.exhibition.findMany.mockResolvedValue([]);
    mocks.prisma.exhibition.count.mockResolvedValue(0);

    await request(app).get('/api/v1/institutions/inst_1/exhibitions?scope=past');

    const where = mocks.prisma.exhibition.findMany.mock.calls[0][0].where;
    expect(where.endDate).toHaveProperty('lt');
  });

  it('scope=all applies no date filter', async () => {
    mocks.prisma.institution.findFirst.mockResolvedValue({ id: 'inst_1' });
    mocks.prisma.exhibition.findMany.mockResolvedValue([]);
    mocks.prisma.exhibition.count.mockResolvedValue(0);

    await request(app).get('/api/v1/institutions/inst_1/exhibitions?scope=all');

    const where = mocks.prisma.exhibition.findMany.mock.calls[0][0].where;
    expect(where.endDate).toBeUndefined();
  });
});

describe("GET /api/v1/exhibitions — cross-venue what's on", () => {
  it('returns live exhibitions at publicly visible venues only', async () => {
    mocks.prisma.exhibition.findMany.mockResolvedValue([]);
    mocks.prisma.exhibition.count.mockResolvedValue(0);

    const res = await request(app).get('/api/v1/exhibitions?area=ISLAND');

    expect(res.status).toBe(200);
    const where = mocks.prisma.exhibition.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ approvalStatus: 'APPROVED', isActive: true });
    expect(where.institution).toMatchObject({
      isPublished: true,
      deletedAt: null,
      approvalStatus: 'APPROVED',
      area: 'ISLAND',
    });
  });

  it('rejects an unknown area rather than ignoring it', async () => {
    const res = await request(app).get('/api/v1/exhibitions?area=MARS');
    expect(res.status).toBe(400);
  });
});

describe('logout only revokes a session the caller actually holds', () => {
  it('does not delete the stored token when the presented one does not match', async () => {
    const jwt = await import('jsonwebtoken');
    const stale = jwt.default.sign(
      { sub: 'user_1', email: 'u@test.dev', role: 'USER' },
      process.env.JWT_REFRESH_SECRET as string,
      { expiresIn: '7d' },
    );

    // A hash of some *other* token — i.e. the live session belongs elsewhere.
    const bcrypt = await import('bcryptjs');
    mocks.redis.get.mockResolvedValue(await bcrypt.default.hash('a-different-token', 4));

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .send({ refreshToken: stale });

    // Still 200 — the caller must not learn whether the token was current.
    expect(res.status).toBe(200);
    // But the live session survives; previously any valid JWT killed it.
    expect(mocks.redis.del).not.toHaveBeenCalled();
  });

  it('revokes when the presented token is the stored one', async () => {
    const jwt = await import('jsonwebtoken');
    const current = jwt.default.sign(
      { sub: 'user_1', email: 'u@test.dev', role: 'USER' },
      process.env.JWT_REFRESH_SECRET as string,
      { expiresIn: '7d' },
    );

    const bcrypt = await import('bcryptjs');
    mocks.redis.get.mockResolvedValue(await bcrypt.default.hash(current, 4));

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .send({ refreshToken: current });

    expect(res.status).toBe(200);
    expect(mocks.redis.del).toHaveBeenCalledWith('refresh:user_1');
  });
});

describe('soft-delete restore', () => {
  it('restores without republishing', async () => {
    mocks.prisma.institution.findUnique.mockResolvedValue({
      id: 'inst_1',
      name: 'Gallery',
      deletedAt: new Date(),
    });
    mocks.prisma.institution.update.mockResolvedValue({ id: 'inst_1', name: 'Gallery' });

    const res = await request(app)
      .post('/api/v1/admin/institutions/inst_1/restore')
      .set(adminToken)
      .send();

    expect(res.status).toBe(200);
    const data = mocks.prisma.institution.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ deletedAt: null });
    // Restoring is not republishing — that stays a separate decision.
    expect(data).not.toHaveProperty('isPublished');
    expect(mocks.prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: 'RESTORE',
    });
  });

  it('400s when the record was never deleted', async () => {
    mocks.prisma.institution.findUnique.mockResolvedValue({
      id: 'inst_1',
      deletedAt: null,
    });

    const res = await request(app)
      .post('/api/v1/admin/institutions/inst_1/restore')
      .set(adminToken)
      .send();

    expect(res.status).toBe(400);
    expect(mocks.prisma.institution.update).not.toHaveBeenCalled();
  });

  it('admin list can surface deleted rows so they can be found', async () => {
    mocks.prisma.institution.findMany = vi.fn().mockResolvedValue([]);
    mocks.prisma.institution.count.mockResolvedValue(0);

    await request(app).get('/api/v1/admin/institutions?deleted=true').set(adminToken);

    const where = mocks.prisma.institution.findMany.mock.calls[0][0].where;
    expect(where.deletedAt).toMatchObject({ not: null });
  });
});
