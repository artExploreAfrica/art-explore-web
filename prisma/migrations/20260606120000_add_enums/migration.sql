-- Enum additions must land in their own migration: Postgres cannot use a value
-- added by ALTER TYPE ... ADD VALUE in the same migration that adds it. The
-- next migration (add_features) references these new values.

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'USER';

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'SUBMIT';
ALTER TYPE "AuditAction" ADD VALUE 'APPROVE';
ALTER TYPE "AuditAction" ADD VALUE 'REJECT';

-- AlterEnum
ALTER TYPE "TargetModel" ADD VALUE 'SUBCATEGORY';
ALTER TYPE "TargetModel" ADD VALUE 'TAG';
ALTER TYPE "TargetModel" ADD VALUE 'EXHIBITION';
