import { Role } from '@prisma/client';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bearer, signAccess, stubActiveUser } from './helpers';

const mocks = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn() },
    institution: { findFirst: vi.fn(), update: vi.fn() },
    exhibition: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  },
  redis: { scan: vi.fn(), del: vi.fn() },
}));

vi.mock('../src/config/db', () => ({ default: mocks.prisma }));
vi.mock('../src/config/redis', () => ({ redis: mocks.redis }));

import app from '../src/app';

const userToken = bearer(signAccess(Role.USER, 'user_1'));
const adminToken = bearer(signAccess(Role.ADMIN, 'admin_1'));

const pending = {
  id: 'ex_1',
  institutionId: 'inst_1',
  name: 'Contributor Show',
  images: [],
  startDate: new Date('2026-09-01'),
  endDate: new Date('2026-09-30'),
  startTime: '10:00',
  endTime: '18:00',
  link: null,
  description: null,
  approvalStatus: 'PENDING',
  submittedById: 'user_1',
  approvedById: null,
  approvedAt: null,
  reviewNote: null,
  isActive: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  submittedBy: { email: 'contributor@test.dev', fullName: 'Ada Contributor' },
};

const validBody = {
  institutionId: 'inst_1',
  name: 'Contributor Show',
  startDate: '2026-09-01',
  endDate: '2026-09-30',
  startTime: '10:00',
  endTime: '18:00',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.redis.scan.mockResolvedValue(['0', []]);
  mocks.redis.del.mockResolvedValue(0);
  mocks.prisma.auditLog.create.mockResolvedValue({});
  mocks.prisma.exhibition.count.mockResolvedValue(0);
  mocks.prisma.institution.update.mockResolvedValue({});
});

describe('POST /api/v1/submissions/exhibitions', () => {
  it('403s for an ADMIN (USER-only route)', async () => {
    stubActiveUser(mocks.prisma.user.findUnique, Role.ADMIN, { id: 'admin_1' });

    const res = await request(app)
      .post('/api/v1/submissions/exhibitions')
      .set(adminToken)
      .send(validBody);

    expect(res.status).toBe(403);
    expect(mocks.prisma.exhibition.create).not.toHaveBeenCalled();
  });

  it('404s when the venue is not publicly visible', async () => {
    stubActiveUser(mocks.prisma.user.findUnique, Role.USER, { id: 'user_1' });
    mocks.prisma.institution.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/submissions/exhibitions')
      .set(userToken)
      .send(validBody);

    expect(res.status).toBe(404);
    expect(mocks.prisma.exhibition.create).not.toHaveBeenCalled();
  });

  it('400s when endDate precedes startDate', async () => {
    stubActiveUser(mocks.prisma.user.findUnique, Role.USER, { id: 'user_1' });

    const res = await request(app)
      .post('/api/v1/submissions/exhibitions')
      .set(userToken)
      .send({ ...validBody, startDate: '2026-09-30', endDate: '2026-09-01' });

    expect(res.status).toBe(400);
    expect(mocks.prisma.exhibition.create).not.toHaveBeenCalled();
  });

  it('201s and forces PENDING + inactive regardless of the request body', async () => {
    stubActiveUser(mocks.prisma.user.findUnique, Role.USER, { id: 'user_1' });
    mocks.prisma.institution.findFirst.mockResolvedValue({ id: 'inst_1' });
    mocks.prisma.exhibition.create.mockResolvedValue(pending);

    const res = await request(app)
      .post('/api/v1/submissions/exhibitions')
      .set(userToken)
      // A caller trying to self-approve must not be able to.
      .send({ ...validBody, approvalStatus: 'APPROVED', isActive: true });

    expect(res.status).toBe(201);
    expect(mocks.prisma.exhibition.create.mock.calls[0][0].data).toMatchObject({
      approvalStatus: 'PENDING',
      isActive: false,
      submittedById: 'user_1',
      institutionId: 'inst_1',
    });
    expect(mocks.prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: 'SUBMIT',
      targetModel: 'EXHIBITION',
    });
  });
});

describe('GET /api/v1/admin/submissions/exhibitions', () => {
  it('lists only user-submitted exhibitions, PENDING by default', async () => {
    stubActiveUser(mocks.prisma.user.findUnique, Role.ADMIN, { id: 'admin_1' });
    mocks.prisma.exhibition.findMany.mockResolvedValue([pending]);
    mocks.prisma.exhibition.count.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/v1/admin/submissions/exhibitions')
      .set(adminToken);

    expect(res.status).toBe(200);
    expect(mocks.prisma.exhibition.findMany.mock.calls[0][0].where).toMatchObject({
      approvalStatus: 'PENDING',
      submittedById: { not: null },
    });
  });
});

describe('POST /api/v1/admin/exhibitions/:id/approve', () => {
  it('404s when the exhibition is missing', async () => {
    stubActiveUser(mocks.prisma.user.findUnique, Role.ADMIN, { id: 'admin_1' });
    mocks.prisma.exhibition.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/admin/exhibitions/ex_1/approve')
      .set(adminToken);

    expect(res.status).toBe(404);
  });

  it('approves, clears the note, and logs APPROVE_EXHIBITION', async () => {
    stubActiveUser(mocks.prisma.user.findUnique, Role.ADMIN, { id: 'admin_1' });
    mocks.prisma.exhibition.findUnique.mockResolvedValue(pending);
    mocks.prisma.exhibition.update.mockResolvedValue({
      ...pending,
      approvalStatus: 'APPROVED',
    });

    const res = await request(app)
      .post('/api/v1/admin/exhibitions/ex_1/approve')
      .set(adminToken);

    expect(res.status).toBe(200);
    expect(mocks.prisma.exhibition.update.mock.calls[0][0].data).toMatchObject({
      approvalStatus: 'APPROVED',
      approvedById: 'admin_1',
      reviewNote: null,
    });
    // Approval alone must not publish it — activation stays a separate step.
    expect(mocks.prisma.exhibition.update.mock.calls[0][0].data).not.toHaveProperty(
      'isActive',
    );
    expect(mocks.prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: 'APPROVE_EXHIBITION',
      targetModel: 'EXHIBITION',
      targetId: 'ex_1',
    });
  });
});

describe('POST /api/v1/admin/exhibitions/:id/reject', () => {
  it('400s without a reviewNote', async () => {
    stubActiveUser(mocks.prisma.user.findUnique, Role.ADMIN, { id: 'admin_1' });

    const res = await request(app)
      .post('/api/v1/admin/exhibitions/ex_1/reject')
      .set(adminToken)
      .send({});

    expect(res.status).toBe(400);
    expect(mocks.prisma.exhibition.update).not.toHaveBeenCalled();
  });

  it('rejects, stores the note, deactivates, and logs REJECT_EXHIBITION', async () => {
    stubActiveUser(mocks.prisma.user.findUnique, Role.ADMIN, { id: 'admin_1' });
    mocks.prisma.exhibition.findUnique.mockResolvedValue(pending);
    mocks.prisma.exhibition.update.mockResolvedValue({
      ...pending,
      approvalStatus: 'REJECTED',
    });

    const res = await request(app)
      .post('/api/v1/admin/exhibitions/ex_1/reject')
      .set(adminToken)
      .send({ reviewNote: 'Dates clash with a listed event' });

    expect(res.status).toBe(200);
    expect(mocks.prisma.exhibition.update.mock.calls[0][0].data).toMatchObject({
      approvalStatus: 'REJECTED',
      isActive: false,
      reviewNote: 'Dates clash with a listed event',
    });
    expect(mocks.prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: 'REJECT_EXHIBITION',
      targetModel: 'EXHIBITION',
    });
  });
});

describe('hasExhibition recompute', () => {
  it('counts only approved, active, unfinished exhibitions', async () => {
    stubActiveUser(mocks.prisma.user.findUnique, Role.ADMIN, { id: 'admin_1' });
    mocks.prisma.exhibition.findUnique.mockResolvedValue(pending);
    mocks.prisma.exhibition.update.mockResolvedValue(pending);

    await request(app).post('/api/v1/admin/exhibitions/ex_1/approve').set(adminToken);

    const where = mocks.prisma.exhibition.count.mock.calls[0][0].where;
    expect(where).toMatchObject({
      institutionId: 'inst_1',
      approvalStatus: 'APPROVED',
      isActive: true,
    });
    // A finished exhibition must stop counting, so the window is bounded by date.
    expect(where.endDate.gte).toBeInstanceOf(Date);
  });
});
