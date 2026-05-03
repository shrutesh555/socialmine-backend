-- CreateEnum
CREATE TYPE "ParticipationRole" AS ENUM ('MINER', 'REVIEWER', 'EDITOR', 'ADMIN');

-- AlterTable
ALTER TABLE "campaign_participations" ADD COLUMN     "role" "ParticipationRole" NOT NULL DEFAULT 'MINER';
