---
name: marketplace-database-design
description: "PostgreSQL schema conventions for the Sri Lanka Service Marketplace: table design for users/roles, providers, verification, hierarchical categories and locations, enquiries, quotations, bookings, payments, subscriptions, commissions, reviews, disputes, and audit logs, plus status enums, money as NUMERIC LKR, timestamptz, soft-delete and audit columns. Use when creating or reviewing migrations, designing tables, adding status enums/state machines, or modeling money, time, and location data."
license: MIT
metadata:
  category: "project"
  scope: "project"
  project: "sri-lanka-service-marketplace"
  version: "1.0.0"
---

# Marketplace Database Design

## Purpose

Give every migration and entity a consistent PostgreSQL foundation: naming, keys, audit columns, soft-delete, money, time, enums, and the core domain tables, so schemas across the modular monolith stay coherent and the enquiry→quotation→booking→payment lifecycle is enforceable at the data layer.

## When to Use

- Writing migrations or ORM entities for any backend module.
- Adding a status column or state machine to a domain table.
- Modeling money, timestamps, locations, or hierarchical data.
- Reviewing schema PRs for convention compliance.

## Global Conventions

- Tables: `snake_case`, plural (`provider_profiles`, `quotations`). PKs: `id UUID DEFAULT gen_random_uuid()`.
- FKs: `<entity>_id`, indexed, `ON DELETE RESTRICT` by default (domain data is never cascade-deleted silently).
- Audit columns on every business table: `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL`, plus `created_by uuid` / `updated_by uuid` where an actor exists.
- Soft delete: `deleted_at timestamptz NULL` on user-facing content (services, reviews, advertisements, provider profiles). Core transactional records (enquiries, quotations, bookings, payments, commissions, audit logs) are never deleted — they transition to terminal states instead.
- Status enums: PostgreSQL `enum` types named `<table>_status` (e.g., `booking_status`). Add values with `ALTER TYPE ... ADD VALUE`; never reuse or rename values.
- **Money**: `NUMERIC(12,2)` in LKR. Never float. Store `currency CHAR(3) NOT NULL DEFAULT 'LKR'` for forward compatibility; all launch values are LKR.
- **Time**: always `timestamptz`, stored UTC; conversion to Asia/Colombo happens at the API/display layer only.
- Phone numbers: store E.164 (`+94XXXXXXXXX`) in `varchar(16)`; validate at the API layer.
- Localization readiness: user-facing reference text (category names) should allow `name_si`, `name_ta` columns or a translations table — ASSUMPTION: start with `name_en` + nullable `name_si`/`name_ta`.

## Users, Roles, Providers, Verification

- `users`: identity (email unique, phone unique, password hash, status). One row per person.
- `user_roles`: `(user_id, role)` with `role` in (`CUSTOMER`, `PROVIDER`, `ADMIN`); one account holds multiple rows. Admin sub-roles in `admin_role` column or separate `admin_grants` table (ASSUMPTION: separate table for sub-role + granted_by audit).
- `provider_profiles`: 1:1 nullable extension of `users` for the PROVIDER role: display/business name, type (`INDIVIDUAL`/`BUSINESS` — ASSUMPTION), description, `verification_status`, rating aggregates (denormalized `avg_rating`, `review_count`).
- `provider_coverage_areas`: `(provider_profile_id, location_id)` many-to-many — where the provider serves.
- `verification_submissions`: provider_profile_id, status, submitted_at, decided_at, decided_by, rejection_reason; child `verification_documents` rows hold S3 keys + document type (see `provider-verification`). Never store document bytes in Postgres.

## Categories and Locations (Hierarchies)

- `categories`: adjacency list — `id, parent_id NULL, slug UNIQUE, name_en/si/ta, sort_order, is_active`. ASSUMPTION: depth ≤ 3; enforce in service layer. Add a `path` materialized column or `ltree` if subtree queries become hot.
- `locations`: single table for the Sri Lanka administrative hierarchy — `id, parent_id, level` enum (`PROVINCE`, `DISTRICT`, `DS_DIVISION`), `name_en/si/ta`, `slug`. Seed with the official 9 provinces and 25 districts; DS divisions seeded from reference data (REQUIRES VERIFICATION: authoritative DS division source and update cadence).
- Addresses: `address_line1/line2, city, location_id (DS division), postal_code` — local Sri Lankan address format; no state/zip US-isms.

## Core Transactional Tables

- `services`: provider_profile_id, category_id, title, description, pricing approach fields (ASSUMPTION: `pricing_type` enum `FIXED`/`HOURLY`/`QUOTE_BASED` + optional `price_from NUMERIC(12,2)`), deleted_at.
- `enquiries`: customer (user_id), category_id, location_id, title/description, preferred timing (`preferred_date`, flexible flag — ASSUMPTION), `status enquiry_status`, `expires_at` (ASSUMPTION: enquiries expire).
- `quotations`: enquiry_id, provider_profile_id, `amount NUMERIC(12,2)`, scope/notes, `valid_until`, `status quotation_status`. Constraints: UNIQUE `(enquiry_id, provider_profile_id)` for active quotes (partial unique index WHERE status NOT IN ('WITHDRAWN','REJECTED','EXPIRED') — ASSUMPTION); at most one ACCEPTED per enquiry (partial unique index `(enquiry_id) WHERE status='ACCEPTED'`).
- `bookings`: `quotation_id UNIQUE NOT NULL` (one booking per accepted quotation), customer_id, provider_profile_id, agreed amount snapshot, scheduled window, `status booking_status`.
- `payments`: booking_id, amount, `status payment_status`, gateway reference, `idempotency_key UNIQUE`, attempt history in `payment_attempts`.
- `commissions`: payment_id, rate snapshot, `commission_amount`, `provider_net_amount` — snapshot values at computation time; never recompute from mutable config.
- `subscriptions`: `subscription_plans` (admin-managed) + `provider_subscriptions` (provider_profile_id, plan_id, period, status). ASSUMPTION: one ACTIVE per provider (partial unique index).
- `reviews`: `booking_id UNIQUE`, rating smallint 1–5, text, deleted_at (admin moderation). ASSUMPTION: one review per booking, post-completion only (enforced in service layer).
- `disputes`: booking_id, raised_by, reason, `status dispute_status`, resolution notes, resolved_by.
- `audit_logs`: append-only — actor_id, actor_role, action, entity_type, entity_id, before/after JSONB, ip, created_at. No updates or deletes; consider monthly partitioning.

## Status Enums and State Machines

Authoritative transitions live in `enquiry-quotation-booking-workflows`; the database stores these values (all inferred — ASSUMPTION unless stated):

- `enquiry_status`: `DRAFT, OPEN, QUOTED, ACCEPTED, CLOSED, EXPIRED, CANCELLED`
- `quotation_status`: `SUBMITTED, WITHDRAWN, ACCEPTED, REJECTED, EXPIRED`
- `booking_status`: `CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED, DISPUTED`
- `payment_status`: `PENDING, PROCESSING, SUCCEEDED, FAILED, REFUNDED, PARTIALLY_REFUNDED`
- `dispute_status`: `OPEN, UNDER_REVIEW, RESOLVED, REJECTED, ESCALATED`
- `verification_status` (on provider_profiles): `UNVERIFIED, PENDING, VERIFIED, REJECTED, SUSPENDED`

State changes must be transition-guarded in the service layer; add `status`-change rows to audit_logs for enquiries, quotations, bookings, payments, disputes, and verification.

## Reference DDL Pattern

Example shape every core table should follow (quotations shown):

```sql
CREATE TABLE quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id uuid NOT NULL REFERENCES enquiries(id) ON DELETE RESTRICT,
  provider_profile_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'LKR',
  scope_notes text,
  valid_until timestamptz NOT NULL,
  status quotation_status NOT NULL DEFAULT 'SUBMITTED',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_quotations_active_per_provider
  ON quotations (enquiry_id, provider_profile_id)
  WHERE status = 'SUBMITTED';
CREATE UNIQUE INDEX uq_quotations_one_accepted
  ON quotations (enquiry_id)
  WHERE status = 'ACCEPTED';
CREATE INDEX ix_quotations_enquiry_status ON quotations (enquiry_id, status);
```

## Migration Conventions

- One migration per logical change; migrations are forward-only in shared environments (write a new migration to undo, don't edit applied ones).
- Enum additions, new nullable columns, and new indexes (CONCURRENTLY in production) are safe; destructive changes require a two-step deprecate-then-remove across releases.
- Seed data for `locations` (provinces, districts, DS divisions) and initial `categories` ships as idempotent seeders keyed by slug.

## Indexing and Query Patterns

- Search-critical composites: `enquiries(category_id, location_id, status)`, `quotations(enquiry_id, status)`, `services(category_id) WHERE deleted_at IS NULL`, `provider_coverage_areas(location_id)`.
- Provider enquiry inbox: match on category + coverage area → index both sides of the join.
- Listing endpoints paginate via keyset or offset per `marketplace-api-design`; ensure sort columns are indexed (`created_at`, `avg_rating`).
- Full-text search on services/providers: Postgres `tsvector` at launch (ASSUMPTION: no external search engine initially).

## Assumptions and Open Questions

- ASSUMPTION: All status enum value sets above are inferred from the core workflow; confirm with product before freezing.
- ASSUMPTION: UUID PKs everywhere; no exposed sequential IDs.
- ASSUMPTION: Soft delete only on content tables; transactional tables use terminal states.
- ASSUMPTION: Commission rate configuration is stored per category and/or plan; snapshot applied values onto `commissions`.
- REQUIRES VERIFICATION: Authoritative dataset for DS divisions and its licensing.
- REQUIRES VERIFICATION: Legally required retention periods for payments, audit logs, and verification documents in Sri Lanka.
- REQUIRES VERIFICATION: Whether invoices/receipts have mandated formats (affects payments schema).

## Checklist

- [ ] Table/column names follow snake_case plural + `<entity>_id` FK convention; FKs indexed.
- [ ] `created_at`/`updated_at` timestamptz present; actor columns where applicable.
- [ ] Money is NUMERIC(12,2) + currency 'LKR'; no floats anywhere.
- [ ] Status columns use named enum types; transitions enforced in service layer; changes audit-logged.
- [ ] Soft delete only on content tables; transactional records use terminal states.
- [ ] Hierarchies (categories, locations) use parent_id + level/slug conventions; seeds included in migration or seeder.
- [ ] Partial unique indexes enforce: one ACCEPTED quotation per enquiry, one active quotation per provider per enquiry, one booking per quotation, one review per booking.
- [ ] Inferred states/rules in this change are marked ASSUMPTION in the PR description.
