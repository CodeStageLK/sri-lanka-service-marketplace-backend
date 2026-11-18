---
name: provider-verification
description: "Provider verification workflow for the Sri Lanka Service Marketplace: document submission, admin review queue, status lifecycle (unverified/pending/verified/rejected/suspended), re-verification, capability unlocks and badge display, secure S3 document storage with presigned access, fraud signals, and the audit trail of decisions. Use when building verification submission UIs or endpoints, the admin review queue, status gates, document upload/storage, badge rendering, or verification auditing."
license: MIT
metadata:
  category: "project"
  scope: "project"
  project: "sri-lanka-service-marketplace"
  version: "1.0.0"
---

# Provider Verification

## Purpose

Define the trust backbone of the marketplace: how providers prove identity/legitimacy, how admins review and decide, what verified status unlocks, and how documents are stored securely. Verification is a core differentiator ("provider verification" is a first-class business capability) and gates provider participation.

## When to Use

- Building provider-side verification submission (web portal and Flutter, including camera capture).
- Building the admin verification review queue and decision actions.
- Implementing verification-status gates on provider endpoints.
- Handling verification document upload, storage, or access.
- Rendering the verified badge on any surface.

## Status Lifecycle

States on `provider_profiles.verification_status`: `UNVERIFIED, PENDING, VERIFIED, REJECTED, SUSPENDED`

| From | To | Trigger | Actor |
|---|---|---|---|
| UNVERIFIED | PENDING | submission completed | Provider |
| PENDING | VERIFIED | approve | Admin (verification officer) |
| PENDING | REJECTED | reject with reason | Admin |
| REJECTED | PENDING | resubmission | Provider |
| VERIFIED | SUSPENDED | suspend (fraud/policy/expired docs) | Admin |
| SUSPENDED | PENDING | re-verification submission | Provider (ASSUMPTION: allowed; confirm policy) |
| VERIFIED | PENDING | periodic re-verification required | System/Admin (ASSUMPTION: policy undefined) |

- Each submission is its own `verification_submissions` record; the profile status reflects the latest decision. History is never overwritten.
- Rejection always carries a structured reason (enum + free text) shown to the provider with resubmission guidance.
- ASSUMPTION: unlimited resubmissions with rate limiting (e.g., max 3 per 30 days) to deter abuse.

## Document Submission

- Submission contents by provider type (document **types are placeholders until legally confirmed**):
  - INDIVIDUAL: government identity document — REQUIRES VERIFICATION: exact acceptable documents in Sri Lanka (e.g., NIC, passport, driving licence) and any rules about collecting/storing copies of them.
  - BUSINESS: business registration evidence — REQUIRES VERIFICATION: acceptable Sri Lankan registration documents (e.g., business registration certificate, company incorporation) per business structure.
  - ASSUMPTION: optional supporting documents (professional certifications, proof of address) improve review confidence but are not mandatory.
- Upload flow: client requests presigned S3 PUT URL (type, size validated server-side) → uploads directly → confirms attachment; backend records key, document type, content hash, uploader, timestamp. Mobile supports camera capture.
- Accepted formats/limits (ASSUMPTION: JPEG/PNG/PDF, ≤10 MB each) are config values.
- Providers may save a draft submission and complete later (ASSUMPTION).

## Admin Review Queue

- Web-only admin dashboard; restricted to the verification sub-role (per `marketplace-authentication-authorization`).
- Queue: `PENDING` submissions ordered FIFO (ASSUMPTION: FIFO with manual prioritization; SLA targets are a product decision).
- Review screen: provider profile summary, submitted documents (viewed via short-lived presigned GET URLs — never public links), prior submission history, fraud signals panel.
- Decisions: approve / reject (structured reason) / request-more-info (ASSUMPTION: returns submission to provider without full rejection — confirm whether this intermediate state is wanted; if so add `NEEDS_INFO`).
- Two-person review for high-risk cases is a DECISION PENDING.

## What Verified Status Unlocks

ASSUMPTION (gate set inferred — ratify with product, keep enforced server-side via guard per `marketplace-authentication-authorization`):
- Submitting quotations on enquiries.
- Publishing service listings and appearing in public search/browse.
- Receiving lead notifications.
- Eligibility for paid subscriptions/advertising (ASSUMPTION).
Unverified/pending providers can: maintain profile, draft services, view (but not act on) verification requirements. Suspended providers lose all provider capabilities; in-flight bookings escalate to admin handling (ASSUMPTION).

## Verified Badge Display Rules

- Badge renders wherever the provider appears: public profile (surface 1), search/browse cards, quotation cards in the customer comparison view, booking details, mobile equivalents.
- Render strictly from the backend-provided `verificationStatus`/`isVerified` field — never cached client logic or local inference.
- Only `VERIFIED` shows the badge; `SUSPENDED` must not retain any badge remnant. No partial or "pending" public badge (ASSUMPTION).
- Badge is a trust signal in quotation comparison — ensure it is present in the quotation DTO for customers.

## Secure Document Storage

- Private S3 bucket (no public ACLs), server-side encryption, keys namespaced `verification/{providerProfileId}/{submissionId}/{uuid}`.
- Access only via short-lived presigned GET URLs issued to: the owning provider and authorized admin reviewers; every issuance is audit-logged (who, which document, when).
- Documents never pass through or persist in frontends; no document bytes in Postgres; no documents in logs or error reports.
- Retention and deletion: REQUIRES VERIFICATION — lawful retention period and deletion obligations for identity documents in Sri Lanka (and any data-protection law requirements) must be confirmed; build deletion/retention as configurable from day one.

## Verification Events and Notifications

- Domain events (after-commit, per `marketplace-system-architecture`): `verification.submitted`, `verification.decided` (approved/rejected), `verification.suspended`, `verification.reinstated`.
- Provider notifications: submission receipt, decision with reason, suspension notice, re-verification reminders — push (FCM) + in-app + email (ASSUMPTION on channel mix).
- Admin: new-submission queue counters; aging-submission alerts (ASSUMPTION: SLA thresholds configurable).

## Fraud Signals and Risk

Surface signals to reviewers (ASSUMPTION: initial heuristic set):
- Duplicate document content hash across different provider profiles.
- Mismatch between profile name and document name (manual check at launch; OCR later — DECISION PENDING).
- Reused phone/email patterns, rapid resubmissions after rejection, newly created account with immediate high-volume quoting.
- Prior suspensions or dispute history on linked accounts.
Signals inform human decisions; no auto-rejection at launch (ASSUMPTION).

## Audit Trail

- Every lifecycle event writes to `audit_logs`: submission created/updated, each document attached, every presigned access issuance, every decision (actor admin id, decision, reason, timestamp), suspensions and reinstatements.
- Decisions are immutable; corrections happen via new decisions, preserving history.
- Verification analytics (approval rate, time-to-decision) read from this trail.

## Assumptions and Open Questions

- ASSUMPTION: Status set includes SUSPENDED and allows re-verification; `NEEDS_INFO` intermediate state pending product decision.
- ASSUMPTION: Gate set (quoting, publishing, leads) requires VERIFIED.
- ASSUMPTION: Resubmission rate limits, file formats/sizes, FIFO queue ordering.
- REQUIRES VERIFICATION: Legally acceptable identity and business registration document types in Sri Lanka, and whether the platform may store copies of them.
- REQUIRES VERIFICATION: Document retention/deletion periods and data-protection obligations (consent, access requests).
- REQUIRES VERIFICATION: Any licensing/registration requirements for specific service categories (e.g., electricians) that verification should capture.
- DECISION PENDING: periodic re-verification cadence; OCR/automation; two-person review for high-risk cases.

## Checklist

- [ ] Status transitions match the lifecycle table; profile status derived from latest decision; history preserved.
- [ ] Rejections carry structured reasons; resubmission path works end-to-end (web + mobile camera).
- [ ] Documents: private bucket, presigned-only access, namespaced keys, no bytes in DB/logs/frontends.
- [ ] Every document access and decision is audit-logged with actor identity.
- [ ] Verification gates enforced server-side with live status (not stale token claims).
- [ ] Badge rendered only for VERIFIED, from backend field, on all surfaces including quotation comparison.
- [ ] Fraud signals computed and shown in the admin review screen.
- [ ] Legal document types and retention left configurable and flagged REQUIRES VERIFICATION in related PRs.
