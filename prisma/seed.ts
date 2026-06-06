import {
  Area,
  InstitutionType,
  Prisma,
  PrismaClient,
  Role,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Idempotent seed (Guide §9):
 *   1. Creates the default Super Admin from env vars (upsert — safe to re-run).
 *   2. Imports the ~90 galleries from the client's Google Sheet CSV.
 *
 * Run with: `npx prisma db seed`
 */

async function seedSuperAdmin(): Promise<void> {
  const name = process.env.SEED_SUPER_ADMIN_NAME;
  const email = process.env.SEED_SUPER_ADMIN_EMAIL;
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD;

  if (!name || !email || !password) {
    console.warn(
      '⚠️  Skipping Super Admin seed — set SEED_SUPER_ADMIN_NAME, ' +
        'SEED_SUPER_ADMIN_EMAIL and SEED_SUPER_ADMIN_PASSWORD in .env.',
    );
    return;
  }

  const hashed = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {}, // do not overwrite an existing admin's data on re-seed
    create: {
      fullName: name,
      email,
      password: hashed,
      role: Role.SUPER_ADMIN,
      isActive: true,
    },
  });

  console.log(`✅ Super Admin ready: ${admin.email}`);
}

/**
 * Gallery import.
 *
 * The client maintains ~90 galleries in a Google Sheet. Coordinate with the PM
 * to export that sheet to `prisma/data/galleries.json` matching the shape below,
 * then this loop upserts each one idempotently (keyed by name + address).
 *
 * Until the CSV/JSON export is supplied, this is a no-op with a clear notice.
 */
interface GallerySeed {
  name: string;
  description?: string;
  type: InstitutionType;
  address: string;
  area: Area;
  lat: number;
  lng: number;
  website?: string;
  phone?: string;
  email?: string;
  openingHours?: Prisma.InputJsonValue;
  tags?: string[];
  isPublished?: boolean;
}

async function seedGalleries(): Promise<void> {
  let galleries: GallerySeed[] = [];

  try {
    // Lazy require so a missing file does not crash the whole seed.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    galleries = require('./data/galleries.json') as GallerySeed[];
  } catch {
    console.warn(
      '⚠️  No prisma/data/galleries.json found — skipping gallery import. ' +
        'Export the client Google Sheet to that path to seed the ~90 galleries.',
    );
    return;
  }

  for (const g of galleries) {
    // Find an existing match first (no natural unique key on Institution).
    const existing = await prisma.institution.findFirst({
      where: { name: g.name, address: g.address },
      select: { id: true },
    });

    // Tags are now a relation — connectOrCreate upserts each Tag by name.
    const tagConnect = (g.tags ?? []).map((name) => ({
      where: { name },
      create: { name },
    }));

    const data: Prisma.InstitutionCreateInput = {
      name: g.name,
      description: g.description ?? null,
      type: g.type,
      address: g.address,
      area: g.area,
      lat: g.lat,
      lng: g.lng,
      website: g.website ?? null,
      phone: g.phone ?? null,
      email: g.email ?? null,
      openingHours: g.openingHours ?? Prisma.JsonNull,
      // Seeded galleries are admin-curated, so they go straight to APPROVED.
      approvalStatus: 'APPROVED',
      isPublished: g.isPublished ?? true,
      ...(tagConnect.length > 0 && { tags: { connectOrCreate: tagConnect } }),
    };

    if (existing) {
      await prisma.institution.update({ where: { id: existing.id }, data });
    } else {
      await prisma.institution.create({ data });
    }
  }

  console.log(`✅ Imported ${galleries.length} galleries`);
}

/** A small starter set of admin-managed sub-categories, idempotent by (type, name). */
async function seedSubCategories(): Promise<void> {
  const subCategories: { name: string; type: InstitutionType }[] = [
    { name: 'Contemporary', type: InstitutionType.GALLERY },
    { name: 'Photography', type: InstitutionType.GALLERY },
    { name: 'Modern', type: InstitutionType.GALLERY },
    { name: 'Painting Studio', type: InstitutionType.STUDIO },
    { name: 'Sculpture Studio', type: InstitutionType.STUDIO },
    { name: 'Museum', type: InstitutionType.CULTURAL_SPACE },
    { name: 'Heritage Site', type: InstitutionType.CULTURAL_SPACE },
  ];

  for (const sc of subCategories) {
    await prisma.subCategory.upsert({
      where: { type_name: { type: sc.type, name: sc.name } },
      update: {},
      create: sc,
    });
  }

  console.log(`✅ Seeded ${subCategories.length} sub-categories`);
}

/** A starter tag list, idempotent by unique name. */
async function seedTags(): Promise<void> {
  const tags = ['Contemporary', 'Abstract', 'Sculpture', 'Photography', 'Mixed Media'];

  for (const name of tags) {
    await prisma.tag.upsert({ where: { name }, update: {}, create: { name } });
  }

  console.log(`✅ Seeded ${tags.length} tags`);
}

async function main(): Promise<void> {
  await seedSuperAdmin();
  await seedSubCategories();
  await seedTags();
  await seedGalleries();
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
