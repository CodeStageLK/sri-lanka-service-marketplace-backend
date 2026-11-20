# Marketplace Architecture

Phase 5 uses the existing modular NestJS monolith and Prisma/Neon PostgreSQL foundation. It adds catalog, location, provider, request, matching, and enquiry modules without changing the Phase 4 authentication model.

Authorization is enforced by global JWT, role, permission, and provider-verification guards. Resource ownership is enforced again in marketplace services using `AuthPrincipal`.

The existing schema is reused. Two additive relations were added for provider-service assignments and request-service selections; they require migration `20261121000000_phase5_marketplace_services` before database-backed API tests can run.
