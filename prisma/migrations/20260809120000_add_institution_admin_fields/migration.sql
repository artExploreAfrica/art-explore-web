-- Adds the admin-curated Institution fields the panel needs.
--
-- All five are additive and safe on a populated table:
--   * the three text columns are nullable, so existing rows get NULL
--   * the two booleans carry a DEFAULT, so existing rows get false
-- No backfill required, no rewrite of existing data, no downtime.
--
-- `subArea` in particular closes a long-standing gap: the admin form has been
-- showing a Sub-area input with no column behind it, so every value typed there
-- was silently discarded by the DTO whitelist.

-- AlterTable
ALTER TABLE "Institution"
  ADD COLUMN "subArea"      TEXT,
  ADD COLUMN "mapUrl"       TEXT,
  ADD COLUMN "notes"        TEXT,
  ADD COLUMN "hasResidency" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "hasSocial"    BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Institution_subArea_idx" ON "Institution"("subArea");