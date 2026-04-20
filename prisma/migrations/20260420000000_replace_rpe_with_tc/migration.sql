-- AlterTable: Replace rpe with tc in HealthLog
ALTER TABLE "HealthLog" DROP COLUMN "rpe";
ALTER TABLE "HealthLog" ADD COLUMN "tc" INTEGER NOT NULL DEFAULT 5;
