-- CreateTable
CREATE TABLE "sync_bootstrap_state" (
    "id" SERIAL NOT NULL,
    "customer_id" VARCHAR(64) NOT NULL,
    "environment_id" VARCHAR(64) NOT NULL,
    "method" VARCHAR(32) NOT NULL DEFAULT 'db-bootstrap',
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_bootstrap_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sync_bootstrap_state_customer_id_environment_id_key"
ON "sync_bootstrap_state"("customer_id", "environment_id");
