import { Prisma, Role } from '@prisma/client';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bearer, signAccess, stubActiveUser } from './helpers';

const mocks = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn() },
    tag: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    institution: { findMany: vi.fn(), findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
  },
  redis: { scan: vi.fn(), del: vi.fn() },
}));

vi.mock('../src/config/db', () => ({ default: mocks.prisma }));
vi.mock('../src/config/redis', () => ({ redis: mocks.redis }));

import app from '../src/app';

const adminToken = bearer(signAccess(Role.ADMIN, 'admin_1'));

const stored = {
  id: 'tag_1',
  name: 'ABSTRACT',
  label: 'Abstract',
  category: 'STYLE',
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  stubActiveUser(mocks.prisma.user.findUnique, Role.ADMIN, { id: 'admin_1' });
  mocks.redis.scan.mockResolvedValue(['0', []]);
  mocks.redis.del.mockResolvedValue(0);
  mocks.prisma.auditLog.create.mockResolvedValue({});
  mocks.prisma.tag.findFirst.mockResolvedValue(null); // no name/label clash
});

/** Spaces that exist, keyed by id; anything else is "unknown or deleted". */
const spacesInDb = (spaces: Record<string, { images: string[] }>) => {
  mocks.prisma.institution.findMany.mockImplementation(async ({ where }) =>
    (where.id.in as string[]).filter((id) => id in spaces).map((id) => ({ id })),
  );
  mocks.prisma.institution.findFirst.mockImplementation(async ({ where }) =>
    spaces[where.id] ? { images: spaces[where.id].images } : null,
  );
};

describe('POST /api/v1/admin/tags', () => {
  it('creates a tag without a category (hidden in the admin) and stores the STYLE default', async () => {
    mocks.prisma.tag.create.mockResolvedValue(stored);

    const res = await request(app)
      .post('/api/v1/admin/tags')
      .set(adminToken)
      .send({ name: 'WOMEN_OWNED', label: 'Women Owned' });

    expect(res.status).toBe(201);
    expect(mocks.prisma.tag.create.mock.calls[0][0].data).toEqual({
      name: 'WOMEN_OWNED',
      label: 'Women Owned',
      category: 'STYLE',
    });
  });

  it('still honours a category if an older caller sends one', async () => {
    mocks.prisma.tag.create.mockResolvedValue(stored);

    await request(app)
      .post('/api/v1/admin/tags')
      .set(adminToken)
      .send({ name: 'ARTIST_LED', label: 'Artist Led', category: 'OWNERSHIP' });

    expect(mocks.prisma.tag.create.mock.calls[0][0].data.category).toBe('OWNERSHIP');
  });

  it('201s and logs CREATE + invalidates cache', async () => {
    mocks.prisma.tag.create.mockResolvedValue(stored);

    const res = await request(app)
      .post('/api/v1/admin/tags')
      .set(adminToken)
      .send({ name: 'ABSTRACT', label: 'Abstract', category: 'STYLE' });

    expect(res.status).toBe(201);
    expect(mocks.prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: 'CREATE',
      targetModel: 'TAG',
      targetId: 'tag_1',
    });
    expect(mocks.redis.scan).toHaveBeenCalled();
  });

  it('409s on a duplicate name (P2002)', async () => {
    mocks.prisma.tag.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    const res = await request(app)
      .post('/api/v1/admin/tags')
      .set(adminToken)
      .send({ name: 'ABSTRACT', label: 'Abstract', category: 'STYLE' });

    expect(res.status).toBe(409);
  });
});

describe('POST /api/v1/admin/tags — label, spaces and cover', () => {
  const create = (body: object) =>
    request(app).post('/api/v1/admin/tags').set(adminToken).send(body);

  it('generates the machine name from the label', async () => {
    mocks.prisma.tag.create.mockResolvedValue(stored);

    const res = await create({ label: 'Yoruba History' });

    expect(res.status).toBe(201);
    expect(mocks.prisma.tag.create.mock.calls[0][0].data).toMatchObject({
      name: 'YORUBA_HISTORY',
      label: 'Yoruba History',
    });
  });

  it('normalises a hand-typed name too ("women owned" → WOMEN_OWNED)', async () => {
    mocks.prisma.tag.create.mockResolvedValue(stored);

    await create({ name: '  women-owned ', label: 'Women Owned' });

    expect(mocks.prisma.tag.create.mock.calls[0][0].data.name).toBe('WOMEN_OWNED');
  });

  it('409s when a tag with the same name or label exists in any case', async () => {
    mocks.prisma.tag.findFirst.mockResolvedValue({ label: 'Yoruba History' });

    const res = await create({ label: 'yoruba history' });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('A tag called "Yoruba History" already exists');
    expect(mocks.prisma.tag.create).not.toHaveBeenCalled();
  });

  it('400s on a label with no letters or numbers', async () => {
    const res = await create({ label: '!!!' });
    expect(res.status).toBe(400);
    expect(mocks.prisma.tag.create).not.toHaveBeenCalled();
  });

  it('400s on a label longer than 60 characters', async () => {
    const res = await create({ label: 'x'.repeat(61) });
    expect(res.status).toBe(400);
  });

  it('links the chosen spaces and sets the cover', async () => {
    spacesInDb({ s1: { images: ['a.jpg'] }, s2: { images: [] } });
    mocks.prisma.tag.create.mockResolvedValue(stored);

    const res = await create({
      label: 'Yoruba History',
      institutionIds: ['s1', 's2', 's1'],
      coverInstitutionId: 's1',
    });

    expect(res.status).toBe(201);
    const data = mocks.prisma.tag.create.mock.calls[0][0].data;
    expect(data.institutions).toEqual({ connect: [{ id: 's1' }, { id: 's2' }] });
    expect(data.coverInstitutionId).toBe('s1');
  });

  it('400s and saves nothing when a space id is unknown or deleted', async () => {
    spacesInDb({ s1: { images: ['a.jpg'] } });

    const res = await create({ label: 'Yoruba History', institutionIds: ['s1', 'gone'] });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('gone');
    expect(mocks.prisma.tag.create).not.toHaveBeenCalled();
  });

  it('400s when the cover is not one of the tag’s spaces', async () => {
    spacesInDb({ s1: { images: ['a.jpg'] }, s9: { images: ['b.jpg'] } });

    const res = await create({ label: 'X', institutionIds: ['s1'], coverInstitutionId: 's9' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/one of the spaces/);
  });

  it('400s when the cover space has no photo', async () => {
    spacesInDb({ s2: { images: [] } });

    const res = await create({ label: 'X', institutionIds: ['s2'], coverInstitutionId: 's2' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no photo/);
  });
});

describe('PUT /api/v1/admin/tags/:id', () => {
  const current = (over: object = {}) => ({
    ...stored,
    name: 'YORUBA_HISTORY',
    label: 'Yoruba History',
    coverInstitutionId: 's1',
    institutions: [{ id: 's1' }, { id: 's2' }],
    ...over,
  });
  const update = (body: object) =>
    request(app).put('/api/v1/admin/tags/tag_1').set(adminToken).send(body);

  it('replaces the space list and logs how many were linked and unlinked', async () => {
    spacesInDb({ s1: { images: ['a.jpg'] }, s3: { images: ['c.jpg'] } });
    mocks.prisma.tag.findUnique.mockResolvedValue(current());
    mocks.prisma.tag.update.mockResolvedValue(stored);

    const res = await update({ institutionIds: ['s1', 's3'] });

    expect(res.status).toBe(200);
    expect(mocks.prisma.tag.update.mock.calls[0][0].data.institutions).toEqual({
      set: [{ id: 's1' }, { id: 's3' }],
    });
    expect(mocks.prisma.auditLog.create.mock.calls[0][0].data.metadata).toMatchObject({
      linked: 1,
      unlinked: 1,
      spaces: 2,
    });
  });

  it('resets the cover to automatic when its space is unlinked', async () => {
    spacesInDb({ s2: { images: ['b.jpg'] } });
    mocks.prisma.tag.findUnique.mockResolvedValue(current());
    mocks.prisma.tag.update.mockResolvedValue(stored);

    await update({ institutionIds: ['s2'] });

    expect(mocks.prisma.tag.update.mock.calls[0][0].data.coverInstitutionId).toBeNull();
  });

  it('changes and clears the cover explicitly', async () => {
    spacesInDb({ s1: { images: ['a.jpg'] }, s2: { images: ['b.jpg'] } });
    mocks.prisma.tag.findUnique.mockResolvedValue(current());
    mocks.prisma.tag.update.mockResolvedValue(stored);

    await update({ coverInstitutionId: 's2' });
    expect(mocks.prisma.tag.update.mock.calls[0][0].data.coverInstitutionId).toBe('s2');

    await update({ coverInstitutionId: null });
    expect(mocks.prisma.tag.update.mock.calls[1][0].data.coverInstitutionId).toBeNull();
  });

  it('renaming the label keeps the machine name (the home page finds cards by it)', async () => {
    mocks.prisma.tag.findUnique.mockResolvedValue(current());
    mocks.prisma.tag.update.mockResolvedValue(stored);

    await update({ label: 'Yorùbá History' });

    const data = mocks.prisma.tag.update.mock.calls[0][0].data;
    expect(data.label).toBe('Yorùbá History');
    expect(data).not.toHaveProperty('name');
  });

  it('404s for an unknown tag', async () => {
    mocks.prisma.tag.findUnique.mockResolvedValue(null);
    const res = await update({ label: 'X' });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/admin/tags/space-options and /tags/:id', () => {
  it('lists spaces for the picker without treating "space-options" as a tag id', async () => {
    mocks.prisma.institution.findMany.mockResolvedValue([
      { id: 's1', name: 'Alara', images: ['a.jpg'], isPublished: true },
    ]);

    const res = await request(app).get('/api/v1/admin/tags/space-options').set(adminToken);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(mocks.prisma.tag.findUnique).not.toHaveBeenCalled();
    expect(mocks.prisma.institution.findMany.mock.calls[0][0].where).toEqual({ deletedAt: null });
  });

  it('returns one tag with its spaces', async () => {
    mocks.prisma.tag.findUnique.mockResolvedValue({ ...stored, institutions: [{ id: 's1' }] });

    const res = await request(app).get('/api/v1/admin/tags/tag_1').set(adminToken);

    expect(res.status).toBe(200);
    expect(res.body.data.institutions).toEqual([{ id: 's1' }]);
  });

  it('401s without a token', async () => {
    const res = await request(app).get('/api/v1/admin/tags/space-options');
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/v1/admin/tags/:id', () => {
  it('200s and logs DELETE', async () => {
    mocks.prisma.tag.findUnique.mockResolvedValue(stored);
    mocks.prisma.tag.delete.mockResolvedValue(stored);

    const res = await request(app).delete('/api/v1/admin/tags/tag_1').set(adminToken);

    expect(res.status).toBe(200);
    expect(mocks.prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: 'DELETE',
      targetModel: 'TAG',
    });
  });
});
