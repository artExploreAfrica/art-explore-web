-- v2 alignment, part 2 of 2 — model/column changes with data backfill.
-- No rows are lost: legacy Exhibition columns are migrated before being dropped,
-- and new NOT NULL columns are populated before the constraint is enforced.
-- Back up the database before applying.

-- 1. TagCategory enum (new).
CREATE TYPE "TagCategory" AS ENUM ('OWNERSHIP', 'STYLE', 'CURATION', 'FORMAT');

-- 2. ApprovalStatus: drop the unused DRAFT value by recreating the enum.
--    Only Institution.approvalStatus uses this type at this point (Exhibition's
--    approvalStatus column is added later in this migration).
ALTER TABLE "Institution" ALTER COLUMN "approvalStatus" DROP DEFAULT;
ALTER TYPE "ApprovalStatus" RENAME TO "ApprovalStatus_old";
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
ALTER TABLE "Institution"
  ALTER COLUMN "approvalStatus" TYPE "ApprovalStatus"
  USING ("approvalStatus"::text::"ApprovalStatus");
ALTER TABLE "Institution" ALTER COLUMN "approvalStatus" SET DEFAULT 'APPROVED';
DROP TYPE "ApprovalStatus_old";

-- 3. Tag: add label + category. Backfill existing rows (label = name, category =
--    STYLE) before enforcing NOT NULL.
ALTER TABLE "Tag" ADD COLUMN "label" TEXT;
ALTER TABLE "Tag" ADD COLUMN "category" "TagCategory";
UPDATE "Tag" SET "label" = "name" WHERE "label" IS NULL;
UPDATE "Tag" SET "category" = 'STYLE' WHERE "category" IS NULL;
ALTER TABLE "Tag" ALTER COLUMN "label" SET NOT NULL;
ALTER TABLE "Tag" ALTER COLUMN "category" SET NOT NULL;
CREATE INDEX "Tag_category_idx" ON "Tag"("category");

-- 4. Institution: rename hasActiveExhibition -> hasExhibition (keep the index).
ALTER TABLE "Institution" RENAME COLUMN "hasActiveExhibition" TO "hasExhibition";
ALTER INDEX "Institution_hasActiveExhibition_idx" RENAME TO "Institution_hasExhibition_idx";

-- 5. Exhibition: reshape to v2. Add new columns, backfill from legacy columns,
--    enforce NOT NULL, then drop the legacy columns.
ALTER TABLE "Exhibition"
  ADD COLUMN "name" TEXT,
  ADD COLUMN "images" TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN "startDate" TIMESTAMP(3),
  ADD COLUMN "startTime" TEXT,
  ADD COLUMN "endTime" TEXT,
  ADD COLUMN "link" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "submittedById" TEXT,
  ADD COLUMN "approvedById" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT false;

-- Backfill from legacy columns. Existing exhibitions were admin-created and live,
-- so they are marked APPROVED + active.
UPDATE "Exhibition" SET
  "name" = "title",
  "startDate" = "date",
  "endDate" = COALESCE("endDate", "date"),
  "startTime" = COALESCE("time", '00:00'),
  "endTime" = '23:59',
  "link" = "socialLink",
  "images" = CASE WHEN "image" IS NOT NULL THEN ARRAY["image"] ELSE '{}'::text[] END,
  "approvalStatus" = 'APPROVED',
  "isActive" = true;

-- Enforce NOT NULL now that data is populated. (endDate already exists; v2 makes
-- it required.)
ALTER TABLE "Exhibition"
  ALTER COLUMN "name" SET NOT NULL,
  ALTER COLUMN "startDate" SET NOT NULL,
  ALTER COLUMN "endDate" SET NOT NULL,
  ALTER COLUMN "startTime" SET NOT NULL,
  ALTER COLUMN "endTime" SET NOT NULL;

-- The images default was only for backfill convenience; the model has no default.
ALTER TABLE "Exhibition" ALTER COLUMN "images" DROP DEFAULT;

-- Drop legacy columns.
ALTER TABLE "Exhibition"
  DROP COLUMN "title",
  DROP COLUMN "date",
  DROP COLUMN "time",
  DROP COLUMN "image",
  DROP COLUMN "socialLink";

-- Indexes: replace the date index with startDate; add approval/submission indexes.
-- (Dropping the "date" column above already removes Exhibition_date_idx, so guard
-- the explicit drop with IF EXISTS.)
DROP INDEX IF EXISTS "Exhibition_date_idx";
CREATE INDEX "Exhibition_startDate_idx" ON "Exhibition"("startDate");
CREATE INDEX "Exhibition_approvalStatus_idx" ON "Exhibition"("approvalStatus");
CREATE INDEX "Exhibition_submittedById_idx" ON "Exhibition"("submittedById");
CREATE INDEX "Exhibition_approvedById_idx" ON "Exhibition"("approvedById");

-- Foreign keys for submitter/approver.
ALTER TABLE "Exhibition" ADD CONSTRAINT "Exhibition_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Exhibition" ADD CONSTRAINT "Exhibition_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
