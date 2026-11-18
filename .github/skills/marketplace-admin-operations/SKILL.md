---
name: marketplace-admin-operations
description: "Defines admin dashboard domains for the Sri Lanka Service Marketplace: verification queues, account management, taxonomy management, payment/refund operations, subscription and commission configuration, advertising slots, dispute resolution workflow, review moderation, granular admin RBAC with separation of duties, and mandatory audit logging. Use when building admin dashboard features, the Administration or Audit Logs modules, admin-only endpoints, or any moderation/operations tooling."
license: MIT
metadata:
  category: "project"
  scope: "project"
  project: "sri-lanka-service-marketplace"
  version: "1.0.0"
---

# Marketplace Admin Operations

## Purpose
Specify what the web-only admin dashboard (React, enterprise feel) must support and the backend rules behind it: operational queues, account and taxonomy management, financial operations, dispute resolution, moderation, granular admin permissions, and audit logging of every admin action. Backed by the NestJS `Administration`, `Audit Logs`, `Verification`, `Disputes`, and related modules.

## When to Use
- Building any admin dashboard screen or admin-only API endpoint.
- Implementing verification review, dispute resolution, moderation, or refund tooling.
- Designing admin roles/permissions or audit log schemas.
- Changing platform configuration (commissions, categories, locations, ad slots).

## Operational Queues
- **Provider verification queue**: pending submissions with documents (from S3 via short-lived signed URLs), provider profile context, prior attempts. Decisions: approve, reject (reasoned, from a managed reason list), request more info. Decisions trigger notifications (see marketplace-notifications) and set the provider's verified badge. ASSUMPTION: verification criteria/document types (NIC, business registration, proofs) are placeholders pending business definition. Queue supports claim/assign to avoid double review; SLA timers surfaced (ASSUMPTION: 48h review SLA placeholder).
- **Enquiry/booking monitoring**: searchable, filterable views (status, category, district, date) for support investigation — read-mostly; interventions (cancel booking on behalf of user) are explicit audited actions, never row edits.
- **Review moderation queue**: flagged/reported reviews plus auto-flag heuristics (ASSUMPTION: profanity/contact-info heuristics placeholder). Actions: keep, hide (reasoned), warn author. Original text preserved even when hidden.

## Account Management
- Customer and provider account views: profile, roles held (one account may be both CUSTOMER and PROVIDER), activity summary, financial standing, past sanctions.
- Sanctions ladder: `warn → suspend (time-boxed, reversible) → ban (indefinite, revocable only by higher role)`. Suspending a provider hides listings and blocks new quotations but preserves in-flight bookings handling (ASSUMPTION: in-flight bookings are completed or cancelled case-by-case — placeholder policy).
- Every sanction requires a reason code + free-text note and writes an audit entry; affected users are notified. Role-specific sanctions possible (suspend provider role while customer role stays active).
- PII access in admin screens is itself logged (who viewed which account). REQUIRES VERIFICATION: PDPA requirements for admin access to personal data, data export, and deletion/anonymization requests.

## Taxonomy and Platform Configuration
- **Categories**: CRUD with hierarchy (category → subcategory), slug management, activation toggles, ordering, icon/image. Deactivation hides from discovery but never orphans existing listings/bookings; merges/moves are audited bulk operations.
- **Locations**: manage the 9-province / 25-district / DS-division hierarchy (seeded per sri-lanka-localization); admins toggle **launch locations** as the platform expands from selected locations to national coverage — serviceable-area flags per district/DS division.
- **Commission configuration**: rates per category and subscription tier (placeholders per marketplace-payments-commissions) with effective-dated changes (new rates apply from a date; historical records keep frozen rates). Dual control: ASSUMPTION — commission changes require a second admin's approval (maker-checker), placeholder policy.
- **Platform configuration**: feature flags, fee settings, notification toggles, content blocks — all versioned, effective-dated where money-relevant, and audited with before/after.

## Financial Operations
- Payment/refund operations console: look up payments by booking/user/gateway reference; issue full/partial refunds through the Payments module APIs only (never DB edits); view ledger entries and reconciliation discrepancies.
- Payout management: review scheduled payouts, hold/release (reasoned), reprocess failures with idempotency.
- Subscription management: view provider subscriptions, grant complimentary periods, extend grace, force-cancel — each an audited action with reason.
- Separation of duties (see RBAC): the role that configures commission rates should not also be able to issue refunds/payouts — ASSUMPTION: exact duty split is a placeholder, but the permission model must make such splits expressible.

## Advertising Slots
- Manage ad inventory: slot definitions (home hero, category top, search inline — ASSUMPTION placeholder slot list), scheduling calendar, advertiser/provider assignment, creative approval (reject with reason), pricing records.
- Creative approval is a moderation action (audited); expired/ended campaigns auto-unpublish. Billing for ads flows through Payments ledger like all revenue.

## Dispute Resolution Workflow
ASSUMPTION: the stage model below is a placeholder pending business sign-off.
- Stages: `opened → awaiting_evidence → under_review → proposed_resolution → resolved | escalated`.
- Evidence: both parties upload documents/photos/messages within a window (ASSUMPTION: 5 days placeholder); evidence immutable once submitted; admins see a unified timeline.
- Outcomes: full refund, partial refund/split, release to provider, goodwill credit — executed only via Disputes → Payments module calls (clawback rules per marketplace-payments-commissions). Outcome requires reason + notes; parties notified; repeat-offender signals feed account management.
- Assignment, SLA timers, and internal admin-only comments supported; resolution decisions by a role distinct from first-line support (separation of duties).

## Reference Shapes

```sql
CREATE TABLE audit_logs (                 -- append-only; no UPDATE/DELETE grants
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id    UUID NOT NULL,
  actor_role  TEXT NOT NULL,
  action      TEXT NOT NULL,              -- 'accounts.suspend', 'commissions.update'
  target_type TEXT NOT NULL,
  target_id   TEXT NOT NULL,
  before      JSONB,                      -- PII-minimized snapshot
  after       JSONB,
  reason      TEXT NOT NULL,
  ip          INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Example entry:

```json
{
  "actor_id": "adm-41ce...",
  "actor_role": "FINANCE_OPERATOR",
  "action": "payments.refund",
  "target_type": "payment",
  "target_id": "pay-9b4d...",
  "before": { "status": "released_to_provider" },
  "after":  { "status": "partially_refunded", "refund_amount": "2500.00" },
  "reason": "dispute DSP-1042 resolution: partial refund",
  "ip": "203.94.x.x"
}
```

NestJS pattern: a class-level `@Audited(action)` decorator + interceptor captures
before/after via the handler's repository hooks so new admin endpoints cannot
skip audit logging; endpoints without `@Audited` on admin controllers fail CI lint.

## Admin RBAC and Separation of Duties
- Granular permissions, not monolithic "admin": e.g., `verification.review`, `accounts.suspend`, `accounts.ban`, `payments.refund`, `payouts.manage`, `commissions.configure`, `subscriptions.manage`, `ads.manage`, `disputes.resolve`, `reviews.moderate`, `taxonomy.manage`, `config.manage`, `audit.read`.
- Roles are named bundles of permissions (ASSUMPTION placeholder roles: Support Agent, Verification Officer, Finance Operator, Moderator, Platform Admin, Super Admin). Enforced server-side via NestJS guards on every admin endpoint — the UI hides what the API must still reject.
- Separation of duties enforced in the role design: config-changers ≠ money-movers ≠ final dispute arbiters where feasible. Super Admin role assignments themselves are audited and rare.
- Admin auth: same JWT infrastructure; ASSUMPTION: MFA required for admin accounts — strongly recommended placeholder.

## Audit Logging (non-negotiable)
- Every admin mutation writes an `audit_logs` entry: `actor_id`, `actor_role`, `action` (verb.noun), `target_type`/`target_id`, `before`/`after` JSON snapshots (PII-minimized), `reason`, `ip`, `timestamp` (UTC).
- Audit log is append-only (no UPDATE/DELETE grants); implemented as a cross-cutting interceptor/decorator so new admin endpoints cannot silently skip it.
- Admin reads of sensitive PII and document views are also logged (lighter `access_logs`).
- Audit viewer in admin UI: filter by actor/target/action/date; export for investigations. Retention: ASSUMPTION — retain ≥ 2 years, placeholder pending legal/PDPA verification.

## Assumptions and Open Questions
- ASSUMPTION: Verification document requirements, review SLA (48h), and rejection reason list are placeholders.
- ASSUMPTION: Dispute stages, 5-day evidence window, and outcome set are placeholders.
- ASSUMPTION: Role bundle names, maker-checker for commission changes, admin MFA, in-flight booking policy on suspension, ad slot list, audit retention — all placeholders.
- REQUIRES VERIFICATION: PDPA obligations for admin PII access logging, data export/deletion workflows, and audit retention periods.
- REQUIRES VERIFICATION: legal requirements for dispute handling/consumer protection in Sri Lanka affecting outcome options and timelines.

## Checklist
- [ ] Every admin endpoint guarded by a granular permission; UI gating is cosmetic only.
- [ ] Every admin mutation produces an append-only audit entry with actor, action, target, before/after, reason.
- [ ] Financial interventions go through module APIs (Payments/Subscriptions), never direct data edits.
- [ ] Sanctions are reasoned, reversible where designed, role-scoped, and notified.
- [ ] Taxonomy changes never orphan existing data; merges are audited bulk operations.
- [ ] Commission/config changes are effective-dated; historical records keep frozen values.
- [ ] Dispute outcomes executed via Disputes → Payments integration with clawback support.
- [ ] Separation of duties expressible and applied in role design.
- [ ] PII views logged; PDPA items remain flagged until verified.
