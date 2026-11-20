# Service Request Workflow

Customers create draft requests with `POST /api/v1/service-requests`, read/update/cancel owned requests, and submit them with `POST /api/v1/service-requests/:id/submit`.

Valid states use the existing `ServiceRequestStatus` enum. Only DRAFT requests are editable; DRAFT or OPEN requests may be cancelled. Submission changes DRAFT to OPEN and creates eligible provider recipients transactionally.

Categories, services, locations, addresses, and MediaFile ownership are validated. Attachments reference existing MediaFile IDs owned by the customer rather than arbitrary URLs.
