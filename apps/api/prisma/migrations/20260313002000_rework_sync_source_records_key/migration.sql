DROP TABLE IF EXISTS "sync_source_records";

CREATE TABLE "sync_source_records" (
    "id" SERIAL NOT NULL,
    "customer_id" VARCHAR(64) NOT NULL,
    "environment_id" VARCHAR(64) NOT NULL,
    "source" VARCHAR(32) NOT NULL,
    "source_key" VARCHAR(255) NOT NULL,
    "event_date" DATE NOT NULL,
    "source_updated_at" TIMESTAMP(3),
    "status" VARCHAR(64),
    "is_included" BOOLEAN NOT NULL DEFAULT false,
    "is_crypto" BOOLEAN,
    "amount_usd" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "fee_usd" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "kyt_event" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_source_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sync_source_records_customer_id_environment_id_source_source_key_key"
ON "sync_source_records"("customer_id", "environment_id", "source", "source_key");

CREATE INDEX "sync_source_records_customer_id_event_date_idx"
ON "sync_source_records"("customer_id", "event_date");
