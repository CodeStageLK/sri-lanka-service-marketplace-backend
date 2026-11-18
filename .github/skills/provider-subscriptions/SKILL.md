---
name: provider-subscriptions
description: "Defines provider subscription tiers, lifecycle states, renewals, grace periods, upgrades/downgrades, entitlement enforcement, and billing records for the Sri Lanka Service Marketplace. Use when implementing the Subscriptions module, tier-gated features (listing visibility, lead quotas, featured placement), subscription guards/quota checks, renewal and dunning jobs, or subscription billing UI in the provider portal or Flutter app."
license: MIT
metadata:
  category: "project"
  scope: "project"
  project: "sri-lanka-service-marketplace"
  version: "1.0.0"
---

# Provider Subscriptions

## Purpose
Specify how provider subscription packages work end to end: tier definitions, what each tier gates, the subscription lifecycle state machine, renewal/grace/dunning behavior, upgrade/downgrade rules, and where the NestJS backend enforces entitlements. Subscriptions are a core revenue stream alongside commissions, lead fees, and advertising.

## When to Use
- Implementing or modifying the `Subscriptions` module, plan entities, or entitlement checks.
- Adding any feature that behaves differently per tier (visibility, quotas, analytics depth, featured placement).
- Building subscription purchase/renewal/cancel UI in the provider portal or mobile app.
- Writing scheduled jobs for renewals, expiry, or dunning.

## Tier Model
- Free tier + one or more paid tiers. ASSUMPTION: Placeholder tier names and prices — e.g., `FREE`, `STANDARD`, `PREMIUM` with LKR monthly prices TBD. Never hardcode names/prices; load from a `subscription_plans` table (code, name, price NUMERIC(14,2), currency 'LKR', billing_period, entitlements JSONB, active flag).
- Plans are versioned: changing a price creates a new plan version; existing subscribers stay on their version until renewal policy dictates otherwise (ASSUMPTION: existing subscribers renew at new price with advance notice — business decision pending).
- Entitlements gated per tier (all ASSUMPTION placeholders until product finalizes):
  - Listing visibility/ranking boost in search and category pages.
  - Monthly lead/enquiry quota (number of enquiries a provider can receive or respond to).
  - Number of active service listings.
  - Featured placement eligibility (home page, category top slots).
  - Analytics depth (basic counts vs full performance dashboard).
  - Reduced commission rate (links to marketplace-payments-commissions skill).
  - Verified-badge fast-track eligibility — ASSUMPTION; verification itself must never be purchasable.

## Lifecycle State Machine
States: `trialing → active → past_due → cancelled → expired`, plus `paused` if later required.
- `trialing`: ASSUMPTION — a free trial exists for paid tiers (length placeholder, e.g., 14 days); converts to `active` on successful first charge.
- `active`: entitlements fully granted; renewal scheduled at period end.
- `past_due`: renewal charge failed; entitlements remain granted during grace period (ASSUMPTION: 7-day grace, placeholder). Dunning runs here.
- `cancelled`: provider cancelled; remains entitled until the paid-through date, then transitions to `expired` (cancel = cancel-at-period-end by default; immediate cancel is an admin action).
- `expired`: entitlements revoked; provider falls back to the free tier automatically — never to zero access, since free listings are part of the revenue model.
Persist every transition in `subscription_events` (subscription_id, from, to, reason, actor, timestamp). Scheduled transitions (expiry, grace end) run via idempotent cron/queue jobs keyed by subscription id + period.

## Renewal, Proration, Upgrade/Downgrade
- Renewal: attempt charge at period end via the Payments module (same gateway abstraction, idempotency keys, NUMERIC amounts, immutable transaction records).
- Dunning basics: on failure, schedule retries (ASSUMPTION: retry at +1d, +3d, +5d, placeholders), send notifications per attempt (see marketplace-notifications), move to `expired`/free tier after grace end. All retry attempts logged.
- **Upgrade** (e.g., STANDARD → PREMIUM): effective immediately. ASSUMPTION: charge prorated difference for remainder of current period; new entitlements apply at once. Proration formula: `(days_remaining / days_in_period) × (new_price − old_price)`, rounded to 2 decimals, recorded as its own transaction.
- **Downgrade**: effective at period end (keep current entitlements until paid-through date); no refunds for downgrade mid-period. ASSUMPTION — pending business decision.
- If a downgrade would put the provider over the lower tier's limits (e.g., more active listings than allowed), excess items become hidden/suspended, not deleted; provider chooses which to keep.

## Reference Shapes

```sql
CREATE TABLE subscription_plans (
  id             UUID PRIMARY KEY,
  code           TEXT NOT NULL,            -- 'FREE' | 'STANDARD' | 'PREMIUM' (placeholders)
  version        INT  NOT NULL,
  name           TEXT NOT NULL,
  price          NUMERIC(14,2) NOT NULL,
  currency       CHAR(3) NOT NULL DEFAULT 'LKR',
  billing_period TEXT NOT NULL DEFAULT 'monthly',
  entitlements   JSONB NOT NULL,
  active         BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (code, version)
);
```

Example `entitlements` JSONB (all values ASSUMPTION placeholders):

```json
{
  "max_active_listings": 10,
  "monthly_lead_quota": 50,
  "search_boost": 1,
  "featured_placement": true,
  "analytics_depth": "full",
  "commission_discount_pct": 2.0
}
```

Example NestJS enforcement:

```ts
@Post('listings')
@RequiresRole('PROVIDER')
async createListing(@ActiveProvider() p: ProviderCtx) {
  const ent = await this.entitlements.get(p.id);        // Redis-cached
  if (await this.listings.activeCount(p.id) >= ent.maxActiveListings) {
    throw new QuotaExceededException('max_active_listings'); // typed code: QUOTA_EXCEEDED
  }
  // ...
}
```

## Backend Enforcement Points
- Single source of truth: an `EntitlementsService` in the Subscriptions module exposing `getEntitlements(providerId)` (cached in Redis with invalidation on any subscription event). No feature module reads plan tables directly.
- NestJS guards/decorators for route-level gating: e.g., `@RequiresEntitlement('featured_placement')` on featured-ad endpoints.
- Quota checks (lead quota, listing count) enforced server-side at the write path (creating a listing, receiving/responding to an enquiry) with clear, typed error codes (`QUOTA_EXCEEDED`, `TIER_REQUIRED`) so web and Flutter clients render upgrade prompts consistently.
- Search/ranking boosts applied in the Services/Discovery query layer by reading the cached tier — never trust a client-supplied tier.
- Admin override: admins can grant complimentary subscriptions or extend periods; every override writes an audit log entry (actor, target, before/after).

## Billing Records
- Each charge (initial, renewal, proration) creates an immutable billing record linked to the subscription and the Payments ledger: plan version, period covered (start/end in UTC), amount NUMERIC(14,2) LKR, status, gateway reference.
- Providers can view/download billing history in the portal. REQUIRES VERIFICATION: Sri Lankan invoice/VAT requirements for subscription receipts (tax lines, registration numbers).
- Refund of a subscription charge follows the Payments refund flow and must revoke or adjust the covered period explicitly.

## Assumptions and Open Questions
- ASSUMPTION: Tier names (FREE/STANDARD/PREMIUM), prices, and count of paid tiers are placeholders.
- ASSUMPTION: Exact entitlement matrix (quotas, visibility boost, analytics depth, commission discounts) is undecided; model entitlements as data (JSONB), not code branches per tier name.
- ASSUMPTION: 14-day trial, 7-day grace period, dunning retry schedule +1d/+3d/+5d — all placeholders.
- ASSUMPTION: Upgrades prorate immediately; downgrades apply at period end; renewals adopt new plan pricing with notice.
- ASSUMPTION: Monthly billing period default; annual plans possible later.
- REQUIRES VERIFICATION: VAT/tax treatment and invoice format for subscription fees in Sri Lanka.
- REQUIRES VERIFICATION: recurring-charge support and card-on-file/tokenization rules of chosen Sri Lankan payment gateways (affects whether renewals can auto-charge or need customer-initiated payment).

## Checklist
- [ ] Plans and entitlements stored as versioned data; no tier names hardcoded in business logic.
- [ ] Lifecycle implemented as explicit state machine with persisted `subscription_events`.
- [ ] Expired paid subscriptions fall back to free tier, never zero access.
- [ ] All entitlement checks go through `EntitlementsService` + guards; server-side only.
- [ ] Quota/tier errors use typed codes consumed identically by web and Flutter.
- [ ] Renewal/dunning jobs idempotent (keyed by subscription + period); retries and notifications logged.
- [ ] Proration amounts computed with NUMERIC precision and recorded as transactions.
- [ ] Downgrade over-limit handling hides, never deletes, provider content.
- [ ] Admin subscription overrides fully audited.
- [ ] Billing records immutable and linked to the payments ledger; VAT handling flagged for verification.
