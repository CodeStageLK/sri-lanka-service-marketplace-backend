# Database Indexes and Constraints

Prisma declares ordinary indexes, unique keys, and foreign keys in
`prisma/schema.prisma`. The initial migration adds PostgreSQL checks,
conditional indexes, and cross-row workflow triggers that Prisma cannot
express in its schema DSL. Keep these migration-only objects in sync with
this document.

## Query-oriented indexes

- Identity and RBAC: normalized email, phone, role/permission join keys,
  user status/creation, and active token expiry lookups.
- Provider discovery: `(verification_status, is_active, created_at)`,
  descending `(average_rating, id)`, and category/location reverse joins.
- Catalog/location browsing: parent + sort order, active + sort order, and
  location type + active + name.
- Customer requests: customer + descending creation time, location + status
  + descending creation time, and status/urgency/preferred date.
- Provider inbox: provider + response status + descending creation time;
  request + delivery status.
- Quotes/bookings: request + status, provider + status + descending time,
  customer/provider booking status and scheduled time.
- Reviews: provider + moderation status + descending creation time.
- Finance and subscriptions: parent foreign keys with status and event time,
  plus provider + status + expiry.
- Notifications/admin queues: user + read time + descending creation time;
  complaint/dispute status and assignment.
- Audit: actor, entity type/entity ID, and request correlation ID with
  descending event timestamps.

All foreign-key columns are indexed, either directly or as the leading column
of a primary/unique/composite index.

## Conditional uniqueness and cross-row integrity

- `uq_quotations_one_active_per_provider_request`: one quotation in
  `DRAFT`, `SUBMITTED`, `VIEWED`, or `ACCEPTED` per request/provider pair.
- `uq_quotations_one_accepted_per_request`: at most one `ACCEPTED` quotation
  per service request.
- `uq_service_request_categories_one_primary`: at most one primary category
  per request.
- `uq_customer_addresses_one_default`: at most one default address per
  customer.
- Unique request and quotation IDs on `bookings`: no competing booking for
  one request and no reuse of a quote.
- Booking trigger: the quote must be accepted and request/customer/provider
  must match.
- Review trigger: referenced booking must be completed and customer/provider
  must match.
- Location trigger: provinces have no parent; districts, cities, and towns
  must reference the preceding geographic level.
- Quotation trigger: the quote customer must own its service request.
- Review-response trigger: the responder must be the reviewed provider.
- Payment trigger: customer and, when supplied, provider must match the booking.
- State guards prevent unaccepting a quotation after its booking exists and
  prevent uncompleting a reviewed booking.

The backend must still perform quotation acceptance and booking creation in a
single transaction that locks the service-request row. These constraints
protect integrity under concurrent writes but do not replace state transition
authorization.

## Check constraints

Checks guard valid geographic coordinates, ratings and aggregate ranges,
non-negative prices/charges/budgets, valid price ranges, positive quotation
item quantities, weekly day/time ranges, availability window ordering,
subscription/campaign date ordering, valid commission-rule value shapes, and
media file sizes. Review the migration SQL for the exact expressions.

