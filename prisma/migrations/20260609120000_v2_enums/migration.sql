-- v2 alignment, part 1 of 2 — enum value changes.
-- Enum value renames/additions must land in their own migration: Postgres cannot
-- *use* a value added by ALTER TYPE ... ADD VALUE in the same migration that adds
-- it. The next migration (v2_models) references the rest of the v2 changes.

-- InstitutionType: rename GALLERY -> ART_GALLERY (existing rows update in place),
-- then add the new v2 types.
ALTER TYPE "InstitutionType" RENAME VALUE 'GALLERY' TO 'ART_GALLERY';
ALTER TYPE "InstitutionType" ADD VALUE 'MUSEUM';
ALTER TYPE "InstitutionType" ADD VALUE 'INSTITUTE';
ALTER TYPE "InstitutionType" ADD VALUE 'FOUNDATION';

-- AuditAction: add the granular v2 approval/exhibition actions.
ALTER TYPE "AuditAction" ADD VALUE 'APPROVE_USER';
ALTER TYPE "AuditAction" ADD VALUE 'REJECT_USER';
ALTER TYPE "AuditAction" ADD VALUE 'APPROVE_INSTITUTION';
ALTER TYPE "AuditAction" ADD VALUE 'REJECT_INSTITUTION';
ALTER TYPE "AuditAction" ADD VALUE 'EXHIBITION_CREATE';
ALTER TYPE "AuditAction" ADD VALUE 'EXHIBITION_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE 'EXHIBITION_DELETE';
ALTER TYPE "AuditAction" ADD VALUE 'APPROVE_EXHIBITION';
ALTER TYPE "AuditAction" ADD VALUE 'REJECT_EXHIBITION';
