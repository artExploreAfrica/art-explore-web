/** Contributor management of their own submissions: edit, withdraw, images. */
import { Role } from '@prisma/client';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bearer, signAccess, stubActiveUser } from './helpers';

const mocks = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn() },
    institution: { findFirst: vi.fn(), update: vi.fn(), count: vi.fn() },
    exhibition: {
      findFirst: vi.fn(),
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

// Stubbed so the tests can assert whether S3 was reached at all — the point of
// the ownership checks is that unauthorised ids never get that far.
vi.mock('../src/utils/s3Uploader', () => ({
  uploadInstitutionImage: vi.fn().mockResolvedValue('https://bucket/inst.jpg'),
  uploadExhibitionImage: vi.fn().mockResolvedValue('https://bucket/ex.jpg'),
  deleteS3ObjectByUrl: vi.fn().mockResolvedValue(undefined),
}));

import app from '../src/app';
import * as s3 from '../src/utils/s3Uploader';

const userToken = bearer(signAccess(Role.USER, 'user_1'));

const pendingSubmission = {
  id: 'inst_1',
  name: 'My Gallery',
  images: ['https://bucket.s3.eu-west-1.amazonaws.com/institutions/inst_1/a.jpg'],
  approvalStatus: 'PENDING',
  submittedById: 'user_1',
  deletedAt: null,
};

const pendingExhibition = {
  id: 'ex_1',
  institutionId: 'inst_1',
  name: 'My Show',
  images: [],
  startDate: new Date('2026-09-01'),
  endDate: new Date('2026-09-30'),
  approvalStatus: 'PENDING',
  submittedById: 'user_1',
};

beforeEach(() => {
  vi.clearAllMocks();
  stubActiveUser(mocks.prisma.user.findUnique, Role.USER, { id: 'user_1' });
  mocks.redis.scan.mockResolvedValue(['0', []]);
  mocks.redis.del.mockResolvedValue(0);
  mocks.prisma.auditLog.create.mockResolvedValue({});
});

describe('PUT /api/v1/submissions/:id', () => {
  it('409s while still PENDING — locked until a reviewer responds', async () => {
    mocks.prisma.institution.findFirst.mockResolvedValue(pendingSubmission);

    const res = await request(app)
      .put('/api/v1/submissions/inst_1')
      .set(userToken)
      .send({ name: 'Renamed Gallery' });

    expect(res.status).toBe(409);
    expect(mocks.prisma.institution.update).not.toHaveBeenCalled();
  });

  it('fixes and resubmits a REJECTED submission, clearing the old reviewer note', async () => {
    mocks.prisma.institution.findFirst.mockResolvedValue({
      ...pendingSubmission,
      approvalStatus: 'REJECTED',
      reviewNote: 'Address was wrong',
    });
    mocks.prisma.institution.update.mockResolvedValue(pendingSubmission);

    const res = await request(app)
      .put('/api/v1/submissions/inst_1')
      .set(userToken)
      .send({ address: '12 Correct Street' });

    expect(res.status).toBe(200);
    expect(mocks.prisma.institution.update.mock.calls[0][0].data).toMatchObject({
      approvalStatus: 'PENDING',
      reviewNote: null,
      reviewedById: null,
    });
  });

  it('409s once the submission has been approved', async () => {
    mocks.prisma.institution.findFirst.mockResolvedValue({
      ...pendingSubmission,
      approvalStatus: 'APPROVED',
    });

    const res = await request(app)
      .put('/api/v1/submissions/inst_1')
      .set(userToken)
      .send({ name: 'Sneaky rename' });

    expect(res.status).toBe(409);
    expect(mocks.prisma.institution.update).not.toHaveBeenCalled();
  });

  it("404s on someone else's submission without confirming it exists", async () => {
    // The service scopes the lookup by submittedById, so a foreign id misses.
    mocks.prisma.institution.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .put('/api/v1/submissions/inst_other')
      .set(userToken)
      .send({ name: 'Nope' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/v1/submissions/:id', () => {
  it('withdraws by soft-deleting and logs WITHDRAW', async () => {
    mocks.prisma.institution.findFirst.mockResolvedValue(pendingSubmission);
    mocks.prisma.institution.update.mockResolvedValue({
      ...pendingSubmission,
      deletedAt: new Date(),
    });

    const res = await request(app)
      .delete('/api/v1/submissions/inst_1')
      .set(userToken)
      .send();

    expect(res.status).toBe(200);
    expect(mocks.prisma.institution.update.mock.calls[0][0].data.deletedAt).toBeInstanceOf(
      Date,
    );
    expect(mocks.prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: 'WITHDRAW',
      targetModel: 'INSTITUTION',
    });
  });
});

describe('Exhibition submissions', () => {
  it('rejects client-supplied image URLs — uploads must go through S3', async () => {
    mocks.prisma.institution.findFirst.mockResolvedValue({ id: 'inst_1' });

    const res = await request(app)
      .post('/api/v1/submissions/exhibitions')
      .set(userToken)
      .send({
        institutionId: 'inst_1',
        name: 'Show',
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        startTime: '10:00',
        endTime: '18:00',
        images: ['https://evil.example.com/tracker.gif'],
      });

    // `images` is not part of the submit schema, so the stray key is stripped
    // rather than persisted as a third-party URL we would then serve.
    expect(res.status).toBe(400);
  });

  it('withdrawing recomputes hasExhibition for the parent venue', async () => {
    mocks.prisma.exhibition.findFirst.mockResolvedValue(pendingExhibition);
    mocks.prisma.exhibition.delete.mockResolvedValue(pendingExhibition);
    mocks.prisma.exhibition.count.mockResolvedValue(0);
    mocks.prisma.institution.update.mockResolvedValue({});

    const res = await request(app)
      .delete('/api/v1/submissions/exhibitions/ex_1')
      .set(userToken)
      .send();

    expect(res.status).toBe(200);
    expect(mocks.prisma.institution.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { hasExhibition: false } }),
    );
  });

  it('editing an exhibition submission forces it back to PENDING and inactive', async () => {
    mocks.prisma.exhibition.findFirst.mockResolvedValue({
      ...pendingExhibition,
      approvalStatus: 'REJECTED',
    });
    mocks.prisma.exhibition.update.mockResolvedValue(pendingExhibition);

    const res = await request(app)
      .put('/api/v1/submissions/exhibitions/ex_1')
      .set(userToken)
      .send({ name: 'Corrected Show' });

    expect(res.status).toBe(200);
    expect(mocks.prisma.exhibition.update.mock.calls[0][0].data).toMatchObject({
      approvalStatus: 'PENDING',
      isActive: false,
      reviewNote: null,
    });
  });

  it('"exhibitions" is routed as a literal, never captured as a venue id', async () => {
    mocks.prisma.exhibition.findFirst.mockResolvedValue(pendingExhibition);
    mocks.prisma.exhibition.delete.mockResolvedValue(pendingExhibition);
    mocks.prisma.exhibition.count.mockResolvedValue(0);
    mocks.prisma.institution.update.mockResolvedValue({});

    await request(app).delete('/api/v1/submissions/exhibitions/ex_1').set(userToken).send();

    // The exhibition handler ran, not the venue-withdraw handler.
    expect(mocks.prisma.exhibition.delete).toHaveBeenCalled();
    expect(mocks.prisma.institution.update.mock.calls[0][0].data).toEqual({
      hasExhibition: false,
    });
  });
});

describe('Contributor image uploads', () => {
  it('never writes to S3 before ownership is confirmed', async () => {
    // Not the caller's submission → the guard must fire before the upload.
    mocks.prisma.institution.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/submissions/inst_someone_else/images')
      .set(userToken)
      .attach('image', Buffer.from([0xff, 0xd8, 0xff]), {
        filename: 'a.jpg',
        contentType: 'image/jpeg',
      });

    expect(res.status).toBe(404);
    expect(s3.uploadInstitutionImage).not.toHaveBeenCalled();
  });

  it('rejects an upload to an already-approved submission before touching S3', async () => {
    mocks.prisma.institution.findFirst.mockResolvedValue({
      ...pendingSubmission,
      approvalStatus: 'APPROVED',
    });

    const res = await request(app)
      .post('/api/v1/submissions/inst_1/images')
      .set(userToken)
      .attach('image', Buffer.from([0xff, 0xd8, 0xff]), {
        filename: 'a.jpg',
        contentType: 'image/jpeg',
      });

    expect(res.status).toBe(409);
    expect(s3.uploadInstitutionImage).not.toHaveBeenCalled();
  });

  it('uploads under the verified submission id once ownership passes', async () => {
    mocks.prisma.institution.findFirst.mockResolvedValue(pendingSubmission);
    mocks.prisma.institution.update.mockResolvedValue(pendingSubmission);

    const res = await request(app)
      .post('/api/v1/submissions/inst_1/images')
      .set(userToken)
      .attach('image', Buffer.from([0xff, 0xd8, 0xff]), {
        filename: 'a.jpg',
        contentType: 'image/jpeg',
      });

    expect(res.status).toBe(201);
    expect(s3.uploadInstitutionImage).toHaveBeenCalledWith('inst_1', expect.anything());
  });

  it('exhibition uploads are guarded the same way', async () => {
    mocks.prisma.exhibition.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/submissions/exhibitions/ex_other/images')
      .set(userToken)
      .attach('image', Buffer.from([0xff, 0xd8, 0xff]), {
        filename: 'a.jpg',
        contentType: 'image/jpeg',
      });

    expect(res.status).toBe(404);
    expect(s3.uploadExhibitionImage).not.toHaveBeenCalled();
  });

  it('rejects a non-image with 400 on the submission upload route too', async () => {
    mocks.prisma.institution.findFirst.mockResolvedValue(pendingSubmission);

    const res = await request(app)
      .post('/api/v1/submissions/inst_1/images')
      .set(userToken)
      .attach('image', Buffer.from('nope'), {
        filename: 'x.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(400);
  });

  it('404s when removing an image URL the submission does not have', async () => {
    mocks.prisma.institution.findFirst.mockResolvedValue(pendingSubmission);

    const res = await request(app)
      .delete('/api/v1/submissions/inst_1/images')
      .set(userToken)
      .send({ url: 'https://bucket.s3.eu-west-1.amazonaws.com/institutions/inst_1/zzz.jpg' });

    expect(res.status).toBe(404);
    expect(mocks.prisma.institution.update).not.toHaveBeenCalled();
  });
});
