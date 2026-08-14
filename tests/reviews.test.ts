import { Role } from '@prisma/client';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bearer, signAccess, stubActiveUser } from './helpers';

const mocks = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn() },
    institution: { findFirst: vi.fn(), update: vi.fn() },
    review: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
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

const review = {
  id: 'rev_1',
  institutionId: 'inst_1',
  userId: 'user_1',
  rating: 4,
  comment: 'Great space',
  approvalStatus: 'PENDING',
  reviewedById: null,
  reviewedAt: null,
  reviewNote: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.redis.scan.mockResolvedValue(['0', []]);
  mocks.redis.del.mockResolvedValue(0);
  mocks.prisma.auditLog.create.mockResolvedValue({});
  mocks.prisma.institution.update.mockResolvedValue({});
  mocks.prisma.review.count.mockResolvedValue(0);
  mocks.prisma.review.aggregate.mockResolvedValue({
    _avg: { rating: null },
    _count: { _all: 0 },
  });
});

describe('POST /api/v1/institutions/:id/reviews', () => {
  it('201s, forces PENDING, and never trusts a client-sent status', async () => {
    stubActiveUser(mocks.prisma.user.findUnique, Role.USER, { id: 'user_1' });
    mocks.prisma.institution.findFirst.mockResolvedValue({ id: 'inst_1' });
    mocks.prisma.review.create.mockResolvedValue(review);

    const res = await request(app)
      .post('/api/v1/institutions/inst_1/reviews')
      .set(userToken)
      .send({ rating: 4, comment: 'Great space', approvalStatus: 'APPROVED' });

    expect(res.status).toBe(201);
    expect(mocks.prisma.review.create.mock.calls[0][0].data).toMatchObject({
      approvalStatus: 'PENDING',
      userId: 'user_1',
    });
  });

  it('403s for an ADMIN — reviewing is a contributor action', async () => {
    stubActiveUser(mocks.prisma.user.findUnique, Role.ADMIN, { id: 'admin_1' });

    const res = await request(app)
      .post('/api/v1/institutions/inst_1/reviews')
      .set(adminToken)
      .send({ rating: 4 });

    expect(res.status).toBe(403);
    expect(mocks.prisma.review.create).not.toHaveBeenCalled();
  });

  it('400s on an out-of-range rating', async () => {
    stubActiveUser(mocks.prisma.user.findUnique, Role.USER, { id: 'user_1' });

    const res = await request(app)
      .post('/api/v1/institutions/inst_1/reviews')
      .set(userToken)
      .send({ rating: 9 });

    expect(res.status).toBe(400);
    expect(mocks.prisma.review.create).not.toHaveBeenCalled();
  });

  it('404s when the venue is not publicly visible', async () => {
    stubActiveUser(mocks.prisma.user.findUnique, Role.USER, { id: 'user_1' });
    mocks.prisma.institution.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/institutions/inst_1/reviews')
      .set(userToken)
      .send({ rating: 4 });

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/v1/reviews/:id', () => {
  it("404s rather than 403s on someone else's review", async () => {
    stubActiveUser(mocks.prisma.user.findUnique, Role.USER, { id: 'user_1' });
    mocks.prisma.review.findUnique.mockResolvedValue({ ...review, userId: 'someone_else' });

    const res = await request(app)
      .put('/api/v1/reviews/rev_1')
      .set(userToken)
      .send({ rating: 1 });

    expect(res.status).toBe(404);
    expect(mocks.prisma.review.update).not.toHaveBeenCalled();
  });

  it('re-opens moderation so an approved review cannot be silently rewritten', async () => {
    stubActiveUser(mocks.prisma.user.findUnique, Role.USER, { id: 'user_1' });
    mocks.prisma.review.findUnique.mockResolvedValue({
      ...review,
      approvalStatus: 'APPROVED',
    });
    mocks.prisma.review.update.mockResolvedValue({ ...review, rating: 1 });

    const res = await request(app)
      .put('/api/v1/reviews/rev_1')
      .set(userToken)
      .send({ rating: 1 });

    expect(res.status).toBe(200);
    expect(mocks.prisma.review.update.mock.calls[0][0].data).toMatchObject({
      approvalStatus: 'PENDING',
      reviewedById: null,
    });
    // Leaving the approved set must move the venue's average.
    expect(mocks.prisma.institution.update).toHaveBeenCalled();
  });
});

describe('Admin review moderation', () => {
  it('approving recomputes the venue average from approved reviews only', async () => {
    stubActiveUser(mocks.prisma.user.findUnique, Role.ADMIN, { id: 'admin_1' });
    mocks.prisma.review.findUnique.mockResolvedValue({
      ...review,
      user: { email: 'u@test.dev', fullName: 'U' },
      institution: { name: 'Gallery' },
    });
    mocks.prisma.review.update.mockResolvedValue({ ...review, approvalStatus: 'APPROVED' });
    mocks.prisma.review.aggregate.mockResolvedValue({
      _avg: { rating: 4.25 },
      _count: { _all: 4 },
    });

    const res = await request(app)
      .post('/api/v1/admin/reviews/rev_1/approve')
      .set(adminToken)
      .send();

    expect(res.status).toBe(200);
    expect(mocks.prisma.review.aggregate.mock.calls[0][0].where).toMatchObject({
      approvalStatus: 'APPROVED',
    });
    // 4.25 is stored rounded to one decimal place.
    expect(mocks.prisma.institution.update.mock.calls[0][0].data).toMatchObject({
      rating: 4.3,
      reviewCount: 4,
    });
    expect(mocks.prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: 'APPROVE_REVIEW',
      targetModel: 'REVIEW',
    });
  });

  it('clears the rating back to null when the last approved review goes', async () => {
    stubActiveUser(mocks.prisma.user.findUnique, Role.ADMIN, { id: 'admin_1' });
    mocks.prisma.review.findUnique.mockResolvedValue(review);
    mocks.prisma.review.delete.mockResolvedValue(review);

    const res = await request(app)
      .delete('/api/v1/admin/reviews/rev_1')
      .set(adminToken)
      .send();

    expect(res.status).toBe(200);
    expect(mocks.prisma.institution.update.mock.calls[0][0].data).toMatchObject({
      rating: null,
      reviewCount: 0,
    });
  });

  it('requires a reviewNote to reject', async () => {
    stubActiveUser(mocks.prisma.user.findUnique, Role.ADMIN, { id: 'admin_1' });

    const res = await request(app)
      .post('/api/v1/admin/reviews/rev_1/reject')
      .set(adminToken)
      .send({});

    expect(res.status).toBe(400);
    expect(mocks.prisma.review.update).not.toHaveBeenCalled();
  });

  it('403s for a USER hitting the moderation queue', async () => {
    stubActiveUser(mocks.prisma.user.findUnique, Role.USER, { id: 'user_1' });

    const res = await request(app)
      .get('/api/v1/admin/submissions/reviews')
      .set(userToken);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/institutions/:id/reviews (public)', () => {
  it('returns only approved reviews, no auth required', async () => {
    mocks.prisma.institution.findFirst.mockResolvedValue({ id: 'inst_1' });
    mocks.prisma.review.findMany.mockResolvedValue([review]);
    mocks.prisma.review.count.mockResolvedValue(1);

    const res = await request(app).get('/api/v1/institutions/inst_1/reviews');

    expect(res.status).toBe(200);
    expect(mocks.prisma.review.findMany.mock.calls[0][0].where).toMatchObject({
      approvalStatus: 'APPROVED',
    });
  });
});
