-- AlterTable
ALTER TABLE "Environment" ADD COLUMN     "comment" TEXT,
ADD COLUMN     "customer_type" TEXT,
ADD COLUMN     "go_live_date" DATE,
ADD COLUMN     "open_requests" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "signed_date" DATE,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'onboarding',
ALTER COLUMN "version" SET DEFAULT '0.0.0';
