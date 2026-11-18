-- AlterTable
ALTER TABLE "complaint_evidence" DROP CONSTRAINT "complaint_evidence_pkey",
ADD COLUMN     "id" UUID NOT NULL DEFAULT gen_random_uuid(),
ADD CONSTRAINT "complaint_evidence_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "dispute_evidence" DROP CONSTRAINT "dispute_evidence_pkey",
ADD COLUMN     "id" UUID NOT NULL DEFAULT gen_random_uuid(),
ADD CONSTRAINT "dispute_evidence_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "favourites" DROP CONSTRAINT "favourites_pkey",
ADD COLUMN     "id" UUID NOT NULL DEFAULT gen_random_uuid(),
ADD CONSTRAINT "favourites_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "provider_categories" DROP CONSTRAINT "provider_categories_pkey",
ADD COLUMN     "id" UUID NOT NULL DEFAULT gen_random_uuid(),
ADD CONSTRAINT "provider_categories_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "provider_portfolio_media" DROP CONSTRAINT "provider_portfolio_media_pkey",
ADD COLUMN     "id" UUID NOT NULL DEFAULT gen_random_uuid(),
ADD CONSTRAINT "provider_portfolio_media_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "provider_service_areas" DROP CONSTRAINT "provider_service_areas_pkey",
ADD COLUMN     "id" UUID NOT NULL DEFAULT gen_random_uuid(),
ADD CONSTRAINT "provider_service_areas_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "role_permissions" DROP CONSTRAINT "role_permissions_pkey",
ADD COLUMN     "id" UUID NOT NULL DEFAULT gen_random_uuid(),
ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "service_request_attachments" DROP CONSTRAINT "service_request_attachments_pkey",
ADD COLUMN     "id" UUID NOT NULL DEFAULT gen_random_uuid(),
ADD CONSTRAINT "service_request_attachments_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "service_request_categories" DROP CONSTRAINT "service_request_categories_pkey",
ADD COLUMN     "id" UUID NOT NULL DEFAULT gen_random_uuid(),
ADD CONSTRAINT "service_request_categories_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "system_settings" DROP CONSTRAINT "system_settings_pkey",
ADD COLUMN     "id" UUID NOT NULL DEFAULT gen_random_uuid(),
ADD CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_pkey",
ADD COLUMN     "id" UUID NOT NULL DEFAULT gen_random_uuid(),
ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE UNIQUE INDEX "complaint_evidence_complaint_id_media_file_id_key" ON "complaint_evidence"("complaint_id", "media_file_id");

-- CreateIndex
CREATE UNIQUE INDEX "dispute_evidence_dispute_id_media_file_id_key" ON "dispute_evidence"("dispute_id", "media_file_id");

-- CreateIndex
CREATE UNIQUE INDEX "favourites_customer_id_provider_profile_id_key" ON "favourites"("customer_id", "provider_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_categories_provider_profile_id_category_id_key" ON "provider_categories"("provider_profile_id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_portfolio_media_portfolio_id_media_file_id_key" ON "provider_portfolio_media"("portfolio_id", "media_file_id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_service_areas_provider_profile_id_location_id_key" ON "provider_service_areas"("provider_profile_id", "location_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_request_attachments_service_request_id_media_file_i_key" ON "service_request_attachments"("service_request_id", "media_file_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_request_categories_service_request_id_category_id_key" ON "service_request_categories"("service_request_id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_key" ON "user_roles"("user_id", "role_id");
