# Database Design

## Platform and conventions

- PostgreSQL on Neon, accessed through Prisma Client; the application URL is
  pooled and Prisma Migrate uses `DATABASE_URL_UNPOOLED`.
- Prisma models map to plural `snake_case` tables and `snake_case` columns.
- Primary keys are PostgreSQL UUIDs generated with `gen_random_uuid()`.
- All operational timestamps use `timestamptz`; APIs should present them in
  `Asia/Colombo` where local time is intended.
- Monetary values use `NUMERIC(12,2)` with an explicit `CHAR(3)` currency
  (default `LKR`). No floating-point money is used.
- Foreign keys have explicit deletion behavior. Cascade is limited to
  dependent profile/join rows; business and financial history is restricted
  from accidental deletion.
- Mutable records have `created_at` and `updated_at`. User-facing catalog and
  provider content supports `deleted_at`; transaction and audit history uses
  state changes rather than soft deletion.

## Domains

| Domain | Models |
| --- | --- |
| Identity and RBAC | `User`, `Role`, `Permission`, `UserRole`, `RolePermission`, `RefreshToken`, `UserSession` |
| Customer | `CustomerProfile`, `CustomerAddress` |
| Provider | `ProviderProfile`, `ProviderBusinessDetails`, `ProviderVerification`, `ProviderDocument`, `ProviderPortfolio`, `ProviderPortfolioMedia`, `ProviderCategory`, `ProviderServiceArea`, `ProviderAvailability`, `ProviderAvailabilityException` |
| Catalog and geography | `Category`, `Service`, `Location` |
| Requests and conversion | `ServiceRequest`, `ServiceRequestCategory`, `ServiceRequestAttachment`, `ServiceRequestRecipient`, `Enquiry`, `Quotation`, `QuotationItem`, `Booking`, `BookingStatusHistory` |
| Engagement | `Review`, `ReviewResponse`, `Favourite` |
| Revenue and promotion | `SubscriptionPlan`, `Subscription`, `SubscriptionTransaction`, `CommissionSetting`, `LeadTransaction`, `AdvertisementCampaign`, `Advertisement` |
| Finance | `Payment`, `Refund`, `FinancialTransaction` |
| Platform operations | `Notification`, `NotificationTemplate`, `Complaint`, `ComplaintEvidence`, `Dispute`, `DisputeEvidence`, `AuditLog`, `SystemSetting`, `MediaFile` |

## Normalization and intentional snapshots

Role grants, provider categories/coverage, request categories, portfolio media,
and evidence files use explicit join tables. Provider business details and
customer/provider profiles are one-to-one extensions of a user. Categories
and locations use parent references.

`Booking.agreedPrice` and its currency snapshot the agreed amount at booking
time. A later quote, plan, or commission-setting change must not rewrite a
completed transaction. `ProviderProfile.averageRating` and `totalReviews` are
read-optimized aggregates; a single backend-owned review workflow must update
them consistently. These are the only intentional computed-value caches in
this initial design.

## Important constraints and limitations

- Normalized email is stored separately so email lookup is case-insensitive;
  the database migration also requires the stored normalized value to match
  the lower-cased email when email is present.
- A request can have multiple categories but at most one primary category.
- Only one active quotation per provider/request and one accepted quotation
  per request are allowed by partial unique indexes.
- A request can have only one booking, and a quotation can produce only one
  booking. Database triggers additionally require the booking to match an
  accepted quote and its request/customer/provider.
- Reviews are unique by booking, limited to ratings 1–5, and the migration
  rejects review creation unless the referenced booking is completed and the
  customer/provider match.
- Enforcing state transitions, permissions, and atomic acceptance still
  requires backend services. The migration does not implement authentication,
  payment processing, or escrow.
- Geography uses decimal latitude/longitude and parent-child foreign keys.
  PostGIS is intentionally not required or enabled; add spatial types/indexes
  only after checking Neon extension availability and a measured need.
- Category/role/permission/plan settings intended for administrators remain
  rows, not enums. Enums are reserved for bounded workflow states and types.

