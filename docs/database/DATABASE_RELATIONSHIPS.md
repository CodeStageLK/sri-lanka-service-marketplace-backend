# Database Relationships and Workflow Invariants

## Identity, customer, and provider profiles

`users` is the identity root. A user may have a one-to-one `customer_profiles`
record, a one-to-one `provider_profiles` record, or both. This allows one
identity to hold multiple RBAC roles and participate as a customer and a
provider where appropriate. Provider-only business fields are kept in the
one-to-one `provider_business_details` extension.

Roles and permissions are many-to-many through `user_roles` and
`role_permissions`. Session and refresh-token records contain token hashes,
never plaintext credentials. Authentication endpoints and password handling
are outside Phase 3.

## Provider services and coverage

Providers can select many categories using `provider_categories` and cover
many locations using `provider_service_areas`. Category and location records
are independently managed. A provider may maintain a weekly schedule and
dated availability exceptions. Provider verification submissions and their
documents have explicit reviewer and Neon Object Storage metadata references.

## Customer requests, recipients, and quotations

A customer profile owns service requests. `service_request_categories` records
the request's categories and primary category. Requests can reference a
customer address and/or a location; attachments point to `media_files`.
`service_request_recipients` sends a request to multiple providers and records
delivery and response states. Its `(service_request_id, provider_profile_id)`
unique key prevents duplicate deliveries to one provider.

Each quotation belongs to one request, provider, and customer and can have
multiple item rows. The database permits at most one active quote per
provider/request, one accepted quote per request, and one booking per request.
Rejected, withdrawn, and expired quotations may be replaced with a later
submission.

## Quote acceptance and booking transaction

The backend acceptance operation must execute in one short database
transaction:

1. Lock the target service-request row (`SELECT ... FOR UPDATE`) to serialize
   competing acceptances for that request.
2. Verify the customer owns the request, the quote belongs to it, the quote is
   submitted/viewed and still valid, and no booking already exists.
3. Mark the selected quotation accepted and transition the request.
4. Create the booking with the accepted quotation, matching request, customer,
   provider, and immutable agreed-price snapshot.
5. Write booking status history and audit events before commit.

The partial unique index on accepted quotations and unique booking keys are
the final race-condition guards. Violations must roll back the transaction and
be translated into a conflict response; application-side pre-checks alone are
not sufficient.

## Reviews, favourites, and reputation

A booking can have one review, and a review can have one provider response.
The migration validates on write that the booking is completed and its
customer/provider match the review. Review moderation is represented by
`ReviewStatus`. Customer/provider favourite pairs are unique. Provider rating
aggregates are cached on the provider profile and must be maintained through
the same review service transaction or a database-owned aggregation mechanism.

## Subscriptions, leads, advertisements, and financial records

Plans are administrator-managed configuration. Provider subscriptions retain
their plan and billing period; transaction history is separate and immutable
in intent. Commission/lead charge settings can be global or category-specific;
each lead transaction records the applied amount and currency rather than
relying on a subsequently mutable rule.

Campaigns define timing, budget, and placement. Individual advertisements
associate a provider with a campaign. Payments, refunds, and financial
transactions are separate ledger records. External payment integrations must
use provider references and idempotency keys; card data is never stored.

## Media, complaints, disputes, and audit

`media_files` stores Neon Object Storage object keys and metadata, not content
bytes or temporary signed URLs. Explicit relation tables attach files to
provider documents, portfolio entries, requests, complaints, and disputes.
Complaints/disputes have reporter, optional assignee, status, evidence, and
resolution fields. Audit logs retain actor, action, entity reference,
metadata, and request correlation ID; audit records should be append-only by
database role policy.

