import { Role } from '@prisma/client';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bearer, signAccess } from './helpers';

const mocks = vi.hoisted(() => ({
  prisma: {
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

const userToken = bearer(signAccess(Role.USER, 'user_1'));
const adminToken = bearer(signAccess(Role.ADMIN, 'admin_1'));

const validBody = {
  name: 'Community Gallery',
  type: 'GALLERY',
  address: '5 New St',
  area: 'MAINLAND',
  lat: 6.5,
  lng: 3.35,
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
  subCategoryId: null,
  approvalStatus: 'PENDING',
  submittedById: 'user_1',
  isPublished: false,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.redis.scan.mockResolvedValue(['0', []]);
  mocks.redis.del.mockResolvedValue(0);
  mocks.prisma.auditLog.create.mockResolvedValue({});
});

describe('POST /api/v1/submissions (USER)', () => {
  it('403s for an ADMIN (wrong role)', async () => {
    const res = await request(app)
      .post('/api/v1/submissions')
      .set(adminToken)
      .send(validBody);

    expect(res.status).toBe(403);
  });

  it('201s, creates a PENDING record, and logs SUBMIT', async () => {
    mocks.prisma.institution.create.mockResolvedValue(stored);

    const res = await request(app)
      .post('/api/v1/submissions')
      .set(userToken)
      .send(validBody);

    expect(res.status).toBe(201);
    const createData = mocks.prisma.institution.create.mock.calls[0][0].data;
    expect(createData.approvalStatus).toBe('PENDING');
    expect(createData.isPublished).toBe(false);
    expect(createData.submittedById).toBe('user_1');
    expect(mocks.prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: 'SUBMIT',
      targetModel: 'INSTITUTION',
    });
  });
});

describe('admin review', () => {
  it('USER cannot reach the admin review queue (403)', async () => {
    const res = await request(app).get('/api/v1/admin/submissions').set(userToken);
    expect(res.status).toBe(403);
  });

  it('approve sets APPROVED + reviewer and logs APPROVE', async () => {
    mocks.prisma.institution.findFirst.mockResolvedValue(stored);
    mocks.prisma.institution.update.mockResolvedValue({ ...stored, approvalStatus: 'APPROVED' });

    const res = await request(app)
      .post('/api/v1/admin/institutions/inst_1/approve')
      .set(adminToken);

    expect(res.status).toBe(200);
    const updateData = mocks.prisma.institution.update.mock.calls[0][0].data;
    expect(updateData.approvalStatus).toBe('APPROVED');
    expect(updateData.reviewedById).toBe('admin_1');
    expect(mocks.prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: 'APPROVE',
    });
  });

  it('reject requires a reviewNote (400 without it)', async () => {
    const res = await request(app)
      .post('/api/v1/admin/institutions/inst_1/reject')
      .set(adminToken)
      .send({});

    expect(res.status).toBe(400);
  });

  it('reject sets REJECTED with the note and logs REJECT', async () => {
    mocks.prisma.institution.findFirst.mockResolvedValue(stored);
    mocks.prisma.institution.update.mockResolvedValue({ ...stored, approvalStatus: 'REJECTED' });

    const res = await request(app)
      .post('/api/v1/admin/institutions/inst_1/reject')
      .set(adminToken)
      .send({ reviewNote: 'Not enough detail' });

    expect(res.status).toBe(200);
    const updateData = mocks.prisma.institution.update.mock.calls[0][0].data;
    expect(updateData.approvalStatus).toBe('REJECTED');
    expect(updateData.reviewNote).toBe('Not enough detail');
    expect(mocks.prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: 'REJECT',
    });
  });
});
