# Provider Discovery and Matching

Public provider discovery is available at `/api/v1/providers/search`, `/api/v1/providers/service/:serviceId`, `/api/v1/providers/location/:locationId`, and `/api/v1/providers/public/:idOrSlug`.

Only active, non-deleted, approved providers are publicly discoverable. Responses exclude private contact and document fields; public portfolio metadata and normalized provider summaries are returned.

Matching deterministically requires an active account/profile, approved verification, supported service/category, and coverage of the requested location. No arbitrary provider limit or ranking weight is imposed. The matching service is independent from HTTP controllers and creates unique recipient records transactionally.
