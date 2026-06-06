-- New: ApprovalStatus enum, SubCategory / Tag / Exhibition models, Institution
-- columns, and the breaking conversion of Institution.tags (String[]) into a
-- many-to-many Tag relation. The legacy tags are backfilled before the column
-- is dropped, so no data is lost. Back up the database before applying.

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "SubCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "InstitutionType" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exhibition" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "time" TEXT,
    "image" TEXT,
    "socialLink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exhibition_pkey" PRIMARY KEY ("id")
);

-- CreateTable (implicit many-to-many join for Institution <-> Tag)
CREATE TABLE "_InstitutionToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- AlterTable
ALTER TABLE "Institution"
    ADD COLUMN "subCategoryId" TEXT,
    ADD COLUMN "hasActiveExhibition" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'APPROVED',
    ADD COLUMN "submittedById" TEXT,
    ADD COLUMN "reviewedById" TEXT,
    ADD COLUMN "reviewNote" TEXT,
    ADD COLUMN "reviewedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "SubCategory_type_idx" ON "SubCategory"("type");
CREATE UNIQUE INDEX "SubCategory_type_name_key" ON "SubCategory"("type", "name");
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");
CREATE INDEX "Exhibition_institutionId_idx" ON "Exhibition"("institutionId");
CREATE INDEX "Exhibition_date_idx" ON "Exhibition"("date");
CREATE UNIQUE INDEX "_InstitutionToTag_AB_unique" ON "_InstitutionToTag"("A", "B");
CREATE INDEX "_InstitutionToTag_B_index" ON "_InstitutionToTag"("B");
CREATE INDEX "Institution_subCategoryId_idx" ON "Institution"("subCategoryId");
CREATE INDEX "Institution_hasActiveExhibition_idx" ON "Institution"("hasActiveExhibition");
CREATE INDEX "Institution_approvalStatus_idx" ON "Institution"("approvalStatus");
CREATE INDEX "Institution_submittedById_idx" ON "Institution"("submittedById");

-- Backfill: migrate legacy Institution.tags (text[]) into Tag rows + join table.
-- gen_random_uuid() requires PostgreSQL 13+ (or the pgcrypto extension).
INSERT INTO "Tag" ("id", "name", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, t, now(), now()
FROM (SELECT DISTINCT unnest("tags") AS t FROM "Institution") s
WHERE t <> ''
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "_InstitutionToTag" ("A", "B")
SELECT i."id", tg."id"
FROM "Institution" i, unnest(i."tags") AS tname
JOIN "Tag" tg ON tg."name" = tname;

-- Drop the legacy column now that data is migrated.
ALTER TABLE "Institution" DROP COLUMN "tags";

-- AddForeignKey
ALTER TABLE "Institution" ADD CONSTRAINT "Institution_subCategoryId_fkey" FOREIGN KEY ("subCategoryId") REFERENCES "SubCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Institution" ADD CONSTRAINT "Institution_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Institution" ADD CONSTRAINT "Institution_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Exhibition" ADD CONSTRAINT "Exhibition_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_InstitutionToTag" ADD CONSTRAINT "_InstitutionToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_InstitutionToTag" ADD CONSTRAINT "_InstitutionToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
