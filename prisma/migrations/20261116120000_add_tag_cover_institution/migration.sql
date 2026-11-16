-- The space whose main photo fronts a tag on the home page, chosen in the
-- admin's Tags page. NULL = automatic (the previous behaviour), so existing
-- tags are unaffected until an admin picks a cover.
-- AlterTable
ALTER TABLE "Tag" ADD COLUMN     "coverInstitutionId" TEXT;

-- CreateIndex
CREATE INDEX "Tag_coverInstitutionId_idx" ON "Tag"("coverInstitutionId");

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_coverInstitutionId_fkey" FOREIGN KEY ("coverInstitutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
