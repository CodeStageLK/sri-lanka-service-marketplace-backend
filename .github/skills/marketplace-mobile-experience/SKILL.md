---
name: marketplace-mobile-experience
description: "Flutter app conventions for the Sri Lanka Service Marketplace mobile app: customer/provider role switching, GoRouter shell architecture, feature-first modules mirroring backend domains, offline tolerance, push deep-link routing, secure token storage, localization formatting, maps, image upload, and web parity rules. Use when building or reviewing any Flutter screen, navigation, state (Riverpod), networking (Dio), notification handling, or mobile feature for this product."
license: MIT
metadata:
  category: "project"
  scope: "project"
  project: "sri-lanka-service-marketplace"
  version: "1.0.0"
---

# Marketplace Mobile Experience

## Purpose
Define how the single Flutter app serves BOTH customer and provider roles with in-app role switching, stays in parity with the web surfaces, and follows consistent conventions: Riverpod state, Dio networking, GoRouter navigation, Freezed models, flutter_secure_storage, FCM, deep links, maps, and camera. Admin remains web-only — never build admin features in the app.

## When to Use
- Creating any new Flutter feature, screen, route, or provider (Riverpod).
- Implementing role switching, navigation shells, or deep-link handling.
- Wiring push notifications, token storage/refresh, image upload, or maps.
- Reviewing mobile PRs for parity with web/API contracts.

## Role Switching UX
- One account may hold CUSTOMER and PROVIDER roles. The app offers a **persistent role toggle** (profile menu and/or app-bar switcher) — never separate logins or accounts.
- Active role stored locally (non-sensitive: shared prefs) and reflected in an `activeRoleProvider` (Riverpod); switching swaps the navigation shell, not the auth session. JWT stays the same; the backend authorizes per-role via RBAC claims — the client toggle is presentation-only, never a security boundary.
- If a user has only one role, hide the toggle; surface "Become a provider" entry (customer → provider registration flow) instead.
- Role-targeted content (notifications, deep links) carries the target role; if it mismatches the active role, prompt a one-tap role switch before navigating.

## Navigation Architecture (GoRouter)
- Two `ShellRoute`s (or `StatefulShellRoute`s) — one per role — each with its own bottom navigation:
  - Customer shell: Home/Discovery, Enquiries, Bookings, Notifications, Profile.
  - Provider shell: Dashboard, Enquiries/Leads, Quotations, Bookings, Profile. (Tab sets are ASSUMPTION placeholders pending design.)
- Route paths are role-prefixed: `/customer/...`, `/provider/...`; shared auth/onboarding routes unprefixed.
- Redirect logic: unauthenticated → login; authenticated with mismatched role prefix → role-switch prompt; deep links resolved after auth restore completes (buffer pending links).

## Feature-First Module Map
Mirror backend domains; one folder per feature with `data/` (Dio API clients, DTOs), `domain/` (Freezed models), `presentation/` (screens, widgets, Riverpod providers):
`auth`, `discovery` (categories, search, provider profiles, locations), `enquiries`, `quotations`, `bookings`, `payments`, `reviews`, `notifications`, `profile`, and provider-side `provider_dashboard`, `provider_listings`, `provider_quotations`, `provider_verification`, `provider_subscription`, `provider_analytics`. Shared code in `core/` (theme, routing, networking, localization, widgets).
- Freezed + json_serializable for all API models; DTOs generated to match the Swagger/OpenAPI contract — the REST API is the single contract shared with web.

## Reference Structure

```text
lib/
  core/            # theme, router, dio client, localization, shared widgets
  features/
    auth/
      data/        # api clients, DTOs (Freezed + json_serializable)
      domain/      # models
      presentation/# screens, widgets, riverpod providers
    discovery/
    enquiries/
    quotations/
    bookings/
    payments/
    reviews/
    notifications/
    profile/
    provider_dashboard/
    provider_listings/
    provider_quotations/
    provider_verification/
    provider_subscription/
    provider_analytics/
```

Role-shell routing sketch:

```dart
StatefulShellRoute.indexedStack(          // customer shell
  branches: [homeBranch, enquiriesBranch, bookingsBranch, profileBranch],
  redirect: (ctx, state) =>
      ref.read(activeRoleProvider) == Role.customer ? null : '/switch-role?to=customer',
);
// mirrored provider shell under /provider/...
```

## Connectivity and Offline Tolerance
- ASSUMPTION (business decision placeholder): **discovery is offline-tolerant, transactions are online-required.** Categories, recent search results, viewed provider profiles, and own bookings list are cached (e.g., Riverpod + local cache) and readable offline with a staleness banner. Creating enquiries, submitting/accepting quotations, payments, and subscription changes require connectivity — fail fast with a clear retry UI; never queue money-affecting writes offline.
- All mutating requests send idempotency keys (matches backend payments/booking idempotency) so user-initiated retries are safe.

## Push → Deep Link Routing Table
FCM data payloads carry `type` and `deep_link` (contract owned jointly with marketplace-notifications). Router mapping:

| Event type | Route |
|---|---|
| `enquiry.received` | `/provider/enquiries/{id}` |
| `quotation.submitted` | `/customer/enquiries/{enquiryId}/quotations` |
| `quotation.accepted` / `rejected` | `/provider/quotations/{id}` |
| `booking.confirmed` / `completed` | `/{role}/bookings/{id}` |
| `payment.captured` / `failed` / `refunded` | `/{role}/payments/{id}` |
| `payout.processed` | `/provider/payouts` |
| `verification.decided` | `/provider/verification` |
| `dispute.updated` | `/{role}/disputes/{id}` |
| `subscription.renewal` / `expired` | `/provider/subscription` |

Handle all three states: foreground (in-app banner), background tap, and terminated cold start (initial message). External https deep links (App Links/Universal Links) map to the same routes.

## Security, Tokens, Platform Services
- JWT access + refresh tokens in `flutter_secure_storage` only — never shared prefs, never logged. Dio interceptor attaches access token, serializes refresh on 401 (single-flight), logs out on refresh failure.
- FCM device token registered after login with platform + active role; unregistered on logout.
- Maps: provider coverage areas and provider location display in discovery; district/province pickers backed by the Locations API (never a hardcoded list). ASSUMPTION: Google Maps SDK — placeholder until confirmed.
- Camera/gallery image upload for portfolio images and verification documents: compress client-side (target ≤ ~500 KB, max dimension ~1920px — ASSUMPTION placeholders), upload via pre-signed S3 URLs from the backend, show progress and retry. Verification documents are sensitive: no local caching after upload.

## Localization and Formatting
- Use shared formatting conventions from sri-lanka-localization: LKR as `Rs. 12,500.00`, +94 phone display/input with local `07x` entry normalized to E.164, Asia/Colombo display times from UTC API values.
- i18n via Flutter `intl`/ARB files with en/si/ta keys from day one (si/ta may fall back to en). Fonts must cover Sinhala and Tamil scripts (e.g., Noto Sans Sinhala/Tamil).
- Theme follows marketplace-brand-design-system (Material 3 ColorScheme from brand tokens via ThemeExtension); mobile personality is native-feeling, not a web clone.

## Web Parity Rules
- Same REST API contracts as web — no mobile-only endpoints without updating Swagger and web clients' awareness.
- **No business logic in the app**: pricing, commission, quota, and state-machine rules live in the backend; the app renders backend-provided states and typed error codes (`QUOTA_EXCEEDED`, `TIER_REQUIRED`, etc.).
- Feature parity for the core flow (enquiry → quotations → comparison → acceptance → booking → payment → review) in both roles; web-only features (admin, advertising management — ASSUMPTION) documented explicitly.

## Assumptions and Open Questions
- ASSUMPTION: Offline-tolerant discovery / online-required transactions split is a placeholder business decision.
- ASSUMPTION: Tab layouts per role, Google Maps as map provider, image compression targets are placeholders pending design/infra decisions.
- ASSUMPTION: Advertising slot purchase is web-only at launch.
- ASSUMPTION: In-app payment uses gateway-hosted webview/SDK flow; native card entry is out (PCI minimization — see marketplace-payments-commissions).
- REQUIRES VERIFICATION: Sri Lankan payment gateway mobile SDK availability and app-store compliance for service payments (Google Play / Apple policies on physical-services payments permit external gateways, but confirm per store policy version).

## Checklist
- [ ] Role toggle is presentation-only; backend RBAC is the security boundary.
- [ ] Per-role ShellRoutes with role-prefixed paths; deep links buffered until auth restore.
- [ ] Feature-first folders mirror backend domains; Freezed DTOs match OpenAPI.
- [ ] Tokens only in flutter_secure_storage; single-flight refresh interceptor.
- [ ] Push handling covers foreground/background/terminated; routing table kept in sync with notifications module.
- [ ] Money-affecting writes online-only with idempotency keys; discovery cached with staleness indicators.
- [ ] Images compressed client-side, uploaded via pre-signed URLs; verification docs not cached.
- [ ] en/si/ta ARB keys exist for every string; Sinhala/Tamil-capable fonts bundled.
- [ ] No business rules implemented client-side; typed backend error codes drive UI.
