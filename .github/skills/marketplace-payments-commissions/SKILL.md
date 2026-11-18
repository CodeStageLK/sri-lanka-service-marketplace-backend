---
name: marketplace-payments-commissions
description: "Defines payment flows, commission calculation, lead-generation fees, provider payouts, refunds, and ledger-style record keeping for the Sri Lanka Service Marketplace. Use when implementing or reviewing the Payments, Commissions, or Bookings modules, payment gateway integration, payout logic, refund handling, transaction records, or any money-movement code in the NestJS backend or client payment UIs."
license: MIT
metadata:
  category: "project"
  scope: "project"
  project: "sri-lanka-service-marketplace"
  version: "1.0.0"
---

# Marketplace Payments and Commissions

## Purpose
Establish consistent, auditable rules for all money movement on the platform: customer payments for bookings, platform commission deduction, lead-generation fees charged to providers, provider payouts, and refunds. Applies to the NestJS `Payments`, `Commissions`, `Bookings`, and `Disputes` modules and to payment UI on web and Flutter surfaces.

## When to Use
- Implementing payment capture, commission deduction, payout, or refund endpoints.
- Designing `payments`, `transactions`, `payouts`, or `commission_rates` tables/entities.
- Integrating a Sri Lankan payment gateway or wiring webhooks.
- Reviewing any PR that touches amounts, currency, payment state, or financial records.

## Payment Flow and Capture Timing
Core lifecycle: enquiry → quotations → comparison → acceptance → booking → payment (with commission) → review.

Capture timing options (pick one per booking type; the platform must support switching without schema change):
1. **Capture on quotation acceptance** — customer pays full amount when accepting a quote; funds held by platform until service completion (escrow-like). Best trust/fraud protection; heavier refund load.
2. **Capture on booking completion** — payment collected after the service is marked complete. Lower refund volume; higher no-pay risk.
3. **Deposit + balance** — partial capture on acceptance, remainder on completion.

ASSUMPTION: Default is option 1 (capture on acceptance, release to provider after completion). This is a business decision placeholder — confirm with stakeholders before hardcoding.

Payment states (model as an explicit state machine, never booleans):
`pending → processing → captured → released_to_provider | refunded | partially_refunded`; failure branches: `failed`, `expired`, `cancelled`. Persist every transition with timestamp, actor, and reason in a `payment_events` table.

## Commission and Fees
- Commission is deducted from the captured amount before payout: `payout = captured_amount − commission − gateway_fees_borne_by_provider`.
- Commission rates are configurable per **category** and per **provider subscription tier**, resolved at capture time and frozen onto the payment record (never recompute historical commissions from current config).
- ASSUMPTION: Placeholder default commission rate 10% flat across categories; tier-based reductions (e.g., paid tiers get lower rates) are placeholders until pricing is decided.
- **Lead-generation fees**: providers may be charged per qualified enquiry/lead independent of bookings. Model as separate `charge_type = LEAD_FEE` transactions against the provider balance; ASSUMPTION: fee amounts per category are placeholders.
- Commission configuration lives in the `Commissions` module, editable only by admins, with full audit log entries (before/after values).

## Provider Payouts
- Payouts transfer the provider's accrued balance (released payments minus fees) to their bank account.
- ASSUMPTION: Weekly payout schedule with LKR 1,000 minimum balance — both placeholders pending business decision.
- Payout record fields: provider_id, period, gross, commission_total, fees_total, net, bank reference, status (`scheduled → processing → paid | failed`).
- Never pay out funds for bookings still inside the dispute window; ASSUMPTION: dispute window length (e.g., 72h after completion) is a placeholder.
- Failed payouts must not silently retry money movement — require explicit reprocessing with idempotency key.

## Refunds and Disputes
- Refunds are always linked to a payment and optionally a dispute: full, partial, or goodwill.
- A refund on a `released_to_provider` payment creates a negative adjustment on the provider balance (clawback); if balance is insufficient, it nets against future earnings.
- Dispute resolution outcomes (refund customer / pay provider / split) are executed only by the Disputes module calling Payments — never by direct DB edits.
- Refund state: `requested → approved → processing → completed | failed`, each transition audited.

## Reference Schema Sketch
Illustrative shapes (adapt names to module conventions; amounts always NUMERIC):

```sql
CREATE TABLE payments (
  id            UUID PRIMARY KEY,
  booking_id    UUID NOT NULL REFERENCES bookings(id),
  payer_id      UUID NOT NULL,
  amount        NUMERIC(14,2) NOT NULL,
  currency      CHAR(3) NOT NULL DEFAULT 'LKR',
  status        TEXT NOT NULL,            -- state machine value
  commission_rate NUMERIC(5,4) NOT NULL,  -- frozen at capture time
  commission_amount NUMERIC(14,2) NOT NULL,
  gateway       TEXT NOT NULL,
  gateway_ref   TEXT,
  idempotency_key TEXT UNIQUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ledger_entries (             -- append-only, no UPDATE/DELETE grants
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entry_group   UUID NOT NULL,            -- one business event = balanced group
  account       TEXT NOT NULL,            -- customer_funds | platform_escrow |
                                          -- platform_revenue | provider_balance | gateway_fees
  debit         NUMERIC(14,2) NOT NULL DEFAULT 0,
  credit        NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_id    UUID REFERENCES payments(id),
  provider_id   UUID,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (debit = 0 OR credit = 0)
);
```

Example balanced group for a capture of Rs. 10,000.00 at 10% commission:
escrow +10,000.00 (debit customer_funds / credit platform_escrow); on release:
platform_escrow debit 10,000.00, provider_balance credit 9,000.00, platform_revenue credit 1,000.00.

## Ledger and Record Keeping
- All financial records are **immutable**: no UPDATE/DELETE on transaction rows; corrections are compensating entries.
- Adopt a double-entry mindset: every movement has a debit and credit account (customer funds, platform escrow, platform revenue, provider balance, gateway fees). Even if implemented as a single `ledger_entries` table, each business event writes balanced entries.
- Store all LKR amounts as PostgreSQL `NUMERIC(14,2)` (or minor-unit BIGINT cents consistently — pick one platform-wide; NUMERIC(14,2) is the default here). Never `float`/`double` anywhere, including TypeScript (use string/decimal libs) and Dart.
- Every external gateway interaction stores the raw gateway payload (request id, reference, status) for reconciliation.
- Daily reconciliation job: platform ledger totals vs gateway settlement reports; discrepancies raise admin alerts.

## Idempotency and Gateway Integration
- Every money-moving endpoint accepts an `Idempotency-Key` header; keys stored with a hash of the request body; replays return the original result.
- Gateway webhooks are the source of truth for capture confirmation; verify signatures, process via a persisted inbox table, and make handlers idempotent (webhooks can arrive duplicated or out of order).
- REQUIRES VERIFICATION: choice and compliance requirements of Sri Lankan gateways (PayHere, DirectPay, mCash/eZ Cash, bank IPG options), their settlement timelines, LKR-only constraints, and Central Bank of Sri Lanka payment regulations.
- REQUIRES VERIFICATION: tax/VAT treatment of commissions, lead fees, and subscriptions on invoices.
- PCI scope minimization: **never store, log, or proxy card numbers, CVV, or expiry**. Use gateway-hosted payment pages or tokenized checkout only. Backend handles gateway tokens/references exclusively. Mask any PAN-like strings in logs via a sanitizer.

## Assumptions and Open Questions
- ASSUMPTION: Payment captured on quotation acceptance and held until completion (escrow-like default).
- ASSUMPTION: 10% placeholder commission; per-category and per-tier rates undecided.
- ASSUMPTION: Lead-generation fee amounts per category are placeholders.
- ASSUMPTION: Weekly payouts, LKR 1,000 minimum, 72h dispute hold window — all placeholders.
- ASSUMPTION: Gateway fees borne by provider vs platform is undecided; model the field now.
- REQUIRES VERIFICATION: Sri Lankan payment gateway selection, licensing, and Central Bank regulations.
- REQUIRES VERIFICATION: VAT/tax obligations on platform fees and invoicing requirements.
- REQUIRES VERIFICATION: whether holding customer funds pre-completion legally constitutes regulated escrow in Sri Lanka.

## Checklist
- [ ] Amounts stored as NUMERIC(14,2); no floats in TS/Dart/SQL.
- [ ] Payment modeled as explicit state machine with persisted transition events.
- [ ] Commission rate resolved at capture time and frozen on the payment record.
- [ ] Ledger entries immutable; corrections are compensating entries, debits = credits.
- [ ] Idempotency keys on all money-moving endpoints; idempotent webhook handlers with signature verification.
- [ ] Payouts blocked during dispute windows; clawbacks handled for post-release refunds.
- [ ] No card data stored or logged; gateway-hosted/tokenized checkout only.
- [ ] Admin-only commission config changes with before/after audit logs.
- [ ] Reconciliation job compares ledger vs gateway settlement.
- [ ] All ASSUMPTION placeholders flagged in code comments/config, not hardcoded as final.
