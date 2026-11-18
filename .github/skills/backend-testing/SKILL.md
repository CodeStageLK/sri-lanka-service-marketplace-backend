---
description: 'Backend/API testing strategy: test pyramid, unit tests with mocked boundaries, integration tests against a real database (testcontainers), e2e API tests with supertest, test data factories, isolation via transactions or truncation, mocking policy, and CI wiring. Use when writing or structuring unit/integration/e2e tests for services and APIs, setting up test databases, creating fixtures/factories, fixing flaky or interdependent tests, or configuring tests in CI.'
license: MIT
metadata:
    category: backend
    github-path: skills/backend/backend-testing
    github-ref: refs/heads/main
    github-repo: https://github.com/CodeStageLK/engineering-agent-skills
    github-tree-sha: 8a261ec11adff058c8d9a8b3df6c2940354bf9ef
    scope: universal
    version: 1.0.0
name: backend-testing
---
# Backend Testing

## Purpose
Defines a layered testing strategy for backend services: fast unit tests for logic, integration tests against real infrastructure for persistence and wiring, a thin e2e layer for critical flows — with strict isolation, honest mocking boundaries, and CI parity.

## When to Use
- Adding tests for a new service, repository, or endpoint
- Setting up test database infrastructure or factories
- Deciding what to mock vs run for real
- Fixing flaky, slow, or order-dependent tests
- Wiring test stages into CI

## Test Pyramid for APIs
- **Unit (majority, ms-fast)**: pure business logic, services with mocked boundaries, mappers, validators, policies. No network, no DB, no clock/randomness without injection.
- **Integration (substantial middle)**: repository + real database, queue producers/consumers against real broker, module wiring. Verifies SQL, constraints, migrations, serialization.
- **E2E/API (thin top)**: full app over HTTP for critical user flows (auth, core domain happy paths, key failure modes). Expensive — cover journeys, not permutations.
- Push each assertion to the lowest layer that can prove it. Edge cases of a calculation → unit; "does the unique index fire" → integration; "can a user sign up and log in" → e2e.
- Coverage is a smoke signal, not a goal; untested critical paths matter more than a number.

## Unit Testing Services
- Mock only injected boundary dependencies (repositories, HTTP clients, queues, clock, mailer). Construct the unit under test directly or via a DI testing module.
- Assert behavior and outcomes, not implementation choreography. Verify mock *calls* only when the call **is** the contract (e.g., "publishes OrderCreated with this payload").
- One logical behavior per test; name as a spec: `cancelBooking → throws ConflictError when booking already started`.
- Inject time (`clock.now()`) and id generation; never `new Date()`/`Math.random()` inside tested logic, never `sleep` in tests.
- Test error paths as first-class: assert the thrown error *class/code*, not message text.

## Integration Tests with a Real Database
- Run the real engine you ship with (Postgres/MySQL via testcontainers or docker-compose) — never a different engine "because it's easier"; SQLite-for-Postgres hides constraint, type, and transaction bugs.
- Apply real migrations to build schema — not `synchronize`/auto-create — so migrations themselves are tested.
- Start the container once per suite (slow), isolate per test (fast): don't restart containers per test.

```ts
let container: StartedPostgreSqlContainer;
beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16').start();
  await runMigrations(container.getConnectionUri());
}, 60_000);
afterAll(() => container.stop());
```

- Repository tests assert round-trips through real SQL: constraint violations, cascades, JSON columns, pagination queries, transaction behavior.

## E2E API Tests (supertest)
- Boot the app exactly as production does — same global pipes/filters/middleware via a shared app-setup function; divergence means tests validate a different app.
- Test through HTTP only: request in, assert status + body shape + side effects (row exists, job enqueued). Never reach into internals to assert private state.

```ts
const res = await request(app.getHttpServer())
  .post('/bookings')
  .set('Authorization', `Bearer ${token}`)
  .send({ serviceId, slot: '2024-06-01T10:00:00Z' })
  .expect(201);
expect(res.body.data.status).toBe('pending');
```

- Auth: mint real tokens through your login/token endpoint or a test-only signer using the real verification path — don't globally disable auth guards.
- Stub only true externals (third-party HTTP APIs) with nock/msw-style interceptors; DB, cache, and queue stay real.
- Each e2e test is a self-contained scenario creating its own data; cover: happy path, 400 validation, 401/403, 404, and one conflict case per critical resource.

## Test Data Builders / Factories
- One factory per entity with valid defaults and per-test overrides; tests specify **only** the fields relevant to the behavior under test.

```ts
export const buildUser = (overrides: Partial<User> = {}): User => ({
  id: randomUUID(),
  email: `u-${randomUUID()}@test.local`,
  role: 'customer',
  createdAt: new Date('2024-01-01T00:00:00Z'),
  ...overrides,
});
```

- Pair with persistence helpers (`createUser(db, overrides)`) for integration/e2e.
- Unique-constrained fields get randomized defaults so parallel tests never collide.
- No shared mutable fixtures or seed-everything dumps; giant shared seeds create invisible coupling between tests.

## Test Isolation
- Every test runs against a known state and leaves nothing behind. Strategies, in preference order:
  1. **Transaction-per-test**: open a transaction in `beforeEach`, roll back in `afterEach` — fastest; works when the code under test doesn't commit/own transactions itself.
  2. **Truncate between tests**: `TRUNCATE ... RESTART IDENTITY CASCADE` on all tables — robust, slightly slower; required when code manages its own transactions.
  3. **Database/schema per worker**: for parallel runners, each worker gets its own database or schema.
- Tests never depend on execution order; any test runs green alone (`it.only`) and in any shuffle.
- Clear caches/queues between tests too — isolation isn't only the database.

## What to Mock vs Not Mock
- **Mock**: third-party HTTP APIs (payments, SMS, maps), clock, randomness, email/notification senders — anything external, slow, flaky, or billable.
- **Don't mock**: your own database (in integration/e2e), your own modules' internals, the framework, validation pipeline, serializers.
- Never mock the ORM/query builder in "integration" tests — asserting `repo.save` was called proves nothing about SQL correctness.
- Contract rule: every mocked external has at least one test (or recorded contract) verifying your client against its real wire format, so mocks don't drift into fiction.

## CI Integration
- CI runs the same commands developers run locally (`npm test`, `npm run test:integration`) — no CI-only incantations.
- Stage pipeline by speed: lint + unit on every push; integration + e2e on PR (containers via docker-in-CI or service containers); full suite gates merge.
- Tests must be parallel-safe (isolation strategy above); fail the build on any test failure — no retries-until-green for flaky tests; quarantine and fix instead.
- Surface artifacts on failure: structured test report, app logs, container logs. A red CI you can't diagnose gets ignored.

## Common Mistakes
- Mocking the repository in tests meant to verify queries → integration-test against real DB.
- SQLite/in-memory stand-in for the production engine → same engine via containers.
- Shared seed data mutated across tests → per-test factories + truncation/rollback.
- Asserting internal call sequences in unit tests → assert outcomes; calls only when they're the contract.
- `setTimeout`/sleeps to "wait" for async effects → await the actual promise/event or poll with timeout.
- Disabling auth/validation globally in e2e → use real pipeline with test credentials.
- Tests pass alone, fail in suite → hidden shared state; enforce isolation and random order.
- Chasing coverage % with assertion-free tests → every test asserts a behavior.

## Checklist
- [ ] Unit tests cover service logic with only boundary deps mocked; no I/O
- [ ] Integration tests run against the production DB engine with real migrations
- [ ] E2E tests boot the prod-identical app and go through HTTP only
- [ ] Factories with valid defaults + overrides; no shared mutable fixtures
- [ ] Per-test isolation via rollback or truncation; tests pass in any order and in parallel
- [ ] Clock/randomness injected; no sleeps in tests
- [ ] Only true externals stubbed; their mocks backed by a contract check
- [ ] Error paths asserted by error class/code and HTTP status
- [ ] CI runs the same scripts as local, staged by speed, failing on any red test
