-- AlterTable
ALTER TABLE "Institution" ADD COLUMN     "pendingChanges" JSONB,
ADD COLUMN     "pendingChangesSubmittedAt" TIMESTAMP(3),
ADD COLUMN     "pendingChangesSubmittedById" TEXT;

-- AlterTable
ALTER TABLE "_InstitutionToTag" ADD CONSTRAINT "_InstitutionToTag_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_InstitutionToTag_AB_unique";

-- CreateIndex
CREATE INDEX "Institution_pendingChangesSubmittedById_idx" ON "Institution"("pendingChangesSubmittedById");

-- AddForeignKey
ALTER TABLE "Institution" ADD CONSTRAINT "Institution_pendingChangesSubmittedById_fkey" FOREIGN KEY ("pendingChangesSubmittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
