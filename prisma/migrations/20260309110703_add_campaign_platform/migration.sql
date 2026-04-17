-- CreateEnum
CREATE TYPE "TokenStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CampaignType" AS ENUM ('SPRINT', 'KARMA', 'CIRCLE', 'COMPETITION');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('TWITTER_FOLLOW', 'TWITTER_RETWEET', 'TWITTER_LIKE', 'TWITTER_POST', 'DISCORD_JOIN', 'TELEGRAM_JOIN', 'CONTENT_CREATION', 'QUIZ', 'SURVEY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "VerificationType" AS ENUM ('AUTO', 'MANUAL', 'HYBRID');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'UNDER_REVIEW');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BadgeTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'LEGEND');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'CAMPAIGN_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'CAMPAIGN_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'TASK_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'TASK_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'PAYMENT_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE 'NEW_CAMPAIGN';
ALTER TYPE "NotificationType" ADD VALUE 'CAMPAIGN_ENDING_SOON';

-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "approval_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "experience_points" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "trust_score" INTEGER NOT NULL DEFAULT 500;

-- CreateTable
CREATE TABLE "tokens" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "contract_address" TEXT,
    "blockchain" TEXT NOT NULL,
    "logo_url" TEXT,
    "website_url" TEXT,
    "twitter_url" TEXT,
    "discord_url" TEXT,
    "telegram_url" TEXT,
    "status" "TokenStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" UUID NOT NULL,
    "token_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "image_url" TEXT,
    "type" "CampaignType" NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "total_reward_pool" DECIMAL(20,8) NOT NULL,
    "participant_limit" INTEGER,
    "participant_count" INTEGER NOT NULL DEFAULT 0,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_participations" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "tasks_completed" INTEGER NOT NULL DEFAULT 0,
    "total_tasks" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "campaign_participations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "TaskType" NOT NULL,
    "verification_type" "VerificationType" NOT NULL,
    "requirements" JSONB,
    "reward_xp" INTEGER NOT NULL,
    "reward_tokens" DECIMAL(20,8) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "estimated_time" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "proof_url" TEXT,
    "proof_text" TEXT,
    "proof_files" TEXT[],
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "rating" INTEGER,
    "feedback" TEXT,
    "approved" BOOLEAN NOT NULL,
    "reviewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "amount" DECIMAL(20,8) NOT NULL,
    "token_symbol" TEXT NOT NULL,
    "blockchain" TEXT NOT NULL,
    "tx_hash" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "failure_reason" TEXT,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badges" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "tier" "BadgeTier" NOT NULL,
    "criteria" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_badges" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "badge_id" UUID NOT NULL,
    "earned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tokens_owner_id_idx" ON "tokens"("owner_id");

-- CreateIndex
CREATE INDEX "tokens_status_idx" ON "tokens"("status");

-- CreateIndex
CREATE INDEX "campaigns_token_id_idx" ON "campaigns"("token_id");

-- CreateIndex
CREATE INDEX "campaigns_owner_id_idx" ON "campaigns"("owner_id");

-- CreateIndex
CREATE INDEX "campaigns_status_idx" ON "campaigns"("status");

-- CreateIndex
CREATE INDEX "campaigns_start_date_end_date_idx" ON "campaigns"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "campaign_participations_user_id_idx" ON "campaign_participations"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_participations_campaign_id_user_id_key" ON "campaign_participations"("campaign_id", "user_id");

-- CreateIndex
CREATE INDEX "tasks_campaign_id_idx" ON "tasks"("campaign_id");

-- CreateIndex
CREATE INDEX "submissions_task_id_idx" ON "submissions"("task_id");

-- CreateIndex
CREATE INDEX "submissions_user_id_idx" ON "submissions"("user_id");

-- CreateIndex
CREATE INDEX "submissions_status_idx" ON "submissions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_submission_id_key" ON "reviews"("submission_id");

-- CreateIndex
CREATE INDEX "reviews_reviewer_id_idx" ON "reviews"("reviewer_id");

-- CreateIndex
CREATE INDEX "payments_campaign_id_idx" ON "payments"("campaign_id");

-- CreateIndex
CREATE INDEX "payments_sender_id_idx" ON "payments"("sender_id");

-- CreateIndex
CREATE INDEX "payments_recipient_id_idx" ON "payments"("recipient_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "badges_name_key" ON "badges"("name");

-- CreateIndex
CREATE INDEX "user_badges_user_id_idx" ON "user_badges"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_badges_user_id_badge_id_key" ON "user_badges"("user_id", "badge_id");

-- AddForeignKey
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_token_id_fkey" FOREIGN KEY ("token_id") REFERENCES "tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_participations" ADD CONSTRAINT "campaign_participations_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_participations" ADD CONSTRAINT "campaign_participations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
