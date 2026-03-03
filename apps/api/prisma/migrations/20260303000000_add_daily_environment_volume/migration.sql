-- CreateTable
CREATE TABLE "daily_environment_volume" (
    "id" SERIAL NOT NULL,
    "customer_id" VARCHAR(64) NOT NULL,
    "environment_id" VARCHAR(64) NOT NULL,
    "volume" DECIMAL(20,2) NOT NULL,
    "date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_environment_volume_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_environment_volume_customer_id_date_idx" ON "daily_environment_volume"("customer_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_environment_volume_customer_id_environment_id_date_key" ON "daily_environment_volume"("customer_id", "environment_id", "date");
