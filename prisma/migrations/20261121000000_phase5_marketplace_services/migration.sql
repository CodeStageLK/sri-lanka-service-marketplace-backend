CREATE TABLE "provider_services" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "provider_profile_id" UUID NOT NULL,
  "service_id" UUID NOT NULL,
  "description" TEXT,
  "price_from" DECIMAL(12,2),
  "price_to" DECIMAL(12,2),
  "currency" CHAR(3) NOT NULL DEFAULT 'LKR',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "provider_services_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "provider_services_provider_profile_id_service_id_key"
  ON "provider_services"("provider_profile_id", "service_id");
CREATE INDEX "provider_services_service_id_is_active_provider_profile_id_idx"
  ON "provider_services"("service_id", "is_active", "provider_profile_id");

ALTER TABLE "provider_services"
  ADD CONSTRAINT "provider_services_provider_profile_id_fkey"
  FOREIGN KEY ("provider_profile_id") REFERENCES "provider_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "provider_services_service_id_fkey"
  FOREIGN KEY ("service_id") REFERENCES "services"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "service_request_services" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "service_request_id" UUID NOT NULL,
  "service_id" UUID NOT NULL,
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_request_services_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_request_services_service_request_id_service_id_key"
  ON "service_request_services"("service_request_id", "service_id");
CREATE INDEX "service_request_services_service_id_service_request_id_idx"
  ON "service_request_services"("service_id", "service_request_id");

ALTER TABLE "service_request_services"
  ADD CONSTRAINT "service_request_services_service_request_id_fkey"
  FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "service_request_services_service_id_fkey"
  FOREIGN KEY ("service_id") REFERENCES "services"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
