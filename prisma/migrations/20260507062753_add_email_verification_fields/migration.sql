-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email_verification_expiry" TIMESTAMP(3),
ADD COLUMN     "email_verification_token" TEXT,
ADD COLUMN     "password_reset_expiry" TIMESTAMP(3),
ADD COLUMN     "password_reset_token" TEXT;
