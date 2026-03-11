-- CreateTable
CREATE TABLE "daily_metrics" (
    "id" SERIAL NOT NULL,
    "customer_id" VARCHAR(64) NOT NULL,
    "date" DATE NOT NULL,
    "crypto_deposit_volume" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "crypto_deposit_count" INTEGER NOT NULL DEFAULT 0,
    "crypto_deposit_fees" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "fiat_deposit_volume" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "fiat_deposit_count" INTEGER NOT NULL DEFAULT 0,
    "fiat_deposit_fees" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "crypto_withdrawal_volume" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "crypto_withdrawal_count" INTEGER NOT NULL DEFAULT 0,
    "crypto_withdrawal_fees" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "fiat_withdrawal_volume" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "fiat_withdrawal_count" INTEGER NOT NULL DEFAULT 0,
    "fiat_withdrawal_fees" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "transfer_volume" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "transfer_count" INTEGER NOT NULL DEFAULT 0,
    "transfer_fees" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "kyt_event_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_metrics_customer_id_date_idx" ON "daily_metrics"("customer_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_metrics_customer_id_date_key" ON "daily_metrics"("customer_id", "date");
