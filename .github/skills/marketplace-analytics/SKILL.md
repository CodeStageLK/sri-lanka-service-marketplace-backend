---
name: marketplace-analytics
description: "Defines platform analytics (GMV, take rate, conversion funnels, demand heatmaps), provider-facing performance metrics, event tracking design, privacy constraints, and reporting-table architecture for the Sri Lanka Service Marketplace. Use when implementing the Analytics module, adding domain-to-analytics event mappings, building admin or provider dashboards, defining metrics, or creating reporting tables and materialized views."
license: MIT
metadata:
  category: "project"
  scope: "project"
  project: "sri-lanka-service-marketplace"
  version: "1.0.0"
---

# Marketplace Analytics

## Purpose
Make platform and provider analytics consistent, privacy-safe, and cheap to query: one event-tracking design, documented metric definitions, and a clear split between transactional tables and reporting structures. Serves the admin dashboard (platform health, revenue) and the provider portal/mobile app (performance analytics, tier-gated depth per provider-subscriptions).

## When to Use
- Implementing or extending the NestJS `Analytics` module or its event consumers.
- Adding a new chart/KPI to the admin dashboard or provider analytics screens.
- Emitting analytics events from domain modules (enquiries, quotations, bookings, payments).
- Creating reporting tables, materialized views, or scheduled aggregation jobs.
- Resolving disagreements about what a metric means.

## Admin (Platform) Metrics
All platform metrics are defined once in a metrics dictionary (versioned doc in-repo); dashboards may only display dictionary metrics.
- **GMV**: sum of captured booking payment amounts (LKR, NUMERIC) in period; refunds subtracted in "Net GMV" — report both, label clearly.
- **Bookings**: count by status (confirmed, completed, cancelled) per period/category/district.
- **Take rate**: platform revenue (commissions + lead fees + subscriptions + advertising) ÷ GMV; also report commission-only take rate — the dictionary fixes which is "the" take rate (ASSUMPTION: commission-only is headline, placeholder).
- **Conversion funnels**: enquiry → ≥1 quotation received → quotation accepted → booking confirmed → booking completed → review left. Report stage conversion % and median time-in-stage. Funnel entry is enquiry creation; windows are cohort-based on enquiry creation date.
- **Provider activation**: % of registered providers who complete profile → get verified → publish a listing → receive first enquiry → win first booking, within N days of signup (ASSUMPTION: N=30, placeholder).
- **Demand heatmaps**: enquiry and booking volume by category × district (25 districts) and province (9), powering expansion decisions from launch locations to national rollout. Requires every enquiry to carry a normalized location reference (see sri-lanka-localization).
- Revenue breakdown by stream: commissions, lead-generation fees, subscriptions, advertisements — mirroring the ledger, never recomputed from raw bookings alone.

## Provider-Facing Metrics
Shown in provider portal and Flutter app; depth may be tier-gated (see provider-subscriptions; gating matrix is an ASSUMPTION there).
- Profile views and listing impressions (period over period).
- Enquiries received; enquiry response rate and **median response time** (enquiry received → first provider reply/quotation).
- **Quote win rate**: accepted quotations ÷ submitted quotations (exclude withdrawn; dictionary defines handling of expired enquiries).
- Bookings completed, cancellation rate, review average and count.
- Benchmarks ("vs category average in your district") must be aggregates over ≥ a minimum cohort size to avoid exposing individual competitors (ASSUMPTION: minimum cohort 5, placeholder).

## Event Tracking Design
- Domain modules emit **domain events** (e.g., `QuotationAccepted`) for business workflows; the Analytics module subscribes and maps them to **analytics events** — analytics never drives business logic and can lag without breaking flows.
- Naming convention: `object.action` lowercase snake-free dot notation: `enquiry.created`, `quotation.submitted`, `quotation.accepted`, `booking.completed`, `payment.captured`, `provider.verified`, `subscription.renewed`. Past-tense actions only.
- Event envelope: `event_name`, `event_id` (UUID), `occurred_at` (UTC), `actor_type` (customer/provider/admin/system), pseudonymous `actor_id`, `entity_type/entity_id`, context (category_id, district_id, platform: web/mobile, role), schema `version`.
- Events appended to an immutable `analytics_events` table (partitioned by month); consumers are idempotent on `event_id`.
- Client-side events (page/screen views for profile-view counts) flow through a thin ingestion endpoint with the same envelope; bot/self-view filtering applied before counting (providers viewing their own profile are excluded).

## Privacy Constraints
- Dashboards expose **aggregates only** — no browsing of individual customer behavior. Minimum aggregation thresholds on any sliced metric (ASSUMPTION: suppress cells with n < 5, placeholder).
- Analytics tables store pseudonymous IDs, never names, phone numbers, emails, or free-text enquiry content.
- Provider analytics show the provider only their own data plus anonymized aggregates.
- REQUIRES VERIFICATION: Sri Lanka PDPA obligations for analytics processing, retention limits, and whether profile-view tracking of logged-in users needs disclosure/consent.
- Retention: raw event rows retained per a defined policy (ASSUMPTION: 24 months raw, aggregates indefinitely — placeholder pending PDPA verification).

## Reporting Architecture
- **Never** run dashboard aggregations against hot transactional tables. Pattern: transactional tables → domain events → `analytics_events` → scheduled rollups.
- Rollup tables/materialized views per grain: `daily_platform_metrics`, `daily_category_district_metrics`, `daily_provider_metrics` — refreshed by scheduled jobs (Postgres materialized views with `REFRESH ... CONCURRENTLY`, or plain rollup tables written by workers; prefer rollup tables for incremental loads).
- Admin dashboard queries rollups only; "today" tiles may query a short-window live path clearly labeled provisional.
- Funnel/cohort queries run on `analytics_events` partitions, scheduled off-peak, results cached.
- Money fields in rollups remain NUMERIC; counts BIGINT; all timestamps UTC, converted to Asia/Colombo only at display. "Daily" buckets are Asia/Colombo days — fix this in the dictionary to avoid UTC off-by-5:30 bugs.

## Reference Shapes

Example analytics event envelope:

```json
{
  "event_name": "quotation.accepted",
  "event_id": "c1a2...",
  "occurred_at": "2025-11-15T09:12:33Z",
  "actor_type": "customer",
  "actor_id": "pseudo-7f1e...",
  "entity_type": "quotation",
  "entity_id": "9b4d...",
  "context": {
    "category_id": "cat-plumbing",
    "district_id": "LK-11",
    "platform": "mobile",
    "role": "CUSTOMER"
  },
  "version": 1
}
```

Example rollup grain:

```sql
CREATE TABLE daily_category_district_metrics (
  metric_date   DATE NOT NULL,            -- Asia/Colombo day
  category_id   UUID NOT NULL,
  district_id   TEXT NOT NULL,
  enquiries     BIGINT NOT NULL DEFAULT 0,
  quotations    BIGINT NOT NULL DEFAULT 0,
  bookings      BIGINT NOT NULL DEFAULT 0,
  gmv           NUMERIC(16,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (metric_date, category_id, district_id)
);
```

Example metrics dictionary entry:
`quote_win_rate` — formula: accepted ÷ submitted quotations in period; excludes
withdrawn; expired enquiries count as not-accepted; grain: provider × Colombo-day;
owner: Analytics module; version: 1.

## Metric Definition Discipline
- Every metric has a dictionary entry: name, formula, inclusion/exclusion rules, grain, timezone of bucketing, owner, version. Changing a definition bumps the version and annotates dashboards.
- Admin and provider surfaces must use identical definitions for shared metrics (e.g., response time) — single backend computation, never re-derived in frontend code.

## Assumptions and Open Questions
- ASSUMPTION: Headline take rate = commission-only; activation window = 30 days; suppression threshold n=5; benchmark cohort ≥5; raw retention 24 months — all placeholders.
- ASSUMPTION: Which provider metrics are free vs paid-tier is undecided (tracked in provider-subscriptions).
- ASSUMPTION: Postgres-based rollups suffice at launch scale; no separate warehouse until data volume demands it.
- REQUIRES VERIFICATION: PDPA requirements for analytics consent, retention, and profile-view tracking.
- REQUIRES VERIFICATION: whether financial reporting (GMV/revenue) must reconcile to tax/VAT filings in a specific format.

## Checklist
- [ ] Every new metric added to the metrics dictionary before any dashboard work.
- [ ] Analytics consumes domain events; no analytics writes inside business transactions.
- [ ] Event names follow `object.action` past-tense convention with versioned envelope.
- [ ] `analytics_events` immutable, partitioned, idempotent consumers on event_id.
- [ ] Dashboards query rollups/materialized views, not transactional tables.
- [ ] Daily bucketing in Asia/Colombo; storage in UTC; money as NUMERIC.
- [ ] No PII in analytics tables; aggregates enforce suppression thresholds.
- [ ] Provider sees only own data + anonymized benchmarks; self-views excluded from counts.
- [ ] Heatmap dimensions use normalized province/district references.
- [ ] PDPA items remain flagged until verified.
