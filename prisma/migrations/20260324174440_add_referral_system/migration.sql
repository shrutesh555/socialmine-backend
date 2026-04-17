/*
  Warnings:

  - You are about to drop the column `reward_tokens` on the `tasks` table. All the data in the column will be lost.
  - You are about to drop the column `reward_xp` on the `tasks` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "TaskType" ADD VALUE 'REFERRAL';

-- AlterTable
ALTER TABLE "tasks" DROP COLUMN "reward_tokens",
DROP COLUMN "reward_xp",
ADD COLUMN     "experience_points" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reward" DECIMAL(20,8) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "referred_by" UUID;

-- CreateTable
CREATE TABLE "referral_codes" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "task_id" UUID,
    "times_used" INTEGER NOT NULL DEFAULT 0,
    "max_uses" INTEGER,
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referral_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "referral_codes_code_key" ON "referral_codes"("code");

-- CreateIndex
CREATE INDEX "referral_codes_user_id_idx" ON "referral_codes"("user_id");

-- CreateIndex
CREATE INDEX "referral_codes_campaign_id_idx" ON "referral_codes"("campaign_id");

-- CreateIndex
CREATE INDEX "referral_codes_code_idx" ON "referral_codes"("code");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_referred_by_fkey" FOREIGN KEY ("referred_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_codes" ADD CONSTRAINT "referral_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_codes" ADD CONSTRAINT "referral_codes_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_codes" ADD CONSTRAINT "referral_codes_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
