---
name: backend-validation
description: "Input validation rules for backend services: validate at the boundary, DTO schemas with class-validator or zod, stripping unknown fields, sanitization vs validation, type coercion, business-rule vs shape validation layers, consistent error shapes, and upload validation. Use when adding request validation, defining DTOs or zod schemas, handling query param coercion, validating file uploads, or standardizing validation error responses."
license: MIT
metadata:
  category: "backend"
  scope: "universal"
  version: "1.0.0"
---

# Backend Validation

## Purpose
Establishes a layered validation discipline: every external input is schema-validated at the boundary, unknown fields are stripped or rejected, coercion is explicit, business rules are validated separately from shape, and all failures return one consistent error format.

## When to Use
- Adding or reviewing request body/query/param validation
- Writing DTO classes or zod/class-validator schemas
- Deciding where a rule belongs (shape vs business layer)
- Validating file uploads or webhook payloads
- Standardizing validation error responses

## Validate at the Boundary
- Every entry point validates before any logic runs: HTTP handlers, queue consumers, webhook receivers, CLI args, scheduled-job inputs. Internal layers may then trust typed data.
- "Trusted" sources aren't: validate messages from your own queues and events — producers have bugs and schemas drift.
- Validation failures stop the request with `400`/`422` immediately; never partially process invalid input.
- After validation, pass the **parsed, typed result** onward — never the raw payload:

```ts
const schema = z.object({
  email: z.string().email(),
  age: z.coerce.number().int().min(18),
}).strict();                       // reject unknown keys

const input = schema.parse(req.body); // input is typed; raw body is dead from here
```

## Unknown Fields: Whitelist, Don't Blacklist
- Schemas enumerate allowed fields; everything else is stripped or rejected. Mass-assignment of unexpected fields (`isAdmin: true`, `role`, `balance`) is a classic exploit.
- Prefer **reject** (`forbidNonWhitelisted` / zod `.strict()`) for first-party APIs — client typos surface instantly. Use **strip** (`whitelist` / `.strip()`) for lenient third-party webhook ingestion.
- Never spread a request body into a persistence call (`create({ ...req.body })`) — construct the object field by field from the validated DTO.
- Separate schemas per operation: create vs update vs admin-update. One schema with optional-everything hides which fields each endpoint actually accepts.

## Sanitization vs Validation
- **Validation** answers "is this acceptable?" (reject). **Sanitization** transforms input (trim, normalize). Do both deliberately, sanitization first in the transform pipeline.
- Standard sanitizations: trim strings, lowercase emails, normalize unicode (NFC), collapse internal whitespace where appropriate.
- Do **not** HTML-escape on input. Store clean raw data; escape/encode at output time per context (HTML, SQL via parameterized queries, shell never). Input-time escaping corrupts data and gives false safety.
- Exception: if you accept intentional rich text/HTML, sanitize it with an allowlist-based sanitizer at input *and* treat it as unsafe at render.
- Reject null bytes and absurd lengths early; every string field has a max length — unlimited strings are a DoS vector.

## Type Coercion Rules
- Query params, path params, headers, and form fields arrive as strings. Coerce **explicitly** in the schema (`z.coerce.number()`, `@Type(() => Number)`); never rely on implicit engine coercion.
- Booleans: accept exactly `'true'`/`'false'` (map to boolean); anything else fails. `Boolean('false') === true` is a classic bug.
- Numbers: validate integer-ness and range after coercion; `parseInt` without radix or range checks is not validation.
- Dates: accept ISO 8601 only; parse to a date object in the schema; reject `Invalid Date`.
- Enums: validate against the enum values, case-sensitively, and return allowed values in the error message.
- IDs: validate format (UUID/ULID/numeric) at the boundary so garbage never reaches the database layer.

## Shape Validation vs Business-Rule Validation
Two layers, different homes, different status codes:
- **Shape/syntactic** (boundary, DTO/schema): types, formats, ranges, required fields → `400`. Stateless, no I/O.
- **Business/semantic** (service/domain layer): "email already registered", "slot no longer available", "insufficient balance" → `409`/`422` domain errors. Requires state, belongs with the logic that owns the invariant.
- Never do DB lookups inside DTO validators (hidden I/O, no transaction context, duplicated logic). A unique-email check in a decorator still needs a DB unique constraint anyway — the constraint is the source of truth; the service translates its violation into a friendly error.
- Cross-field shape rules (`endDate > startDate`) are fine in the schema layer (zod `.refine`, class-validator custom validator) — they're stateless.

## Consistent Validation Error Shape
- All validation failures — body, query, params, uploads — return the same structure, listing **every** failed field, machine-readable:

```json
{
  "status": 400,
  "title": "Validation failed",
  "errors": [
    { "field": "email", "code": "invalid_format", "message": "must be a valid email" },
    { "field": "age", "code": "too_small", "message": "must be at least 18" }
  ]
}
```

- Use dot/bracket paths for nested/array fields (`items[2].quantity`).
- Stable `code` per rule type so clients can localize; `message` is a human-readable default.
- Map your validation library's raw error output to this shape in one central place (exception filter/error middleware) — never leak library internals.
- Central mapping example (zod → standard shape):

```ts
function toValidationErrors(err: ZodError) {
  return err.issues.map((i) => ({
    field: i.path.join('.'),
    code: i.code,
    message: i.message,
  }));
}
```

## File & Upload Validation
- Enforce max file size at the parser level (multipart config), before buffering — not after.
- Validate MIME type by **magic bytes/content sniffing**, not the client-supplied `Content-Type` or extension; both are attacker-controlled.
- Allowlist extensions and types; generate server-side storage names (UUID) — never trust the original filename (path traversal `../../`).
- Images: re-encode/resize with an image library to strip embedded payloads and EXIF; validate dimensions.
- Limit file count per request; validate each file; store outside the web root / in object storage, never executable paths.

## Common Mistakes
- Validating only the body, not query/params/headers → validate every input channel.
- `create({ ...req.body })` → mass assignment; build from validated DTO fields.
- Stripping unknown fields silently on first-party APIs → reject so typos surface.
- HTML-escaping on input → corrupts data; escape at output, parameterize queries.
- DB-lookup validators in the DTO layer → move to service layer; back with DB constraints.
- `Boolean(req.query.flag)` → `'false'` becomes true; exact-string boolean coercion.
- Trusting upload `Content-Type` header → sniff magic bytes; allowlist.
- First-error-only validation responses → aggregate all field errors in one response.
- No max length on strings → DoS and index bloat; cap every string.

## Checklist
- [ ] Every entry point (HTTP, queue, webhook, cron) validates before logic
- [ ] Schemas whitelist fields; unknown fields rejected (or documented strip for webhooks)
- [ ] Handlers use parsed/typed output only; raw payload never passed onward
- [ ] All string/number fields have explicit length/range bounds
- [ ] Coercion explicit for query/path params; booleans exact-match
- [ ] Shape rules in DTO layer (400); stateful business rules in services (409/422)
- [ ] No I/O inside schema validators; uniqueness backed by DB constraints
- [ ] Single error shape with per-field path, code, and message, mapped centrally
- [ ] Uploads: size capped pre-buffer, magic-byte type check, server-generated filenames
- [ ] Output encoding (not input escaping) used for XSS/injection defense
