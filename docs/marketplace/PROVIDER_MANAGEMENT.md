# Provider Management

Providers use `/api/v1/providers/me` and `/api/v1/providers/me/*` endpoints for profile, business details, categories, services, coverage, availability, documents, and completion metadata. Ownership is derived from the authenticated principal; request bodies cannot select another provider.

Providers cannot change verification or approval fields. Profile review metadata is available to `providers.manage`.

Provider services use the additive `provider_services` relation. Provider coverage accepts district, city, or town locations. Availability is one schedule per day-of-week and uses `Asia/Colombo` by default.
