-- Ledger of one-off data scripts applied to this database (see
-- src/dataMigrations). Each row is a script that has already run.
CREATE TABLE "DataMigration" (
    "name" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataMigration_pkey" PRIMARY KEY ("name")
);
