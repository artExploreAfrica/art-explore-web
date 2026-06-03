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

    const data = {
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
      tags: g.tags ?? [],
      isPublished: g.isPublished ?? true,
    };

    if (existing) {
      await prisma.institution.update({ where: { id: existing.id }, data });
    } else {
      await prisma.institution.create({ data });
    }
  }

  console.log(`✅ Imported ${galleries.length} galleries`);
}

async function main(): Promise<void> {
  await seedSuperAdmin();
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
