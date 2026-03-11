-- AlterTable
ALTER TABLE "daily_metrics" ADD COLUMN     "trade_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "trade_fees" DECIMAL(20,2) NOT NULL DEFAULT 0,
ADD COLUMN     "trade_volume" DECIMAL(20,2) NOT NULL DEFAULT 0;
