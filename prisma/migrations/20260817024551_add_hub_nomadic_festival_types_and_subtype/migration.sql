-- CreateEnum
CREATE TYPE "InstitutionSubType" AS ENUM ('ART_GALLERY', 'MUSEUM', 'INSTITUTE', 'FOUNDATION', 'STUDIO', 'CULTURAL_SPACE', 'ONLINE', 'ART_FESTIVAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InstitutionType" ADD VALUE 'HUB_INSTITUTION';
ALTER TYPE "InstitutionType" ADD VALUE 'NOMADIC_SPACE';
ALTER TYPE "InstitutionType" ADD VALUE 'ART_FESTIVAL';

-- AlterTable
ALTER TABLE "Institution" ADD COLUMN     "subType" "InstitutionSubType",
ALTER COLUMN "address" DROP NOT NULL,
ALTER COLUMN "area" DROP NOT NULL,
ALTER COLUMN "lat" DROP NOT NULL,
ALTER COLUMN "lng" DROP NOT NULL;