import { Area, InstitutionType, Prisma, PrismaClient, Role, TagCategory } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { parseOpeningHoursCell } from '../src/utils/openingHours';

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
 * Source of truth is `ArtandCulturalSpacesDB-latest.csv` at the repo root
 * (client Google Sheet export). Falls back to `institutions-with-images.csv`
 * for older envs. Each row is upserted idempotently by name (case-insensitive).
 * Text fields only — the `images` column is intentionally not imported; images
 * are curated via the admin UI / S3, and the update path never touches
 * `images`, so re-seeding preserves them.
 *
 * The update path is additive for optional fields too: a value in the sheet
 * overwrites the stored one, but a blank cell leaves it as-is. Curated data
 * entered through the admin UI therefore survives a re-seed.
 */
interface GallerySeed {
  name: string;
  description?: string;
  type: InstitutionType;
  address: string;
  area: Area;
  /**
   * Neighbourhood within `area`, from the sheet's `sub_area` column.
   *
   * Taken verbatim — no normalisation. Two of the six values in the current
   * export ("Island", "Mainland") restate `area`, and "Lagos Island" is a third
   * spelling of the same place. That is a taxonomy question to settle against
   * the source sheet, not something to decide silently during an import.
   */
  subArea?: string;
  lat: number;
  lng: number;
  website?: string;
  instagram?: string;
  phone?: string;
  email?: string;
  openingHours?: Prisma.InputJsonValue;
  tags?: string[];
  isPublished?: boolean;
}

const CSV_CANDIDATES = [
  'ArtandCulturalSpacesDB-latest-4.csv',
  'ArtandCulturalSpacesDB-latest.csv',
  'institutions-with-images.csv',
] as const;

/** Map sheet labels / enum strings → Prisma InstitutionType. */
function mapInstitutionType(rawType: string, name: string): InstitutionType | null {
  const t = rawType.trim();
  const upper = t.toUpperCase().replace(/[\s/-]+/g, '_');

  // Already a Prisma enum value (legacy CSV).
  if ((Object.values(InstitutionType) as string[]).includes(upper)) {
    return upper as InstitutionType;
  }
  if ((Object.values(InstitutionType) as string[]).includes(t)) {
    return t as InstitutionType;
  }

  const label = t.toLowerCase();
  const n = name.toLowerCase();

  if (label === 'art galleries' || label === 'gallery') {
    return InstitutionType.ART_GALLERY;
  }
  if (label === 'museums' || label === 'museum') {
    return InstitutionType.MUSEUM;
  }
  // No FESTIVAL enum — festivals / fairs live under cultural spaces.
  if (label === 'art festivals' || label.includes('festival')) {
    return InstitutionType.CULTURAL_SPACE;
  }

  if (label === 'art hubs/institutions' || label === 'art hubs' || label.includes('hub')) {
    if (/\bfoundation\b/.test(n)) return InstitutionType.FOUNDATION;
    if (/\bmuseum\b/.test(n)) return InstitutionType.MUSEUM;
    if (/\bstudio/.test(n)) return InstitutionType.STUDIO;
    if (/\binstitut/.test(n) || /\binstitute\b/.test(n)) return InstitutionType.INSTITUTE;
    if (/\bgallery\b/.test(n)) return InstitutionType.ART_GALLERY;
    return InstitutionType.CULTURAL_SPACE;
  }

  return null;
}

/** Normalize phone strings that Excel exported as floats (e.g. 2348055….0). */
function cleanPhone(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let phone = raw.trim();
  if (!phone) return undefined;
  if (/^\d+\.0$/.test(phone)) {
    phone = phone.slice(0, -2);
  }
  if (/^\d{10,15}$/.test(phone) && !phone.startsWith('+')) {
    phone = `+${phone}`;
  }
  return phone;
}

function cleanInstagram(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const handle = raw.trim();
  if (!handle) return undefined;
  // keep @handle, or strip @: return handle.replace(/^@/, '');
  return handle.startsWith('@') ? handle : `@${handle}`;
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
  let csvPath: string | null = null;
  for (const file of CSV_CANDIDATES) {
    const candidate = path.resolve(__dirname, '..', file);
    if (fs.existsSync(candidate)) {
      csvPath = candidate;
      break;
    }
  }

  if (!csvPath) {
    console.warn(
      `⚠️  No gallery CSV found (tried ${CSV_CANDIDATES.join(', ')}) — ` +
        'skipping gallery import.',
    );
    return [];
  }

  console.log(`📄 Loading galleries from ${path.basename(csvPath)}`);

  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((l) => l.trim());
  const headers = parseCsvRow(lines[0]);
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
    const type = mapInstitutionType(row.type ?? '', row.name ?? '');
    // Sheet export leaves area blank for city-wide festivals / some hubs.
    const areaRaw = (row.area ?? '').toUpperCase();
    const area = validAreas.has(areaRaw) ? areaRaw : Area.OTHER;

    // Drop any row that fails the hard constraints — this also filters out
    // garbage produced if a description ever contained an embedded newline.
    if (!row.name || !type || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      skipped++;
      continue;
    }

    let openingHours: Prisma.InputJsonValue | undefined;
    if (row.openingHours) {
      // The sheet stores hours as per-day JSON *or* free text ("Tue-Sat
      // 11am-6pm"); both are converted to the day-indexed { open, close } shape
      // the API validates. Genuinely indeterminate values ("by appointment")
      // come back undefined and are left unset. The cast is needed only because
      // Prisma's InputJsonValue excludes `null` members, while a closed day is
      // legitimately JSON null *inside* the object.
      openingHours = parseOpeningHoursCell(row.openingHours) as Prisma.InputJsonValue | undefined;
    }

    galleries.push({
      name: row.name,
      description: row.description || undefined,
      type,
      address: row.address || 'Lagos',
      area: area as Area,
      // `row` is built from every CSV header (see the loop above), so
      // `sub_area` has always been parsed and in scope here — it was simply
      // never mapped, which is why Institution.subArea is NULL for every row.
      // Values are already trimmed by the row builder; blank means "the sheet
      // has no value", which becomes undefined and leaves the column alone.
      subArea: row.sub_area || undefined,
      lat,
      lng,
      website: row.website || undefined,
      instagram: cleanInstagram(row.instagram),
      phone: cleanPhone(row.phone),
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

  let created = 0;
  let updated = 0;

  for (const g of galleries) {
    // Match by name (case-insensitive) so address/coord updates don't duplicate.
    const existing = await prisma.institution.findFirst({
      where: {
        name: { equals: g.name, mode: 'insensitive' },
        deletedAt: null,
      },
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
      subArea: g.subArea ?? null,
      lat: g.lat,
      lng: g.lng,
      website: g.website ?? null,
      instagram: g.instagram ?? null,
      phone: g.phone ?? null,
      email: g.email ?? null,
      openingHours: g.openingHours ?? Prisma.JsonNull,
      // Seeded galleries are admin-curated, so they go straight to APPROVED.
      approvalStatus: 'APPROVED',
      isPublished: g.isPublished ?? true,
      ...(tagConnect.length > 0 && { tags: { connectOrCreate: tagConnect } }),
    };

    if (existing) {
      // A blank CSV cell means "the sheet has no value", not "clear the field".
      // Most rows leave at least one of these empty, so writing them as null
      // would wipe anything curated in the admin UI on every re-seed.
      const { description, website, instagram, phone, email, openingHours, subArea, ...rest } =
        data;
      await prisma.institution.update({
        where: { id: existing.id },
        data: {
          ...rest,
          ...(g.description && { description }),
          ...(g.website && { website }),
          ...(g.instagram && { instagram }),
          ...(g.phone && { phone }),
          ...(g.email && { email }),
          ...(g.openingHours && { openingHours }),
          // Must be here, not in `rest`: the seed is idempotent by name and all
          // 103 rows already exist, so every re-seed takes this branch. Adding
          // subArea only to the create object would change nothing. Guarded
          // like its neighbours so a blank cell never clears a value curated in
          // the admin UI.
          ...(g.subArea && { subArea }),
        },
      });
      updated++;
    } else {
      await prisma.institution.create({ data });
      created++;
    }
  }

  console.log(`✅ Imported ${galleries.length} galleries (${created} created, ${updated} updated)`);
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