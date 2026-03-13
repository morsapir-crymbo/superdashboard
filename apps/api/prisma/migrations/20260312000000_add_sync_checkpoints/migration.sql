-- CreateTable
CREATE TABLE "sync_checkpoints" (
    "id" SERIAL NOT NULL,
    "customer_id" VARCHAR(64) NOT NULL,
    "environment_id" VARCHAR(64) NOT NULL,
    "source" VARCHAR(32) NOT NULL,
    "last_id" BIGINT NOT NULL,
    "last_updated_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sync_checkpoints_customer_id_environment_id_source_key" ON "sync_checkpoints"("customer_id", "environment_id", "source");

-- CreateIndex
CREATE INDEX "sync_checkpoints_customer_id_environment_id_idx" ON "sync_checkpoints"("customer_id", "environment_id");
