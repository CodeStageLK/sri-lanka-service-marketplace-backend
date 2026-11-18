---
name: customer-marketplace-workflows
description: "End-to-end customer journeys for the Sri Lanka Service Marketplace: registration/onboarding, service discovery, creating enquiries, receiving and comparing quotations, accepting a quotation into a booking, payment, post-completion reviews, and raising disputes — with state transitions, validation rules, and notification touchpoints per journey. Use when building or reviewing any customer-facing flow, screen, endpoint, or notification across the public site, customer dashboard, or mobile app."
license: MIT
metadata:
  category: "project"
  scope: "project"
  project: "sri-lanka-service-marketplace"
  version: "1.0.0"
---

# Customer Marketplace Workflows

## Purpose

Define the customer-side journeys on the enquiry→quotation→booking→payment→review backbone so that the public website (surface 1), customer dashboard (surface 2), and Flutter app (surface 4, customer mode) implement identical business behavior against the shared backend. State machine authority lives in `enquiry-quotation-booking-workflows`; this skill covers the customer's perspective, validations, and UX rules.

## When to Use

- Building customer registration, discovery, enquiry, comparison, booking, payment, review, or dispute screens/endpoints.
- Defining validation rules or error states on customer inputs.
- Wiring notification touchpoints for customer-facing events.
- Reviewing UX flows for parity between web and mobile.

## Registration and Onboarding

- Register with email and/or +94 phone number + password; validates Sri Lankan phone format (E.164 `+94XXXXXXXXX`). ASSUMPTION: contact verification via OTP/email link required before posting an enquiry; browsing requires no account.
- Default role grant: CUSTOMER. Onboarding captures display name and preferred location (district/DS division) to personalize discovery — ASSUMPTION: location optional at signup.
- A customer may later "become a provider" on the same account (see `provider-management-workflows`); never a separate account.
- Notifications: welcome message; verification OTP/link.

## Discovery

- **Browse categories**: hierarchical category tree (surface 1 is SEO-critical: category and category+location landing pages must be crawlable).
- **Location-based search**: filter providers/services by province → district → DS division; a broader selection matches all descendant areas.
- **Provider profiles**: public pages with business name, description, verified badge (per `provider-verification` display rules), services, coverage areas, portfolio, aggregate rating and reviews.
- Search/filtering/sorting executes in the backend (shared by all surfaces); frontends only render. Sort options: rating, review count, recency — ASSUMPTION.
- Anonymous users can browse everything public; posting an enquiry requires login.

## Creating an Enquiry

Inputs: service category (required, leaf or near-leaf — ASSUMPTION), location (required, from the Sri Lanka hierarchy), title/description (required, min length validated), preferred timing (date/window or "flexible" — ASSUMPTION), optional photos (camera upload on mobile; S3 via presigned URLs).

- Validation: category must be active; location must exist in hierarchy; description length bounds; max photo count/size (ASSUMPTION: limits are config, not hardcoded).
- On submit: enquiry → `OPEN`; matched providers are notified (matching per `provider-management-workflows`).
- Customer can edit while no quotations exist, and cancel while un-accepted — ASSUMPTION; see state machine skill.
- ASSUMPTION: enquiries expire after a configurable window (e.g., 14 days) if not accepted; customer is notified before expiry.
- Notifications: enquiry posted confirmation; "new quotation received" per quotation; expiry warning.

## Receiving and Comparing Quotations

- Customer sees all quotations on their enquiry: amount (LKR), scope/notes, validity date, provider card (name, verified badge, rating, review count, coverage).
- Comparison view is explicitly a product feature: side-by-side price + provider credibility; sortable by amount and rating — ASSUMPTION on exact comparison fields beyond price.
- ASSUMPTION: customer contact details are hidden from providers until acceptance; pre-acceptance clarifications, if any, flow through platform messaging — DECISION PENDING (messaging feature not confirmed; do not build ad-hoc contact sharing).
- Customer may reject quotations individually (optional, with optional reason — ASSUMPTION) or simply accept one.

## Accepting a Quotation → Booking

- Accepting one quotation: creates the Booking (`CONFIRMED`), marks the enquiry accepted/closed to new quotes, and auto-rejects sibling quotations (concurrency rules in `enquiry-quotation-booking-workflows`).
- Acceptance is idempotent (Idempotency-Key per `marketplace-api-design`) and guarded against the quotation having expired/withdrawn meanwhile → 409/422 with stable error code; UI must handle "no longer available".
- Booking shows agreed amount snapshot, provider contact (now revealed — ASSUMPTION), scheduled timing.
- Notifications: acceptance confirmation to customer; "you won / you lost" to providers; booking details to both parties.

## Payment

- Payment is tied to the booking in LKR; platform commission is deducted per `marketplace-payments-commissions` conventions. ASSUMPTION: payment timing (upfront vs on completion) and methods (card/online vs cash recorded on platform) are undecided — model Payment states to support both; REQUIRES VERIFICATION: available LKR payment gateways and settlement rules.
- Customer sees payment status (`PENDING → PROCESSING → SUCCEEDED/FAILED`), receipts, and history in the dashboard/app.
- Failures are retryable with the same idempotency semantics; never double-charge.
- Notifications: payment success/failure; receipt delivery.

## Review After Completion

- UX rule: **reviews only after completed bookings** (ASSUMPTION) — review entry point appears only on bookings in `COMPLETED`; one review per booking (rating 1–5 + text).
- ASSUMPTION: editing window for reviews (e.g., 7 days) and admin moderation for abusive content; flag specifics with product.
- Provider aggregate rating updates on publish (denormalized, event-driven).
- Notifications: "rate your experience" prompt post-completion; provider notified of new review.

## Raising a Dispute

- Customer can raise a dispute on a booking (ASSUMPTION: from `IN_PROGRESS`, `COMPLETED`, or payment-related states; exact window configurable). Inputs: reason category + description + optional evidence photos.
- Booking moves to `DISPUTED`; admin dispute workflow takes over (web-only admin). Payment effects (hold/refund) depend on resolution — ASSUMPTION; REQUIRES VERIFICATION: refund/chargeback obligations under Sri Lankan consumer law and gateway rules.
- Notifications: dispute opened (both parties + admin queue); status updates; resolution outcome.

## Journey-to-State Mapping Summary

| Journey step | Entity + state effect | Customer-facing endpoint (per `marketplace-api-design`) |
|---|---|---|
| Post enquiry | Enquiry → OPEN | `POST /enquiries` (+ `/publish` if drafted) |
| Receive quotation | Quotation SUBMITTED on own enquiry | `GET /enquiries/{id}/quotations` |
| Reject a quotation | Quotation → REJECTED | `POST /quotations/{id}/reject` |
| Accept a quotation | Quotation → ACCEPTED; Booking → CONFIRMED; siblings → REJECTED | `POST /quotations/{id}/accept` (Idempotency-Key) |
| Cancel enquiry | Enquiry → CANCELLED | `POST /enquiries/{id}/cancel` |
| Confirm completion | Booking → COMPLETED | `POST /bookings/{id}/complete` (ASSUMPTION: customer confirm step) |
| Pay | Payment PENDING → SUCCEEDED | `POST /bookings/{id}/payments` (Idempotency-Key) |
| Review | Review created on COMPLETED booking | `POST /bookings/{id}/review` |
| Dispute | Booking → DISPUTED | `POST /bookings/{id}/disputes` |

All transitions must agree with `enquiry-quotation-booking-workflows`; customer UI state should derive from backend status fields, never local optimistic flags that outlive a refresh.

## Cross-Surface Parity Rules

- Surface 1 (public) handles anonymous discovery and routes into login at the enquiry gate; deep links from mobile notifications land on the matching dashboard/app screen (GoRouter deep links on Flutter).
- Form validation is defined once in backend DTOs; web mirrors via Zod schemas generated/kept in sync with OpenAPI; Flutter mirrors via Freezed models + validators.
- Empty/error/loading states required for every list (quotations, bookings, notifications) on both surfaces.

## Assumptions and Open Questions

- ASSUMPTION: Contact verification required before first enquiry; browsing is anonymous.
- ASSUMPTION: Contact details exchange only after acceptance; no pre-acceptance direct contact.
- ASSUMPTION: Enquiry expiry window, review edit window, photo limits are admin-configurable.
- ASSUMPTION: Reviews gated to completed bookings, one per booking.
- DECISION PENDING: in-platform messaging between customer and provider.
- REQUIRES VERIFICATION: payment methods/gateways for LKR; refund and consumer-protection obligations in Sri Lanka.

## Checklist

- [ ] Flow exists identically on web (surface 2) and mobile customer mode (surface 4); public discovery is SEO-ready on surface 1.
- [ ] All validations enforced in the backend; frontends mirror them for UX only (Zod on web, equivalent on Flutter).
- [ ] Every state transition the customer triggers maps to a verb endpoint and matches `enquiry-quotation-booking-workflows`.
- [ ] Notification touchpoints wired for: enquiry posted, quotation received, acceptance, booking, payment result, review prompt, dispute updates.
- [ ] Acceptance and payment calls are idempotent; stale-quotation races produce handled, user-friendly errors.
- [ ] Review entry point only on COMPLETED bookings; one review per booking enforced.
- [ ] LKR amounts, +94 phones, Asia/Colombo display times, Sinhala/Tamil-ready strings throughout.
