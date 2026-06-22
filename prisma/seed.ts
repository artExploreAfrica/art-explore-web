import {
  Area,
  InstitutionType,
  Prisma,
  PrismaClient,
  Role,
  TagCategory,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

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
 * Source of truth is `institutions-with-images.csv` at the repo root (produced
 * from the client's Google Sheet). Each row is upserted idempotently, keyed by
 * name + address. Text fields only — the `images` column is intentionally not
 * imported; images are curated and uploaded later via the admin UI, and the
 * update path below never touches `images`, so re-seeding preserves them.
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

/** Split a single CSV line, honouring quoted fields and "" escapes. */
function parseCsvRow(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

/** Parse and validate the gallery CSV into GallerySeed rows. */
function loadGalleriesFromCsv(): GallerySeed[] {
  const csvPath = path.resolve(__dirname, '..', 'institutions-with-images.csv');

  let content: string;
  try {
    content = fs.readFileSync(csvPath, 'utf-8');
  } catch {
    console.warn(
      '⚠️  institutions-with-images.csv not found at repo root — skipping gallery import.',
    );
    return [];
  }

  const lines = content.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim());
  const headers = parseCsvRow(lines[0]);
  const validTypes = new Set<string>(Object.values(InstitutionType));
  const validAreas = new Set<string>(Object.values(Area));

  const galleries: GallerySeed[] = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvRow(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] ?? '').trim();
    });

    const lat = Number(row.lat);
    const lng = Number(row.lng);
    // Drop any row that fails the hard constraints — this also filters out
    // garbage produced if a description ever contained an embedded newline.
    if (
      !row.name ||
      !validTypes.has(row.type) ||
      !validAreas.has(row.area) ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      skipped++;
      continue;
    }

    let openingHours: Prisma.InputJsonValue | undefined;
    if (row.openingHours) {
      try {
        openingHours = JSON.parse(row.openingHours);
      } catch {
        openingHours = undefined;
      }
    }

    galleries.push({
      name: row.name,
      description: row.description || undefined,
      type: row.type as InstitutionType,
      address: row.address,
      area: row.area as Area,
      lat,
      lng,
      website: row.website || undefined,
      phone: row.phone || undefined,
      email: row.email || undefined,
      openingHours,
    });
  }

  if (skipped > 0) {
    console.warn(`⚠️  Skipped ${skipped} malformed CSV row(s) during gallery import.`);
  }
  return galleries;
}

async function seedGalleries(): Promise<void> {
  const galleries = loadGalleriesFromCsv();

  if (galleries.length === 0) {
    console.warn('⚠️  No galleries to import — skipping.');
    return;
  }

  for (const g of galleries) {
    // Find an existing match first (no natural unique key on Institution).
    const existing = await prisma.institution.findFirst({
      where: { name: g.name, address: g.address },
      select: { id: true },
    });

    // Tags are now a relation — connectOrCreate upserts each Tag by name.
    // Tags created on the fly here default to label = name, category = STYLE
    // (matching the v2 migration backfill); the curated vocabulary is seeded by
    // seedTags().
    const tagConnect = (g.tags ?? []).map((name) => ({
      where: { name },
      create: { name, label: name, category: TagCategory.STYLE },
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
    { name: 'Contemporary', type: InstitutionType.ART_GALLERY },
    { name: 'Photography', type: InstitutionType.ART_GALLERY },
    { name: 'Modern', type: InstitutionType.ART_GALLERY },
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

/** The v2 predefined tag vocabulary, idempotent by unique name (slug). */
async function seedTags(): Promise<void> {
  const tags: { name: string; label: string; category: TagCategory }[] = [
    { name: 'WOMEN_OWNED', label: 'Women Owned', category: TagCategory.OWNERSHIP },
    { name: 'BLACK_OWNED', label: 'Black Owned', category: TagCategory.OWNERSHIP },
    { name: 'ARTIST_LED', label: 'Artist Led', category: TagCategory.OWNERSHIP },
    { name: 'LIVE_EXHIBITION', label: 'Live Exhibition', category: TagCategory.FORMAT },
    { name: 'BY_APPOINTMENT', label: 'By Appointment', category: TagCategory.FORMAT },
    { name: 'ONLINE', label: 'Online', category: TagCategory.FORMAT },
    { name: 'OUR_PICKS', label: 'Our Picks', category: TagCategory.CURATION },
    { name: 'NEW_ARRIVAL', label: 'New Arrival', category: TagCategory.CURATION },
    { name: 'FEATURED', label: 'Featured', category: TagCategory.CURATION },
    { name: 'CONTEMPORARY', label: 'Contemporary', category: TagCategory.STYLE },
    { name: 'MODERN', label: 'Modern', category: TagCategory.STYLE },
    { name: 'PHOTOGRAPHY', label: 'Photography', category: TagCategory.STYLE },
    { name: 'SCULPTURE', label: 'Sculpture', category: TagCategory.STYLE },
    { name: 'DIGITAL_ART', label: 'Digital Art', category: TagCategory.STYLE },
    { name: 'TEXTILE', label: 'Textile & Fabric', category: TagCategory.STYLE },
    { name: 'MIXED_MEDIA', label: 'Mixed Media', category: TagCategory.STYLE },
  ];

  for (const tag of tags) {
    await prisma.tag.upsert({
      where: { name: tag.name },
      update: { label: tag.label, category: tag.category },
      create: tag,
    });
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
