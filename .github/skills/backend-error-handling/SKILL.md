---
description: 'Backend error-handling architecture: operational vs programmer error taxonomy, typed domain error classes, global exception handling, domain-to-HTTP mapping, safe client responses, correlation-ID logging, retries and circuit breakers, and async pitfalls. Use when designing error classes, adding a global exception handler, mapping errors to status codes, handling downstream/third-party call failures, adding retries or circuit breakers, or fixing unhandled rejections and swallowed errors.'
license: MIT
metadata:
    category: backend
    github-path: skills/backend/backend-error-handling
    github-ref: refs/heads/main
    github-repo: https://github.com/CodeStageLK/engineering-agent-skills
    github-tree-sha: 9354122edeee70e58d31fbcce2487fb530d74302
    scope: universal
    version: 1.0.0
name: backend-error-handling
---
# Backend Error Handling

## Purpose
Defines a single error-handling architecture: classify errors, raise typed domain errors from business logic, translate them to HTTP in one global handler, log with correlation context, never leak internals, and make downstream failures survivable with retries and circuit breakers.

## When to Use
- Creating or refactoring error classes and error flows
- Implementing a global exception filter/error middleware
- Deciding which HTTP status a domain failure maps to
- Calling databases, queues, or third-party APIs that can fail
- Debugging unhandled rejections, swallowed errors, or missing error context

## Error Taxonomy
- **Operational errors** — expected runtime failures: invalid input, not found, conflict, timeout, downstream 503, rate limit. Handle them: map to responses, retry, or degrade. The process keeps running.
- **Programmer errors** — bugs: undefined property access, type confusion, broken invariants, assertion failures. Do **not** "handle" these into a response-and-continue; log loudly, return generic 500, and for process-corrupting cases (uncaughtException) crash and restart.
- Classify at throw time, not catch time: domain code throws typed operational errors; anything untyped reaching the global handler is treated as a programmer error (500 + alert).

## Typed Domain Error Classes
- One abstract base with a stable machine-readable `code`; concrete classes per failure category. No `throw new Error('user not found')` in business logic — string matching on messages is forbidden.

```ts
export abstract class DomainError extends Error {
  abstract readonly code: string;           // stable, documented
  constructor(message: string, readonly meta?: Record<string, unknown>, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}
export class NotFoundError extends DomainError { readonly code = 'NOT_FOUND'; }
export class ConflictError extends DomainError { readonly code = 'CONFLICT'; }
export class ForbiddenError extends DomainError { readonly code = 'FORBIDDEN'; }
```

- Domain errors carry context in `meta` (ids, limits), not interpolated into the message only.
- Domain layer throws domain errors — never HTTP exceptions. HTTP concepts stay at the transport layer so the same services work from jobs, events, and CLIs.
- Wrap low-level errors with context using `cause`: `throw new PaymentFailedError('charge declined', { orderId }, { cause: err })` — preserves the original stack.

## Global Exception Handling
- Exactly one global handler (exception filter / error middleware) at the edge of each transport (HTTP, queue consumer, cron runner). Handlers/services don't build error responses themselves.
- The global handler: (1) maps known domain errors to status + safe body, (2) maps framework errors (validation, 404 route), (3) treats everything else as 500, logs full details, returns generic message, triggers alerting.
- Express-style: async route errors must reach the handler — use a framework/version that forwards rejected promises or wrap handlers; a rejected promise that never hits the error middleware hangs the request.
- Queue/job consumers: the "response" is ack/nack — map operational errors to retry-or-DLQ decisions in one place, same taxonomy.

## Mapping Domain Errors to HTTP
- Single declarative map, not scattered `instanceof` chains in controllers:
  - `ValidationError` → 400, `AuthenticationError` → 401, `ForbiddenError` → 403, `NotFoundError` → 404, `ConflictError`/optimistic-lock → 409, `RateLimitError` → 429, `DownstreamUnavailableError` → 502/503, unknown → 500.
- Response body is your standard error shape (see rest-api-design): stable `code`/`type`, human `message`, `traceId`. Same shape for 4xx and 5xx.
- 4xx messages can be specific (the client can act); 5xx messages are always generic ("An unexpected error occurred", plus traceId).

## Never Leak Internals
- Never return to clients: stack traces, SQL/ORM errors, file paths, dependency exception messages, internal class names, infrastructure hostnames.
- Sanitize in the global handler by default — the safe path must be the default path, not opt-in per endpoint.
- Environment-gated verbosity (full error bodies in dev) must default to the safe mode; production verbosity requires explicit opt-in and should not exist.
- Watch indirect leaks: timing differences, distinct error codes for "wrong password" vs "no such user", 403-vs-404 revealing resource existence.

## Logging with Context & Correlation IDs
- Assign/propagate a correlation id per request (accept inbound header or generate; return it in responses and the error body's `traceId`). Use AsyncLocalStorage (or framework context) so all logs in a request carry it automatically.
- Log errors once, at the global handler — not at every layer (triple-logging the same error buries signal). Inner layers add context via `cause`/wrapping, not logging.
- Error logs are structured (JSON): `code`, `message`, stack, correlation id, user/tenant id, route, relevant entity ids. Never log secrets, tokens, passwords, or full request bodies.
- Severity: 5xx/programmer errors → `error` (alerting); expected 4xx → `warn`/`info` (a spike in 404s is a metric, not a page).

## Retries & Circuit Breakers for Downstream Calls
- Every outbound call has an explicit **timeout** (connect + overall). No timeout = eventual thread-pool/connection exhaustion.
- Retry only **transient** failures (timeouts, 502/503/429, connection reset) — never 400/401/403/404/409. Use exponential backoff with jitter, small cap (2–3 attempts), and a total-time budget below your own request deadline.
- Retry only **idempotent** operations, or make them idempotent first (idempotency keys). Retrying a non-idempotent charge is how double-billing happens.
- Circuit breaker on each downstream dependency: open after failure-rate threshold, fail fast while open, half-open probes to recover. Failing fast protects your event loop and the struggling dependency.
- Define a fallback per dependency: cached data, degraded response, or clean 503 with `Retry-After` — decided at design time, not during the incident.
- Minimal correct retry helper shape:

```ts
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i >= attempts || !isTransient(err)) throw err;
      const base = 200 * 2 ** (i - 1);
      await sleep(base / 2 + Math.random() * base);   // jittered backoff
    }
  }
}
```

## Async Error Pitfalls
- Fire-and-forget promises lose errors: every promise is awaited, returned, or given an explicit `.catch` that handles it. Enforce `no-floating-promises`.
- `forEach(async ...)` ignores rejections — use `for...of` with await, or `await Promise.all(items.map(...))`.
- `Promise.all` rejects on first failure but other promises keep running; use `allSettled` when you must observe every outcome (e.g., cleanup).
- `try/catch` does not catch errors thrown in a `setTimeout`/event-emitter callback inside it — attach handlers where the async boundary is.
- Always re-throw or return after handling; a `catch` that logs and falls through to "success" code corrupts state silently.
- EventEmitters: an `'error'` event with no listener crashes the process — always attach `'error'` handlers on streams/emitters.

## Common Mistakes
- `catch (e) { console.log(e) }` then continuing as if succeeded → handle meaningfully or rethrow with `cause`.
- Throwing HTTP exceptions from domain services → throw domain errors; map at the edge.
- String-matching `e.message` to branch → branch on class/`code`.
- Same error logged at 4 layers → log once at the boundary; wrap with context below.
- Retrying everything including 4xx → retry only transient + idempotent.
- No outbound timeouts → every client call gets explicit timeouts.
- Stack traces in production responses → generic 500 body + traceId; details in logs.
- Catching `uncaughtException` to keep serving → log, flush, exit; let the orchestrator restart.

## Checklist
- [ ] Domain errors are typed classes with stable codes; no message string matching
- [ ] Domain layer throws domain errors only; HTTP mapping lives in one global handler
- [ ] Declarative domain→HTTP map; unknown errors → generic 500 + alert
- [ ] Error responses share one shape with `code` and `traceId`; no internals leaked
- [ ] Correlation id propagated via async context; present in every error log
- [ ] Errors logged once, structured, with entity context; no secrets in logs
- [ ] All outbound calls: timeout + bounded jittered retries (transient+idempotent only)
- [ ] Circuit breaker and planned fallback per downstream dependency
- [ ] No floating promises; `'error'` listeners on all streams/emitters
- [ ] Process exits on uncaught exceptions/unhandled rejections after logging
