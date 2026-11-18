---
name: marketplace-notifications
description: "Defines the notification matrix, channels (in-app, FCM push, email), templates, localization readiness, user preferences, delivery reliability (outbox pattern), aggregation, and push deep links for the Sri Lanka Service Marketplace. Use when implementing the Notifications module, adding notifications for lifecycle events (enquiry, quotation, booking, payment, verification, dispute, subscription), wiring FCM or email providers, or building notification preference UI."
license: MIT
metadata:
  category: "project"
  scope: "project"
  project: "sri-lanka-service-marketplace"
  version: "1.0.0"
---

# Marketplace Notifications

## Purpose
Give every lifecycle event on the platform a consistent, reliable, non-spammy notification behavior across in-app, push (FCM), and email channels, with Sinhala/Tamil/English readiness and deep links into the Flutter app. Centralized in the NestJS `Notifications` module; other modules emit domain events, never send notifications directly.

## When to Use
- Adding or changing any notification for enquiries, quotations, bookings, payments, verification, disputes, or subscriptions.
- Integrating FCM, an email provider, or (later) an SMS gateway.
- Building the in-app notification center or preference settings on web/mobile.
- Reviewing delivery reliability, retry, or dedup logic.

## Notification Matrix (core lifecycle)
Recipient → event → default channels (in-app always on; push/email defaults below are ASSUMPTION placeholders):

| Event | Recipient | In-app | Push | Email |
|---|---|---|---|---|
| Enquiry received | Provider | ✓ | ✓ | ✓ |
| Quotation submitted | Customer | ✓ | ✓ | ✓ |
| New quotation on compared enquiry | Customer | ✓ | ✓ | – |
| Quotation accepted | Provider | ✓ | ✓ | ✓ |
| Quotation rejected | Provider | ✓ | – | – |
| Booking confirmed | Both | ✓ | ✓ | ✓ |
| Booking completed | Both | ✓ | ✓ | ✓ (customer gets review prompt) |
| Payment captured/failed/refunded | Payer (+provider on release) | ✓ | ✓ | ✓ |
| Payout processed | Provider | ✓ | ✓ | ✓ |
| Verification approved/rejected/more-info | Provider | ✓ | ✓ | ✓ |
| Dispute opened/updated/resolved | Both parties | ✓ | ✓ | ✓ |
| Subscription renewal upcoming/failed/expired | Provider | ✓ | ✓ | ✓ |
| Review received | Provider | ✓ | ✓ | – |

Severity classes: `transactional` (cannot be fully disabled — payment, dispute, verification outcomes), `activity` (quotes, reviews — user-toggleable), `marketing` (opt-in only, separate consent).

## Channels
- **In-app**: persisted `notifications` table (recipient_id, type, payload JSONB, read_at, created_at); unread counts via Redis; list endpoints paginated; mark-read single and bulk.
- **Push (FCM)**: device tokens registered per user per device with platform + app role context; stale tokens pruned on FCM `UNREGISTERED` errors. Data payload always carries `type` and `deep_link` (see below). Mobile app serves both CUSTOMER and PROVIDER roles — target the role relevant to the event; if the user is in the other role, the deep link triggers role switch (see marketplace-mobile-experience).
- **Email**: transactional provider behind an `EmailChannel` abstraction; HTML + plaintext; from-domain with SPF/DKIM. ASSUMPTION: provider choice (SES/Postmark/etc.) undecided.
- **SMS**: REQUIRES VERIFICATION — Sri Lankan SMS gateway options (Dialog, Mobitel, third-party aggregators), sender-ID registration requirements, and cost. Model `SmsChannel` interface now; do not implement until verified.

## Templates and Localization
- Templates keyed by `type + channel + locale`, stored in versioned template files (not DB free-text), with typed variable schemas validated at render time.
- Locales: `en` ships first; every template key exists for `si` and `ta` from day one (fallback to `en` until translated). Never concatenate sentence fragments — use full ICU-style messages so Sinhala/Tamil grammar works.
- Currency and dates rendered via the shared localization utilities (LKR `Rs.` formatting, Asia/Colombo display — see sri-lanka-localization skill). Unicode-safe throughout (Sinhala/Tamil scripts in push + email).
- Push title/body length budgets: keep titles ≤ ~50 chars and bodies ≤ ~150 chars in all three languages.

## Delivery Reliability (Outbox Pattern)
- Domain modules write a `notification_outbox` row in the same DB transaction as the business change (event type, recipient, payload). A worker polls/consumes the outbox, resolves preferences, renders templates, and dispatches per channel.
- Per-channel delivery attempts recorded (`notification_deliveries`: channel, status, attempts, last_error). Retries with exponential backoff (ASSUMPTION: max 5 attempts, placeholder); permanent failures flagged for admin visibility.
- Dedup: deterministic `event_key` (e.g., `quotation.accepted:{quotationId}`) with uniqueness per recipient+channel prevents double-sends on retries or replayed events.
- Channel outages must never block business transactions — notifications are strictly async.

## Preferences and Aggregation
- Per-user preference matrix: category (transactional/activity/marketing) × channel toggle, plus per-type overrides. Transactional in-app cannot be disabled; legal/marketing consent stored with timestamp. REQUIRES VERIFICATION: PDPA (Sri Lanka Personal Data Protection Act) consent requirements for marketing communications.
- Quiet hours in Asia/Colombo for push (ASSUMPTION: 22:00–07:00 default, placeholder); transactional payment/dispute pushes exempt.
- Aggregation to avoid spam: burst events within a window collapse into one notification — e.g., 3 quotations on one enquiry within 30 min → "You received 3 new quotations" (ASSUMPTION: 30-min window placeholder). Implement as outbox coalescing on `(recipient, aggregation_key)` before dispatch; in-app items may remain individual while push/email aggregate.

## Reference Shapes

```sql
CREATE TABLE notification_outbox (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_key       TEXT NOT NULL,            -- 'quotation.accepted:{quotationId}'
  event_type      TEXT NOT NULL,
  recipient_id    UUID NOT NULL,
  target_role     TEXT NOT NULL,            -- CUSTOMER | PROVIDER
  payload         JSONB NOT NULL,
  aggregation_key TEXT,                     -- e.g. 'enquiry:{id}:quotations'
  status          TEXT NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_key, recipient_id)
);
```

Example FCM data payload:

```json
{
  "type": "quotation.submitted",
  "deep_link": "/customer/enquiries/8f3c.../quotations",
  "target_role": "CUSTOMER",
  "locale": "en",
  "entity_id": "8f3c..."
}
```

Example template key layout: `templates/quotation.submitted/push.en.json`,
`push.si.json`, `push.ta.json`, `email.en.mjml`, `inapp.en.json` — one folder per
event type, one file per channel+locale, typed variables schema alongside.

## Deep Links from Push
Every push carries `deep_link` using the app's URI scheme; the Flutter router maps them (authoritative table maintained with marketplace-mobile-experience):
- `enquiry.received` → `/provider/enquiries/{id}`
- `quotation.submitted` → `/customer/enquiries/{enquiryId}/quotations`
- `quotation.accepted` → `/provider/quotations/{id}`
- `booking.confirmed|completed` → `/{role}/bookings/{id}`
- `payment.*` → `/{role}/payments/{id}`
- `verification.*` → `/provider/verification`
- `dispute.*` → `/{role}/disputes/{id}`
- `subscription.*` → `/provider/subscription`
Links must be role-aware; backend sets the target role so the app can prompt role switching when needed.

## Assumptions and Open Questions
- ASSUMPTION: Default channel matrix above (which events push/email by default) is a product placeholder.
- ASSUMPTION: Retry policy (5 attempts, exponential backoff), quiet hours 22:00–07:00, and 30-min aggregation window are placeholders.
- ASSUMPTION: Email provider undecided; abstracted behind a channel interface.
- REQUIRES VERIFICATION: Sri Lankan SMS gateways, sender-ID registration, and per-message costs before enabling SMS.
- REQUIRES VERIFICATION: PDPA consent/opt-out obligations for marketing email, push, and SMS.

## Checklist
- [ ] Domain modules emit events/outbox rows only; no direct channel sends from feature code.
- [ ] Outbox row written in the same transaction as the business change.
- [ ] Dedup via deterministic event_key per recipient+channel.
- [ ] Every notification type has template keys for en/si/ta (fallback allowed, keys mandatory).
- [ ] Push payloads include `type` and role-aware `deep_link` matching the routing table.
- [ ] Preferences respected; transactional notifications never fully suppressible in-app.
- [ ] Aggregation applied to burst events (quotations especially).
- [ ] Delivery attempts, failures, and token pruning observable by admins.
- [ ] SMS and marketing-consent items remain flagged REQUIRES VERIFICATION until resolved.
