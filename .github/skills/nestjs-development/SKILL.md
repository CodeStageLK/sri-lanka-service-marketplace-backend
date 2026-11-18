---
description: 'Opinionated NestJS architecture rules: modules, dependency injection, DTO validation, the guard/interceptor/pipe/filter pipeline, config validation, Swagger, and testing. Use when creating or modifying NestJS modules, controllers, providers, DTOs, guards, interceptors, exception filters, or writing tests with Test.createTestingModule.'
license: MIT
metadata:
    category: backend
    github-path: skills/backend/nestjs-development
    github-ref: refs/heads/main
    github-repo: https://github.com/CodeStageLK/engineering-agent-skills
    github-tree-sha: 4d0aacfd3b7c7ada4aed222beaefcab9de92b17c
    scope: universal
    version: 1.0.0
name: nestjs-development
---
# NestJS Development

## Purpose
Defines structural and behavioral conventions for NestJS applications so every module, provider, and controller follows the same predictable shape: feature-scoped modules, constructor injection, validated DTOs, and a well-understood request pipeline.

## When to Use
- Scaffolding a new NestJS feature module, controller, or service
- Adding request validation, guards, interceptors, or exception filters
- Wiring configuration, environment validation, or Swagger docs
- Writing unit or integration tests for NestJS providers/controllers

## Module & Provider Architecture
- One module per feature/domain (`UsersModule`, `OrdersModule`), not per technical layer. Never one giant `AppModule` with everything.
- A module `exports` only what other modules need — usually the service, never the repository.
- Import modules, not providers. If `OrdersService` needs `UsersService`, `OrdersModule` imports `UsersModule`.
- Keep controllers thin: parse/validate input, call one service method, return. No business logic, no direct DB access in controllers.
- Use `@Injectable()` services for business logic; isolate persistence behind a repository/provider so it can be swapped in tests.
- Avoid circular module imports. If two modules need each other, extract the shared piece into a third module or use `forwardRef` only as a last resort (and document why).
- Prefer constructor injection with `private readonly`. Avoid `@Inject()` property injection except for tokens/dynamic providers.
- Use custom provider tokens (`{ provide: PAYMENT_GATEWAY, useClass: ... }`) for anything with multiple implementations or external I/O.

## DTOs & Validation
- Every mutating endpoint takes a class-based DTO decorated with class-validator. Never accept `any` or raw `@Body()` without a type.
- Register a global `ValidationPipe` once, with strict settings:

```ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,            // strip unknown fields
  forbidNonWhitelisted: true, // reject unknown fields
  transform: true,            // coerce to DTO instance/types
  transformOptions: { enableImplicitConversion: false },
}));
```

- Use `@Type(() => Number)` / explicit transforms for query params; never rely on implicit conversion for booleans.
- Derive update DTOs with `PartialType(CreateUserDto)` from `@nestjs/mapped-types` (or `@nestjs/swagger` to keep docs).
- Response shapes are separate classes (or `ClassSerializerInterceptor` + `@Exclude`/`@Expose`); never return entities with secrets/hashes.

## Request Pipeline Order
Know the execution order — it determines where logic belongs:
1. **Middleware** (raw req, no DI context per-route) — logging, correlation IDs
2. **Guards** — authn/authz; return `false` or throw → request stops here
3. **Interceptors (pre)** — timing start, cache lookup
4. **Pipes** — validation/transformation of params/body
5. **Handler** (controller method)
6. **Interceptors (post)** — map response, timing end
7. **Exception filters** — only on thrown errors, innermost-scoped filter wins

Rules:
- Authorization belongs in guards, not in services (services may re-check invariants, but HTTP gating is a guard concern).
- Response mapping/envelopes belong in interceptors, not controllers.
- Never validate in guards; never authorize in pipes.

## Configuration
- Use `@nestjs/config` with `isGlobal: true` and a validation schema; the app must crash at boot on invalid env, not at first use:

```ts
ConfigModule.forRoot({
  isGlobal: true,
  validationSchema: Joi.object({
    NODE_ENV: Joi.string().valid('development', 'test', 'production').required(),
    DATABASE_URL: Joi.string().uri().required(),
    JWT_SECRET: Joi.string().min(32).required(),
  }),
});
```

- Access config only via `ConfigService` (or typed namespaced `registerAs` configs) — never `process.env` inside providers.
- No secrets in code or defaults; defaults only for genuinely optional values.

## Exception Handling
- Throw Nest HTTP exceptions (`NotFoundException`, `ConflictException`) from controllers/services at the HTTP boundary, or domain errors mapped by a global filter.
- One global exception filter (`APP_FILTER`) producing a consistent error body: `statusCode`, `message`, `error`, correlation id. Log stack traces server-side; never return them to clients.
- Unknown/unexpected errors → generic 500 message. Never leak ORM errors, SQL, or internal messages.

## Swagger / OpenAPI
- Decorate every controller with `@ApiTags`, every endpoint with `@ApiOperation` + `@ApiResponse` for each status it can return.
- Use `@ApiProperty({ example, description })` on DTO fields; enable the Swagger CLI plugin to reduce boilerplate where available.
- Protected endpoints get `@ApiBearerAuth()` matching the security scheme registered in `DocumentBuilder`.
- Treat the generated OpenAPI doc as the contract — review its diff in PRs.

## Testing
- Unit-test services with `Test.createTestingModule`, overriding I/O providers with mocks:

```ts
const module = await Test.createTestingModule({
  providers: [
    UsersService,
    { provide: UsersRepository, useValue: { findById: jest.fn() } },
  ],
}).compile();
const service = module.get(UsersService);
```

- Mock only boundaries (repositories, HTTP clients, queues) — never mock the class under test.
- E2E tests: create the full app with `createNestApplication()`, apply the same global pipes/filters as `main.ts` (extract a shared `configureApp(app)` helper so prod and tests can't drift), and hit routes with supertest.
- Use `overrideProvider`/`overrideGuard` for test doubles in e2e; don't disable validation to make tests pass.

## Common Mistakes
- Business logic in controllers → move to services; controller only orchestrates.
- Injecting `Request` into services (making them request-scoped accidentally) → pass needed values as method arguments.
- `forbidNonWhitelisted` omitted → unknown fields silently accepted; enable it.
- Returning TypeORM/Prisma entities directly → leaks columns like `passwordHash`; map to response DTOs.
- Providers reading `process.env` directly → breaks testability and boot-time validation; inject `ConfigService`.
- Circular `forwardRef` sprawl → restructure modules; extract shared module.
- Global pipes configured in `main.ts` but not in e2e tests → tests pass, prod fails; share an app-setup function.
- Guards doing data validation → validation is a pipe's job.

## Checklist
- [ ] Each feature has its own module; exports are minimal and intentional
- [ ] Controllers contain no business logic or direct persistence calls
- [ ] Global `ValidationPipe` with `whitelist`, `forbidNonWhitelisted`, `transform` enabled
- [ ] All mutating endpoints use class-validator DTOs; responses use mapped DTOs
- [ ] Env vars validated at boot via a config schema; no raw `process.env` in providers
- [ ] Global exception filter returns a consistent, non-leaking error shape
- [ ] Every endpoint has Swagger decorators for operation and responses
- [ ] Services unit-tested with mocked boundary providers; e2e tests reuse prod app setup
- [ ] No circular imports without a documented `forwardRef` justification
