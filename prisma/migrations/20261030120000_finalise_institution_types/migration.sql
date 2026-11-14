-- Final InstitutionType set: ART_GALLERY, MUSEUM, HUB_INSTITUTION,
-- NOMADIC_SPACE, ART_FESTIVAL, RESIDENCY.
-- INSTITUTE, FOUNDATION, STUDIO and CULTURAL_SPACE are dropped as top-level
-- types; they live on as InstitutionSubType values under HUB_INSTITUTION.
--
-- Postgres can't drop enum values in place, so existing rows are moved off
-- the old values first, then the enum is rebuilt and swapped in.

BEGIN;

-- 1. Institutions: move to HUB_INSTITUTION, keep the old type as subType
--    (the value names match InstitutionSubType one-for-one). An existing
--    subType is left alone.
UPDATE "Institution"
SET "subType" = COALESCE("subType", "type"::text::"InstitutionSubType"),
    "type"    = 'HUB_INSTITUTION'
WHERE "type"::text IN ('INSTITUTE', 'FOUNDATION', 'STUDIO', 'CULTURAL_SPACE');

-- 2. Pending edits are a JSON blob validated on approve, so remap any old
--    type in there the same way or the approve would be rejected.
UPDATE "Institution"
SET "pendingChanges" = "pendingChanges"
  || jsonb_build_object('type', 'HUB_INSTITUTION')
  || CASE WHEN "pendingChanges" ? 'subType' AND "pendingChanges"->>'subType' IS NOT NULL
          THEN '{}'::jsonb
          ELSE jsonb_build_object('subType', "pendingChanges"->>'type') END
WHERE "pendingChanges" IS NOT NULL
  AND jsonb_typeof("pendingChanges") = 'object'
  AND "pendingChanges"->>'type' IN ('INSTITUTE', 'FOUNDATION', 'STUDIO', 'CULTURAL_SPACE');

-- 3. Sub-categories: move to HUB_INSTITUTION. Where a HUB_INSTITUTION
--    sub-category with the same name already exists, (type, name) would
--    collide — point its institutions at the existing one and drop the dupe.
UPDATE "Institution" i
SET "subCategoryId" = keep."id"
FROM "SubCategory" old
JOIN "SubCategory" keep
  ON keep."name" = old."name" AND keep."type" = 'HUB_INSTITUTION'
WHERE i."subCategoryId" = old."id"
  AND old."type"::text IN ('INSTITUTE', 'FOUNDATION', 'STUDIO', 'CULTURAL_SPACE');

DELETE FROM "SubCategory" old
USING "SubCategory" keep
WHERE keep."name" = old."name" AND keep."type" = 'HUB_INSTITUTION'
  AND old."type"::text IN ('INSTITUTE', 'FOUNDATION', 'STUDIO', 'CULTURAL_SPACE');

-- Two old types could share a name (e.g. STUDIO and FOUNDATION "Main") —
-- keep the oldest, fold the rest into it.
WITH ranked AS (
  SELECT "id", FIRST_VALUE("id") OVER (PARTITION BY "name" ORDER BY "createdAt", "id") AS keep_id
  FROM "SubCategory"
  WHERE "type"::text IN ('INSTITUTE', 'FOUNDATION', 'STUDIO', 'CULTURAL_SPACE')
)
UPDATE "Institution" i
SET "subCategoryId" = r.keep_id
FROM ranked r
WHERE i."subCategoryId" = r."id" AND r."id" <> r.keep_id;

WITH ranked AS (
  SELECT "id", FIRST_VALUE("id") OVER (PARTITION BY "name" ORDER BY "createdAt", "id") AS keep_id
  FROM "SubCategory"
  WHERE "type"::text IN ('INSTITUTE', 'FOUNDATION', 'STUDIO', 'CULTURAL_SPACE')
)
DELETE FROM "SubCategory" s
USING ranked r
WHERE s."id" = r."id" AND r."id" <> r.keep_id;

UPDATE "SubCategory"
SET "type" = 'HUB_INSTITUTION'
WHERE "type"::text IN ('INSTITUTE', 'FOUNDATION', 'STUDIO', 'CULTURAL_SPACE');

-- 4. Rebuild the enum with the final values (adds RESIDENCY) and swap it in.
CREATE TYPE "InstitutionType_new" AS ENUM ('ART_GALLERY', 'MUSEUM', 'HUB_INSTITUTION', 'NOMADIC_SPACE', 'ART_FESTIVAL', 'RESIDENCY');
ALTER TABLE "Institution" ALTER COLUMN "type" TYPE "InstitutionType_new" USING ("type"::text::"InstitutionType_new");
ALTER TABLE "SubCategory" ALTER COLUMN "type" TYPE "InstitutionType_new" USING ("type"::text::"InstitutionType_new");
ALTER TYPE "InstitutionType" RENAME TO "InstitutionType_old";
ALTER TYPE "InstitutionType_new" RENAME TO "InstitutionType";
DROP TYPE "InstitutionType_old";

COMMIT;
