-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'PENDING', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "provider_type" AS ENUM ('INDIVIDUAL', 'BUSINESS');

-- CreateEnum
CREATE TYPE "verification_status" AS ENUM ('NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED', 'NEEDS_INFORMATION');

-- CreateEnum
CREATE TYPE "verification_type" AS ENUM ('IDENTITY', 'BUSINESS_REGISTRATION', 'PROFESSIONAL_QUALIFICATION', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "document_type" AS ENUM ('IDENTITY', 'BUSINESS_REGISTRATION', 'PROFESSIONAL_QUALIFICATION', 'OTHER');

-- CreateEnum
CREATE TYPE "location_type" AS ENUM ('PROVINCE', 'DISTRICT', 'CITY', 'TOWN');

-- CreateEnum
CREATE TYPE "service_pricing_type" AS ENUM ('FIXED', 'HOURLY', 'QUOTE_BASED');

-- CreateEnum
CREATE TYPE "service_request_status" AS ENUM ('DRAFT', 'OPEN', 'QUOTED', 'ACCEPTED', 'CLOSED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "service_urgency" AS ENUM ('FLEXIBLE', 'NORMAL', 'URGENT', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "delivery_status" AS ENUM ('PENDING', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "provider_response_status" AS ENUM ('PENDING', 'VIEWED', 'RESPONDED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "enquiry_status" AS ENUM ('OPEN', 'RESPONDED', 'CLOSED', 'SPAM');

-- CreateEnum
CREATE TYPE "quotation_status" AS ENUM ('DRAFT', 'SUBMITTED', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "booking_status" AS ENUM ('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "review_status" AS ENUM ('PENDING', 'PUBLISHED', 'HIDDEN', 'REMOVED');

-- CreateEnum
CREATE TYPE "availability_exception_type" AS ENUM ('SPECIAL_AVAILABILITY', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "billing_period" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "subscription_transaction_status" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "commission_rule_type" AS ENUM ('COMMISSION_PERCENTAGE', 'LEAD_CHARGE');

-- CreateEnum
CREATE TYPE "lead_transaction_status" AS ENUM ('PENDING', 'CHARGED', 'WAIVED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "advertisement_placement_type" AS ENUM ('FEATURED_PROVIDER', 'SPONSORED_LISTING');

-- CreateEnum
CREATE TYPE "campaign_status" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "refund_status" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "financial_transaction_type" AS ENUM ('PAYMENT', 'REFUND', 'COMMISSION', 'PROVIDER_PAYOUT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "financial_transaction_status" AS ENUM ('PENDING', 'POSTED', 'FAILED', 'VOIDED');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('SERVICE_REQUEST', 'NEW_QUOTATION', 'QUOTATION_ACCEPTED', 'BOOKING_CONFIRMED', 'BOOKING_UPDATED', 'BOOKING_COMPLETED', 'REVIEW_RECEIVED', 'VERIFICATION_UPDATED', 'SUBSCRIPTION_UPDATED', 'SYSTEM_ANNOUNCEMENT');

-- CreateEnum
CREATE TYPE "complaint_status" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "dispute_status" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED', 'ESCALATED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(320),
    "normalized_email" VARCHAR(320),
    "phone_number" VARCHAR(16),
    "password_hash" TEXT,
    "status" "user_status" NOT NULL DEFAULT 'PENDING',
    "is_email_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_phone_verified" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "granted_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "ip_address" INET,
    "user_agent" TEXT,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "last_seen_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "first_name" VARCHAR(120) NOT NULL,
    "last_name" VARCHAR(120) NOT NULL,
    "profile_image_id" UUID,
    "preferred_contact_email" VARCHAR(320),
    "preferred_contact_phone" VARCHAR(16),
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_addresses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "location_id" UUID,
    "label" VARCHAR(80) NOT NULL,
    "address_line1" VARCHAR(255) NOT NULL,
    "address_line2" VARCHAR(255),
    "city_name" VARCHAR(120),
    "postal_code" VARCHAR(20),
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "provider_type" "provider_type" NOT NULL,
    "display_name" VARCHAR(180) NOT NULL,
    "description" TEXT,
    "experience_years" SMALLINT,
    "profile_image_id" UUID,
    "contact_email" VARCHAR(320),
    "contact_phone" VARCHAR(16),
    "verification_status" "verification_status" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "average_rating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "total_reviews" INTEGER NOT NULL DEFAULT 0,
    "profile_completion" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "provider_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_business_details" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider_profile_id" UUID NOT NULL,
    "business_name" VARCHAR(180) NOT NULL,
    "registration_number" VARCHAR(120),
    "business_address" TEXT,
    "contact_person_name" VARCHAR(180),
    "contact_email" VARCHAR(320),
    "contact_phone" VARCHAR(16),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_business_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_verifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider_profile_id" UUID NOT NULL,
    "type" "verification_type" NOT NULL,
    "status" "verification_status" NOT NULL DEFAULT 'PENDING',
    "reviewer_id" UUID,
    "review_comments" TEXT,
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider_profile_id" UUID NOT NULL,
    "verification_id" UUID,
    "media_file_id" UUID NOT NULL,
    "type" "document_type" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_portfolio" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider_profile_id" UUID NOT NULL,
    "title" VARCHAR(180),
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_portfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_portfolio_media" (
    "portfolio_id" UUID NOT NULL,
    "media_file_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_portfolio_media_pkey" PRIMARY KEY ("portfolio_id","media_file_id")
);

-- CreateTable
CREATE TABLE "provider_categories" (
    "provider_profile_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_categories_pkey" PRIMARY KEY ("provider_profile_id","category_id")
);

-- CreateTable
CREATE TABLE "provider_service_areas" (
    "provider_profile_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_service_areas_pkey" PRIMARY KEY ("provider_profile_id","location_id")
);

-- CreateTable
CREATE TABLE "provider_availability" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider_profile_id" UUID NOT NULL,
    "day_of_week" SMALLINT NOT NULL,
    "start_time" TIME(0) NOT NULL,
    "end_time" TIME(0) NOT NULL,
    "time_zone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Colombo',
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_availability_exceptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider_profile_id" UUID NOT NULL,
    "type" "availability_exception_type" NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_availability_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "parent_id" UUID,
    "slug" VARCHAR(180) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "name_si" VARCHAR(160),
    "name_ta" VARCHAR(160),
    "description" TEXT,
    "image_key" VARCHAR(1024),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category_id" UUID NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "description" TEXT,
    "pricing_type" "service_pricing_type" NOT NULL DEFAULT 'QUOTE_BASED',
    "price_from" DECIMAL(12,2),
    "price_to" DECIMAL(12,2),
    "currency" CHAR(3) NOT NULL DEFAULT 'LKR',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "parent_id" UUID,
    "type" "location_type" NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "name_si" VARCHAR(160),
    "name_ta" VARCHAR(160),
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "address_id" UUID,
    "location_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "preferred_date" TIMESTAMPTZ(6),
    "urgency" "service_urgency" NOT NULL DEFAULT 'NORMAL',
    "budget_min" DECIMAL(12,2),
    "budget_max" DECIMAL(12,2),
    "currency" CHAR(3) NOT NULL DEFAULT 'LKR',
    "status" "service_request_status" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_request_categories" (
    "service_request_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_request_categories_pkey" PRIMARY KEY ("service_request_id","category_id")
);

-- CreateTable
CREATE TABLE "service_request_attachments" (
    "service_request_id" UUID NOT NULL,
    "media_file_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_request_attachments_pkey" PRIMARY KEY ("service_request_id","media_file_id")
);

-- CreateTable
CREATE TABLE "service_request_recipients" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "service_request_id" UUID NOT NULL,
    "provider_profile_id" UUID NOT NULL,
    "delivery_status" "delivery_status" NOT NULL DEFAULT 'PENDING',
    "response_status" "provider_response_status" NOT NULL DEFAULT 'PENDING',
    "delivered_at" TIMESTAMPTZ(6),
    "responded_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_request_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enquiries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "provider_profile_id" UUID NOT NULL,
    "service_request_id" UUID,
    "subject" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "status" "enquiry_status" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "service_request_id" UUID NOT NULL,
    "provider_profile_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "reference" VARCHAR(40) NOT NULL,
    "description" TEXT NOT NULL,
    "proposed_price" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'LKR',
    "estimated_completion" VARCHAR(180),
    "valid_until" TIMESTAMPTZ(6) NOT NULL,
    "terms_and_conditions" TEXT,
    "status" "quotation_status" NOT NULL DEFAULT 'DRAFT',
    "submitted_at" TIMESTAMPTZ(6),
    "viewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quotation_id" UUID NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reference" VARCHAR(40) NOT NULL,
    "service_request_id" UUID NOT NULL,
    "quotation_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "provider_profile_id" UUID NOT NULL,
    "agreed_price" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'LKR',
    "scheduled_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "status" "booking_status" NOT NULL DEFAULT 'PENDING',
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_status_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "from_status" "booking_status",
    "to_status" "booking_status" NOT NULL,
    "changed_by_id" UUID,
    "note" TEXT,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "provider_profile_id" UUID NOT NULL,
    "rating" SMALLINT NOT NULL,
    "description" TEXT,
    "status" "review_status" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_responses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "review_id" UUID NOT NULL,
    "provider_profile_id" UUID NOT NULL,
    "response" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favourites" (
    "customer_id" UUID NOT NULL,
    "provider_profile_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favourites_pkey" PRIMARY KEY ("customer_id","provider_profile_id")
);

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "monthly_price" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'LKR',
    "benefits" JSONB NOT NULL DEFAULT '[]',
    "lead_limit" INTEGER,
    "is_featured_eligible" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider_profile_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" "subscription_status" NOT NULL DEFAULT 'PENDING',
    "billing_period" "billing_period" NOT NULL DEFAULT 'MONTHLY',
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "auto_renew" BOOLEAN NOT NULL DEFAULT false,
    "cancelled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "subscription_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'LKR',
    "status" "subscription_transaction_status" NOT NULL DEFAULT 'PENDING',
    "external_reference" VARCHAR(180),
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rule_key" VARCHAR(120) NOT NULL,
    "type" "commission_rule_type" NOT NULL,
    "category_id" UUID,
    "commission_percentage" DECIMAL(5,2),
    "lead_charge" DECIMAL(12,2),
    "currency" CHAR(3) NOT NULL DEFAULT 'LKR',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_until" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider_profile_id" UUID NOT NULL,
    "service_request_id" UUID NOT NULL,
    "setting_id" UUID,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'LKR',
    "status" "lead_transaction_status" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advertisement_campaigns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(180) NOT NULL,
    "placement_type" "advertisement_placement_type" NOT NULL,
    "status" "campaign_status" NOT NULL DEFAULT 'DRAFT',
    "starts_at" TIMESTAMPTZ(6),
    "ends_at" TIMESTAMPTZ(6),
    "budget" DECIMAL(12,2),
    "currency" CHAR(3) NOT NULL DEFAULT 'LKR',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "advertisement_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advertisements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "campaign_id" UUID NOT NULL,
    "provider_profile_id" UUID NOT NULL,
    "placement_type" "advertisement_placement_type" NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "campaign_status" NOT NULL DEFAULT 'SCHEDULED',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "advertisements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reference" VARCHAR(60) NOT NULL,
    "booking_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "provider_profile_id" UUID,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'LKR',
    "status" "payment_status" NOT NULL DEFAULT 'PENDING',
    "payment_provider" VARCHAR(80),
    "external_reference" VARCHAR(180),
    "idempotency_key" VARCHAR(180) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'LKR',
    "status" "refund_status" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "external_reference" VARCHAR(180),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_id" UUID,
    "refund_id" UUID,
    "type" "financial_transaction_type" NOT NULL,
    "status" "financial_transaction_status" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'LKR',
    "description" TEXT,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" "notification_type" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(120) NOT NULL,
    "type" "notification_type" NOT NULL,
    "subject" VARCHAR(200),
    "body" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaints" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID,
    "reporter_id" UUID NOT NULL,
    "assignee_id" UUID,
    "description" TEXT NOT NULL,
    "status" "complaint_status" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complaints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaint_evidence" (
    "complaint_id" UUID NOT NULL,
    "media_file_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complaint_evidence_pkey" PRIMARY KEY ("complaint_id","media_file_id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "assignee_id" UUID,
    "description" TEXT NOT NULL,
    "status" "dispute_status" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute_evidence" (
    "dispute_id" UUID NOT NULL,
    "media_file_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispute_evidence_pkey" PRIMARY KEY ("dispute_id","media_file_id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" UUID,
    "action" VARCHAR(120) NOT NULL,
    "entity_type" VARCHAR(120) NOT NULL,
    "entity_id" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "request_correlation_id" VARCHAR(120),
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" VARCHAR(160) NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "media_files" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_user_id" UUID,
    "object_key" VARCHAR(1024) NOT NULL,
    "original_filename" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(160) NOT NULL,
    "file_size_bytes" BIGINT NOT NULL,
    "storage_service" VARCHAR(80) NOT NULL DEFAULT 'neon_object_storage',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_normalized_email_key" ON "users"("normalized_email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_number_key" ON "users"("phone_number");

-- CreateIndex
CREATE INDEX "users_status_created_at_idx" ON "users"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

-- CreateIndex
CREATE INDEX "user_roles_granted_by_idx" ON "user_roles"("granted_by");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_expires_at_idx" ON "refresh_tokens"("user_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_token_hash_key" ON "user_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_expires_at_idx" ON "user_sessions"("user_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "customer_profiles_user_id_key" ON "customer_profiles"("user_id");

-- CreateIndex
CREATE INDEX "customer_profiles_profile_image_id_idx" ON "customer_profiles"("profile_image_id");

-- CreateIndex
CREATE INDEX "customer_addresses_customer_id_is_default_idx" ON "customer_addresses"("customer_id", "is_default");

-- CreateIndex
CREATE INDEX "customer_addresses_location_id_idx" ON "customer_addresses"("location_id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_profiles_user_id_key" ON "provider_profiles"("user_id");

-- CreateIndex
CREATE INDEX "provider_profiles_verification_status_is_active_created_at_idx" ON "provider_profiles"("verification_status", "is_active", "created_at");

-- CreateIndex
CREATE INDEX "provider_profiles_average_rating_id_idx" ON "provider_profiles"("average_rating" DESC, "id");

-- CreateIndex
CREATE INDEX "provider_profiles_profile_image_id_idx" ON "provider_profiles"("profile_image_id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_business_details_provider_profile_id_key" ON "provider_business_details"("provider_profile_id");

-- CreateIndex
CREATE INDEX "provider_verifications_provider_profile_id_type_status_idx" ON "provider_verifications"("provider_profile_id", "type", "status");

-- CreateIndex
CREATE INDEX "provider_verifications_reviewer_id_idx" ON "provider_verifications"("reviewer_id");

-- CreateIndex
CREATE INDEX "provider_documents_provider_profile_id_type_idx" ON "provider_documents"("provider_profile_id", "type");

-- CreateIndex
CREATE INDEX "provider_documents_verification_id_idx" ON "provider_documents"("verification_id");

-- CreateIndex
CREATE INDEX "provider_documents_media_file_id_idx" ON "provider_documents"("media_file_id");

-- CreateIndex
CREATE INDEX "provider_portfolio_provider_profile_id_sort_order_idx" ON "provider_portfolio"("provider_profile_id", "sort_order");

-- CreateIndex
CREATE INDEX "provider_portfolio_media_media_file_id_idx" ON "provider_portfolio_media"("media_file_id");

-- CreateIndex
CREATE INDEX "provider_categories_category_id_provider_profile_id_idx" ON "provider_categories"("category_id", "provider_profile_id");

-- CreateIndex
CREATE INDEX "provider_service_areas_location_id_provider_profile_id_idx" ON "provider_service_areas"("location_id", "provider_profile_id");

-- CreateIndex
CREATE INDEX "provider_availability_provider_profile_id_is_available_idx" ON "provider_availability"("provider_profile_id", "is_available");

-- CreateIndex
CREATE UNIQUE INDEX "provider_availability_provider_profile_id_day_of_week_key" ON "provider_availability"("provider_profile_id", "day_of_week");

-- CreateIndex
CREATE INDEX "provider_availability_exceptions_provider_profile_id_starts_idx" ON "provider_availability_exceptions"("provider_profile_id", "starts_at", "ends_at");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_parent_id_sort_order_idx" ON "categories"("parent_id", "sort_order");

-- CreateIndex
CREATE INDEX "categories_is_active_sort_order_idx" ON "categories"("is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "services_slug_key" ON "services"("slug");

-- CreateIndex
CREATE INDEX "services_category_id_is_active_idx" ON "services"("category_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "locations_slug_key" ON "locations"("slug");

-- CreateIndex
CREATE INDEX "locations_parent_id_type_name_idx" ON "locations"("parent_id", "type", "name");

-- CreateIndex
CREATE INDEX "locations_type_is_active_name_idx" ON "locations"("type", "is_active", "name");

-- CreateIndex
CREATE UNIQUE INDEX "locations_parent_id_slug_key" ON "locations"("parent_id", "slug");

-- CreateIndex
CREATE INDEX "service_requests_customer_id_created_at_idx" ON "service_requests"("customer_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "service_requests_location_id_status_created_at_idx" ON "service_requests"("location_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "service_requests_status_urgency_preferred_date_idx" ON "service_requests"("status", "urgency", "preferred_date");

-- CreateIndex
CREATE INDEX "service_requests_address_id_idx" ON "service_requests"("address_id");

-- CreateIndex
CREATE INDEX "service_request_categories_category_id_service_request_id_idx" ON "service_request_categories"("category_id", "service_request_id");

-- CreateIndex
CREATE INDEX "service_request_attachments_media_file_id_idx" ON "service_request_attachments"("media_file_id");

-- CreateIndex
CREATE INDEX "service_request_recipients_provider_profile_id_response_sta_idx" ON "service_request_recipients"("provider_profile_id", "response_status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "service_request_recipients_service_request_id_delivery_stat_idx" ON "service_request_recipients"("service_request_id", "delivery_status");

-- CreateIndex
CREATE UNIQUE INDEX "service_request_recipients_service_request_id_provider_prof_key" ON "service_request_recipients"("service_request_id", "provider_profile_id");

-- CreateIndex
CREATE INDEX "enquiries_provider_profile_id_status_created_at_idx" ON "enquiries"("provider_profile_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "enquiries_customer_id_created_at_idx" ON "enquiries"("customer_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "enquiries_service_request_id_idx" ON "enquiries"("service_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_reference_key" ON "quotations"("reference");

-- CreateIndex
CREATE INDEX "quotations_service_request_id_status_created_at_idx" ON "quotations"("service_request_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "quotations_provider_profile_id_status_created_at_idx" ON "quotations"("provider_profile_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "quotations_customer_id_created_at_idx" ON "quotations"("customer_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "quotation_items_quotation_id_sort_order_idx" ON "quotation_items"("quotation_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_reference_key" ON "bookings"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_service_request_id_key" ON "bookings"("service_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_quotation_id_key" ON "bookings"("quotation_id");

-- CreateIndex
CREATE INDEX "bookings_customer_id_status_created_at_idx" ON "bookings"("customer_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "bookings_provider_profile_id_status_scheduled_at_idx" ON "bookings"("provider_profile_id", "status", "scheduled_at");

-- CreateIndex
CREATE INDEX "bookings_status_scheduled_at_idx" ON "bookings"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "booking_status_history_booking_id_changed_at_idx" ON "booking_status_history"("booking_id", "changed_at");

-- CreateIndex
CREATE INDEX "booking_status_history_changed_by_id_idx" ON "booking_status_history"("changed_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_booking_id_key" ON "reviews"("booking_id");

-- CreateIndex
CREATE INDEX "reviews_provider_profile_id_status_created_at_idx" ON "reviews"("provider_profile_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "reviews_customer_id_created_at_idx" ON "reviews"("customer_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "review_responses_review_id_key" ON "review_responses"("review_id");

-- CreateIndex
CREATE INDEX "review_responses_provider_profile_id_created_at_idx" ON "review_responses"("provider_profile_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "favourites_provider_profile_id_created_at_idx" ON "favourites"("provider_profile_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_code_key" ON "subscription_plans"("code");

-- CreateIndex
CREATE INDEX "subscription_plans_is_active_monthly_price_idx" ON "subscription_plans"("is_active", "monthly_price");

-- CreateIndex
CREATE INDEX "subscriptions_provider_profile_id_status_expires_at_idx" ON "subscriptions"("provider_profile_id", "status", "expires_at");

-- CreateIndex
CREATE INDEX "subscriptions_plan_id_idx" ON "subscriptions"("plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_transactions_external_reference_key" ON "subscription_transactions"("external_reference");

-- CreateIndex
CREATE INDEX "subscription_transactions_subscription_id_occurred_at_idx" ON "subscription_transactions"("subscription_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "subscription_transactions_status_occurred_at_idx" ON "subscription_transactions"("status", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "commission_settings_rule_key_key" ON "commission_settings"("rule_key");

-- CreateIndex
CREATE INDEX "commission_settings_category_id_type_is_active_effective_fr_idx" ON "commission_settings"("category_id", "type", "is_active", "effective_from");

-- CreateIndex
CREATE INDEX "lead_transactions_provider_profile_id_status_created_at_idx" ON "lead_transactions"("provider_profile_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "lead_transactions_service_request_id_idx" ON "lead_transactions"("service_request_id");

-- CreateIndex
CREATE INDEX "lead_transactions_setting_id_idx" ON "lead_transactions"("setting_id");

-- CreateIndex
CREATE UNIQUE INDEX "lead_transactions_provider_profile_id_service_request_id_key" ON "lead_transactions"("provider_profile_id", "service_request_id");

-- CreateIndex
CREATE INDEX "advertisement_campaigns_status_starts_at_ends_at_idx" ON "advertisement_campaigns"("status", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "advertisements_provider_profile_id_status_starts_at_ends_at_idx" ON "advertisements"("provider_profile_id", "status", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "advertisements_campaign_id_status_idx" ON "advertisements"("campaign_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payments_reference_key" ON "payments"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "payments_external_reference_key" ON "payments"("external_reference");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "payments_booking_id_status_idx" ON "payments"("booking_id", "status");

-- CreateIndex
CREATE INDEX "payments_customer_id_created_at_idx" ON "payments"("customer_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "payments_provider_profile_id_created_at_idx" ON "payments"("provider_profile_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "refunds_external_reference_key" ON "refunds"("external_reference");

-- CreateIndex
CREATE INDEX "refunds_payment_id_status_idx" ON "refunds"("payment_id", "status");

-- CreateIndex
CREATE INDEX "financial_transactions_payment_id_occurred_at_idx" ON "financial_transactions"("payment_id", "occurred_at");

-- CreateIndex
CREATE INDEX "financial_transactions_refund_id_occurred_at_idx" ON "financial_transactions"("refund_id", "occurred_at");

-- CreateIndex
CREATE INDEX "financial_transactions_type_status_occurred_at_idx" ON "financial_transactions"("type", "status", "occurred_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_code_key" ON "notification_templates"("code");

-- CreateIndex
CREATE INDEX "notification_templates_type_is_active_idx" ON "notification_templates"("type", "is_active");

-- CreateIndex
CREATE INDEX "complaints_status_created_at_idx" ON "complaints"("status", "created_at");

-- CreateIndex
CREATE INDEX "complaints_reporter_id_created_at_idx" ON "complaints"("reporter_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "complaints_assignee_id_status_idx" ON "complaints"("assignee_id", "status");

-- CreateIndex
CREATE INDEX "complaints_booking_id_idx" ON "complaints"("booking_id");

-- CreateIndex
CREATE INDEX "complaint_evidence_media_file_id_idx" ON "complaint_evidence"("media_file_id");

-- CreateIndex
CREATE INDEX "disputes_booking_id_status_idx" ON "disputes"("booking_id", "status");

-- CreateIndex
CREATE INDEX "disputes_status_created_at_idx" ON "disputes"("status", "created_at");

-- CreateIndex
CREATE INDEX "disputes_reporter_id_created_at_idx" ON "disputes"("reporter_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "disputes_assignee_id_status_idx" ON "disputes"("assignee_id", "status");

-- CreateIndex
CREATE INDEX "dispute_evidence_media_file_id_idx" ON "dispute_evidence"("media_file_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_occurred_at_idx" ON "audit_logs"("actor_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_occurred_at_idx" ON "audit_logs"("entity_type", "entity_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_request_correlation_id_idx" ON "audit_logs"("request_correlation_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_files_object_key_key" ON "media_files"("object_key");

-- CreateIndex
CREATE INDEX "media_files_owner_user_id_uploaded_at_idx" ON "media_files"("owner_user_id", "uploaded_at" DESC);

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_profile_image_id_fkey" FOREIGN KEY ("profile_image_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_profiles" ADD CONSTRAINT "provider_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_profiles" ADD CONSTRAINT "provider_profiles_profile_image_id_fkey" FOREIGN KEY ("profile_image_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_business_details" ADD CONSTRAINT "provider_business_details_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "provider_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_verifications" ADD CONSTRAINT "provider_verifications_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "provider_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_verifications" ADD CONSTRAINT "provider_verifications_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_documents" ADD CONSTRAINT "provider_documents_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "provider_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_documents" ADD CONSTRAINT "provider_documents_verification_id_fkey" FOREIGN KEY ("verification_id") REFERENCES "provider_verifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_documents" ADD CONSTRAINT "provider_documents_media_file_id_fkey" FOREIGN KEY ("media_file_id") REFERENCES "media_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_portfolio" ADD CONSTRAINT "provider_portfolio_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "provider_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_portfolio_media" ADD CONSTRAINT "provider_portfolio_media_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "provider_portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_portfolio_media" ADD CONSTRAINT "provider_portfolio_media_media_file_id_fkey" FOREIGN KEY ("media_file_id") REFERENCES "media_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_categories" ADD CONSTRAINT "provider_categories_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "provider_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_categories" ADD CONSTRAINT "provider_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_service_areas" ADD CONSTRAINT "provider_service_areas_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "provider_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_service_areas" ADD CONSTRAINT "provider_service_areas_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_availability" ADD CONSTRAINT "provider_availability_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "provider_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_availability_exceptions" ADD CONSTRAINT "provider_availability_exceptions_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "provider_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "customer_addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_request_categories" ADD CONSTRAINT "service_request_categories_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_request_categories" ADD CONSTRAINT "service_request_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_request_attachments" ADD CONSTRAINT "service_request_attachments_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_request_attachments" ADD CONSTRAINT "service_request_attachments_media_file_id_fkey" FOREIGN KEY ("media_file_id") REFERENCES "media_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_request_recipients" ADD CONSTRAINT "service_request_recipients_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_request_recipients" ADD CONSTRAINT "service_request_recipients_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "provider_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "provider_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "provider_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "provider_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "provider_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_responses" ADD CONSTRAINT "review_responses_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_responses" ADD CONSTRAINT "review_responses_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "provider_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favourites" ADD CONSTRAINT "favourites_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favourites" ADD CONSTRAINT "favourites_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "provider_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "provider_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_transactions" ADD CONSTRAINT "subscription_transactions_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_settings" ADD CONSTRAINT "commission_settings_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_transactions" ADD CONSTRAINT "lead_transactions_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "provider_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_transactions" ADD CONSTRAINT "lead_transactions_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_transactions" ADD CONSTRAINT "lead_transactions_setting_id_fkey" FOREIGN KEY ("setting_id") REFERENCES "commission_settings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advertisements" ADD CONSTRAINT "advertisements_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "advertisement_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advertisements" ADD CONSTRAINT "advertisements_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "provider_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "provider_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "refunds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_evidence" ADD CONSTRAINT "complaint_evidence_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_evidence" ADD CONSTRAINT "complaint_evidence_media_file_id_fkey" FOREIGN KEY ("media_file_id") REFERENCES "media_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_dispute_id_fkey" FOREIGN KEY ("dispute_id") REFERENCES "disputes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_media_file_id_fkey" FOREIGN KEY ("media_file_id") REFERENCES "media_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Normalize lookup keys and guard values that are not representable in Prisma's schema DSL.
ALTER TABLE "users"
    ADD CONSTRAINT "users_email_normalization_check"
    CHECK (
        ("email" IS NULL AND "normalized_email" IS NULL)
        OR ("email" IS NOT NULL AND "normalized_email" = lower(btrim("email")))
    );

ALTER TABLE "provider_profiles"
    ADD CONSTRAINT "provider_profiles_rating_range_check"
        CHECK ("average_rating" BETWEEN 0 AND 5),
    ADD CONSTRAINT "provider_profiles_total_reviews_nonnegative_check"
        CHECK ("total_reviews" >= 0),
    ADD CONSTRAINT "provider_profiles_completion_range_check"
        CHECK ("profile_completion" BETWEEN 0 AND 100),
    ADD CONSTRAINT "provider_profiles_experience_nonnegative_check"
        CHECK ("experience_years" IS NULL OR "experience_years" >= 0);

ALTER TABLE "customer_addresses"
    ADD CONSTRAINT "customer_addresses_coordinates_pair_check"
        CHECK (("latitude" IS NULL) = ("longitude" IS NULL)),
    ADD CONSTRAINT "customer_addresses_latitude_range_check"
        CHECK ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90),
    ADD CONSTRAINT "customer_addresses_longitude_range_check"
        CHECK ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180);

ALTER TABLE "locations"
    ADD CONSTRAINT "locations_coordinates_pair_check"
        CHECK (("latitude" IS NULL) = ("longitude" IS NULL)),
    ADD CONSTRAINT "locations_latitude_range_check"
        CHECK ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90),
    ADD CONSTRAINT "locations_longitude_range_check"
        CHECK ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180);

ALTER TABLE "services"
    ADD CONSTRAINT "services_price_from_nonnegative_check"
        CHECK ("price_from" IS NULL OR "price_from" >= 0),
    ADD CONSTRAINT "services_price_to_nonnegative_check"
        CHECK ("price_to" IS NULL OR "price_to" >= 0),
    ADD CONSTRAINT "services_price_range_check"
        CHECK ("price_from" IS NULL OR "price_to" IS NULL OR "price_to" >= "price_from");

ALTER TABLE "service_requests"
    ADD CONSTRAINT "service_requests_budget_min_nonnegative_check"
        CHECK ("budget_min" IS NULL OR "budget_min" >= 0),
    ADD CONSTRAINT "service_requests_budget_max_nonnegative_check"
        CHECK ("budget_max" IS NULL OR "budget_max" >= 0),
    ADD CONSTRAINT "service_requests_budget_range_check"
        CHECK ("budget_min" IS NULL OR "budget_max" IS NULL OR "budget_max" >= "budget_min");

ALTER TABLE "provider_availability"
    ADD CONSTRAINT "provider_availability_day_range_check"
        CHECK ("day_of_week" BETWEEN 1 AND 7),
    ADD CONSTRAINT "provider_availability_time_range_check"
        CHECK ("start_time" < "end_time");

ALTER TABLE "provider_availability_exceptions"
    ADD CONSTRAINT "provider_availability_exceptions_time_range_check"
        CHECK ("starts_at" < "ends_at");

ALTER TABLE "quotations"
    ADD CONSTRAINT "quotations_proposed_price_positive_check"
        CHECK ("proposed_price" > 0);

ALTER TABLE "quotation_items"
    ADD CONSTRAINT "quotation_items_quantity_positive_check"
        CHECK ("quantity" > 0),
    ADD CONSTRAINT "quotation_items_unit_price_nonnegative_check"
        CHECK ("unit_price" >= 0);

ALTER TABLE "bookings"
    ADD CONSTRAINT "bookings_agreed_price_nonnegative_check"
        CHECK ("agreed_price" >= 0);

ALTER TABLE "reviews"
    ADD CONSTRAINT "reviews_rating_range_check"
        CHECK ("rating" BETWEEN 1 AND 5);

ALTER TABLE "subscription_plans"
    ADD CONSTRAINT "subscription_plans_monthly_price_nonnegative_check"
        CHECK ("monthly_price" >= 0),
    ADD CONSTRAINT "subscription_plans_lead_limit_nonnegative_check"
        CHECK ("lead_limit" IS NULL OR "lead_limit" >= 0);

ALTER TABLE "subscriptions"
    ADD CONSTRAINT "subscriptions_period_range_check"
        CHECK ("starts_at" < "expires_at");

ALTER TABLE "subscription_transactions"
    ADD CONSTRAINT "subscription_transactions_amount_nonnegative_check"
        CHECK ("amount" >= 0);

ALTER TABLE "commission_settings"
    ADD CONSTRAINT "commission_settings_rule_value_check"
        CHECK (
            ("type" = 'COMMISSION_PERCENTAGE'
                AND "commission_percentage" BETWEEN 0 AND 100
                AND "lead_charge" IS NULL)
            OR
            ("type" = 'LEAD_CHARGE'
                AND "commission_percentage" IS NULL
                AND "lead_charge" >= 0)
        ),
    ADD CONSTRAINT "commission_settings_effective_period_check"
        CHECK ("effective_until" IS NULL OR "effective_from" < "effective_until");

ALTER TABLE "lead_transactions"
    ADD CONSTRAINT "lead_transactions_amount_nonnegative_check"
        CHECK ("amount" >= 0);

ALTER TABLE "advertisement_campaigns"
    ADD CONSTRAINT "advertisement_campaigns_budget_nonnegative_check"
        CHECK ("budget" IS NULL OR "budget" >= 0),
    ADD CONSTRAINT "advertisement_campaigns_period_check"
        CHECK ("starts_at" IS NULL OR "ends_at" IS NULL OR "starts_at" < "ends_at");

ALTER TABLE "advertisements"
    ADD CONSTRAINT "advertisements_period_check"
        CHECK ("starts_at" < "ends_at");

ALTER TABLE "payments"
    ADD CONSTRAINT "payments_amount_positive_check"
        CHECK ("amount" > 0);

ALTER TABLE "refunds"
    ADD CONSTRAINT "refunds_amount_positive_check"
        CHECK ("amount" > 0);

ALTER TABLE "financial_transactions"
    ADD CONSTRAINT "financial_transactions_amount_nonnegative_check"
        CHECK ("amount" >= 0),
    ADD CONSTRAINT "financial_transactions_single_source_check"
        CHECK (num_nonnulls("payment_id", "refund_id") = 1);

ALTER TABLE "media_files"
    ADD CONSTRAINT "media_files_size_nonnegative_check"
        CHECK ("file_size_bytes" >= 0);

CREATE UNIQUE INDEX "uq_customer_addresses_one_default"
    ON "customer_addresses" ("customer_id")
    WHERE "is_default" = true;

CREATE UNIQUE INDEX "uq_service_request_categories_one_primary"
    ON "service_request_categories" ("service_request_id")
    WHERE "is_primary" = true;

CREATE UNIQUE INDEX "uq_quotations_one_active_per_provider_request"
    ON "quotations" ("service_request_id", "provider_profile_id")
    WHERE "status" IN ('DRAFT', 'SUBMITTED', 'VIEWED', 'ACCEPTED');

CREATE UNIQUE INDEX "uq_quotations_one_accepted_per_request"
    ON "quotations" ("service_request_id")
    WHERE "status" = 'ACCEPTED';

CREATE FUNCTION "validate_location_parent_type"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    parent_type "location_type";
BEGIN
    IF NEW."type" = 'PROVINCE' THEN
        IF NEW."parent_id" IS NOT NULL THEN
            RAISE EXCEPTION 'A province cannot have a parent location' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
    END IF;

    IF NEW."parent_id" IS NULL THEN
        RAISE EXCEPTION 'A non-province location must have a parent' USING ERRCODE = '23514';
    END IF;

    SELECT "type" INTO parent_type
    FROM "locations"
    WHERE "id" = NEW."parent_id";

    IF NOT FOUND OR
        (NEW."type" = 'DISTRICT' AND parent_type <> 'PROVINCE') OR
        (NEW."type" = 'CITY' AND parent_type <> 'DISTRICT') OR
        (NEW."type" = 'TOWN' AND parent_type <> 'CITY') THEN
        RAISE EXCEPTION 'Location parent type does not match the geographic hierarchy'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "locations_parent_type_trigger"
    BEFORE INSERT OR UPDATE OF "parent_id", "type" ON "locations"
    FOR EACH ROW EXECUTE FUNCTION "validate_location_parent_type"();

CREATE FUNCTION "validate_booking_quotation"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    quote_request_id UUID;
    quote_customer_id UUID;
    quote_provider_id UUID;
    quote_status "quotation_status";
BEGIN
    SELECT "service_request_id", "customer_id", "provider_profile_id", "status"
    INTO quote_request_id, quote_customer_id, quote_provider_id, quote_status
    FROM "quotations"
    WHERE "id" = NEW."quotation_id"
    FOR UPDATE;

    IF NOT FOUND OR quote_status <> 'ACCEPTED' THEN
        RAISE EXCEPTION 'A booking requires an accepted quotation'
            USING ERRCODE = '23514';
    END IF;
    IF quote_request_id <> NEW."service_request_id"
        OR quote_customer_id <> NEW."customer_id"
        OR quote_provider_id <> NEW."provider_profile_id" THEN
        RAISE EXCEPTION 'Booking request, customer, and provider must match its quotation'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "bookings_accepted_quotation_trigger"
    BEFORE INSERT OR UPDATE OF "service_request_id", "quotation_id", "customer_id", "provider_profile_id"
    ON "bookings"
    FOR EACH ROW EXECUTE FUNCTION "validate_booking_quotation"();

CREATE FUNCTION "prevent_withdrawing_booked_quotation"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD."status" = 'ACCEPTED' AND NEW."status" <> 'ACCEPTED'
        AND EXISTS (SELECT 1 FROM "bookings" WHERE "quotation_id" = OLD."id") THEN
        RAISE EXCEPTION 'A quotation linked to a booking cannot be unaccepted'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "quotations_keep_booked_acceptance_trigger"
    BEFORE UPDATE OF "status" ON "quotations"
    FOR EACH ROW EXECUTE FUNCTION "prevent_withdrawing_booked_quotation"();

CREATE FUNCTION "validate_review_booking"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    booking_customer_id UUID;
    booking_provider_id UUID;
    booking_status_value "booking_status";
BEGIN
    SELECT "customer_id", "provider_profile_id", "status"
    INTO booking_customer_id, booking_provider_id, booking_status_value
    FROM "bookings"
    WHERE "id" = NEW."booking_id";

    IF NOT FOUND OR booking_status_value <> 'COMPLETED' THEN
        RAISE EXCEPTION 'Only completed bookings can be reviewed'
            USING ERRCODE = '23514';
    END IF;
    IF booking_customer_id <> NEW."customer_id"
        OR booking_provider_id <> NEW."provider_profile_id" THEN
        RAISE EXCEPTION 'Review customer and provider must match the booking'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "reviews_completed_booking_trigger"
    BEFORE INSERT OR UPDATE OF "booking_id", "customer_id", "provider_profile_id"
    ON "reviews"
    FOR EACH ROW EXECUTE FUNCTION "validate_review_booking"();

CREATE FUNCTION "prevent_uncompleting_reviewed_booking"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD."status" = 'COMPLETED' AND NEW."status" <> 'COMPLETED'
        AND EXISTS (SELECT 1 FROM "reviews" WHERE "booking_id" = OLD."id") THEN
        RAISE EXCEPTION 'A reviewed booking must remain completed'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "bookings_keep_review_eligibility_trigger"
    BEFORE UPDATE OF "status" ON "bookings"
    FOR EACH ROW EXECUTE FUNCTION "prevent_uncompleting_reviewed_booking"();

CREATE FUNCTION "validate_quotation_customer"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    request_customer_id UUID;
BEGIN
    SELECT "customer_id" INTO request_customer_id
    FROM "service_requests"
    WHERE "id" = NEW."service_request_id";

    IF NOT FOUND OR request_customer_id <> NEW."customer_id" THEN
        RAISE EXCEPTION 'Quotation customer must own the referenced service request'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "quotations_request_customer_trigger"
    BEFORE INSERT OR UPDATE OF "service_request_id", "customer_id" ON "quotations"
    FOR EACH ROW EXECUTE FUNCTION "validate_quotation_customer"();

CREATE FUNCTION "validate_review_response_provider"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    review_provider_id UUID;
BEGIN
    SELECT "provider_profile_id" INTO review_provider_id
    FROM "reviews"
    WHERE "id" = NEW."review_id";

    IF NOT FOUND OR review_provider_id <> NEW."provider_profile_id" THEN
        RAISE EXCEPTION 'Review response provider must match the review provider'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "review_responses_provider_trigger"
    BEFORE INSERT OR UPDATE OF "review_id", "provider_profile_id" ON "review_responses"
    FOR EACH ROW EXECUTE FUNCTION "validate_review_response_provider"();

CREATE FUNCTION "validate_payment_booking"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    booking_customer_id UUID;
    booking_provider_id UUID;
BEGIN
    SELECT "customer_id", "provider_profile_id"
    INTO booking_customer_id, booking_provider_id
    FROM "bookings"
    WHERE "id" = NEW."booking_id";

    IF NOT FOUND OR booking_customer_id <> NEW."customer_id"
        OR (NEW."provider_profile_id" IS NOT NULL AND booking_provider_id <> NEW."provider_profile_id") THEN
        RAISE EXCEPTION 'Payment customer and provider must match the referenced booking'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "payments_booking_participants_trigger"
    BEFORE INSERT OR UPDATE OF "booking_id", "customer_id", "provider_profile_id" ON "payments"
    FOR EACH ROW EXECUTE FUNCTION "validate_payment_booking"();

