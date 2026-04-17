-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TaskType" ADD VALUE 'VISIT_LINK';
ALTER TYPE "TaskType" ADD VALUE 'INVITES';
ALTER TYPE "TaskType" ADD VALUE 'PARTNERSHIP';
ALTER TYPE "TaskType" ADD VALUE 'TIKTOK';
ALTER TYPE "TaskType" ADD VALUE 'UPLOAD';
ALTER TYPE "TaskType" ADD VALUE 'POLL';
ALTER TYPE "TaskType" ADD VALUE 'TEXT_ANSWER';
ALTER TYPE "TaskType" ADD VALUE 'NUMBER_ANSWER';
ALTER TYPE "TaskType" ADD VALUE 'URL_ANSWER';
ALTER TYPE "TaskType" ADD VALUE 'TOKEN_HOLD';
ALTER TYPE "TaskType" ADD VALUE 'ONCHAIN_ACTION';
