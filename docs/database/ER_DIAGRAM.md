# SERV HUB Entity Relationship Diagram

The diagram shows the core marketplace flow and the most important supporting
relationships. Each join table and supporting domain is represented in the
Prisma schema even where it is omitted here for readability.

```mermaid
erDiagram
    USERS ||--o| CUSTOMER_PROFILES : has
    USERS ||--o| PROVIDER_PROFILES : has
    USERS }o--o{ ROLES : via_user_roles
    ROLES }o--o{ PERMISSIONS : via_role_permissions
    CUSTOMER_PROFILES ||--o{ CUSTOMER_ADDRESSES : keeps
    LOCATIONS ||--o{ CUSTOMER_ADDRESSES : identifies

    PROVIDER_PROFILES ||--o{ PROVIDER_CATEGORIES : offers
    CATEGORIES ||--o{ PROVIDER_CATEGORIES : classifies
    PROVIDER_PROFILES ||--o{ PROVIDER_SERVICE_AREAS : serves
    LOCATIONS ||--o{ PROVIDER_SERVICE_AREAS : covers
    CATEGORIES ||--o{ SERVICES : contains
    CATEGORIES ||--o{ CATEGORIES : parent_of

    CUSTOMER_PROFILES ||--o{ SERVICE_REQUESTS : creates
    SERVICE_REQUESTS ||--o{ SERVICE_REQUEST_CATEGORIES : needs
    CATEGORIES ||--o{ SERVICE_REQUEST_CATEGORIES : classifies
    SERVICE_REQUESTS ||--o{ SERVICE_REQUEST_RECIPIENTS : sent_to
    PROVIDER_PROFILES ||--o{ SERVICE_REQUEST_RECIPIENTS : receives
    SERVICE_REQUESTS ||--o{ QUOTATIONS : receives
    PROVIDER_PROFILES ||--o{ QUOTATIONS : submits
    QUOTATIONS ||--o{ QUOTATION_ITEMS : itemizes

    SERVICE_REQUESTS ||--o| BOOKINGS : fulfills
    QUOTATIONS ||--o| BOOKINGS : accepted_as
    BOOKINGS ||--o| REVIEWS : may_receive
    REVIEWS ||--o| REVIEW_RESPONSES : may_have

    PROVIDER_PROFILES ||--o{ SUBSCRIPTIONS : has
    SUBSCRIPTION_PLANS ||--o{ SUBSCRIPTIONS : defines
    SUBSCRIPTIONS ||--o{ SUBSCRIPTION_TRANSACTIONS : records
    BOOKINGS ||--o{ PAYMENTS : may_be_paid_by
    PAYMENTS ||--o{ REFUNDS : may_be_refunded

    USERS ||--o{ MEDIA_FILES : owns
    USERS ||--o{ NOTIFICATIONS : receives
    BOOKINGS ||--o{ COMPLAINTS : concerns
    BOOKINGS ||--o{ DISPUTES : concerns
```

Locations use one adjacency-list table with a `LocationType` of `PROVINCE`,
`DISTRICT`, `CITY`, or `TOWN`; this keeps the hierarchy extensible without
duplicating geographic attributes. Media rows contain storage keys and
metadata only. File bytes and temporary signed URLs are not stored in Postgres.

