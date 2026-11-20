# Category and Service Management

Public endpoints:
- `GET /api/v1/categories`
- `GET /api/v1/categories/:idOrSlug`
- `GET /api/v1/services`
- `GET /api/v1/services/:idOrSlug`

Administrator endpoints require `categories.manage` or `services.manage`:
- `POST/PATCH /api/v1/admin/categories`
- `PATCH /api/v1/admin/categories/:id/status`
- `POST/PATCH /api/v1/admin/services`
- `PATCH /api/v1/admin/services/:id/status`

Categories support parent/child relationships and ordering. Services remain dependent on an active category and prefer deactivation over deletion.
