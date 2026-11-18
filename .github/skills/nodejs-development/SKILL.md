---
name: nodejs-development
description: "Core Node.js runtime discipline: non-blocking event loop usage, async/await error propagation, streams, worker threads vs child processes, ESM/CJS, graceful shutdown, env handling, and package.json hygiene. Use when writing or reviewing Node.js server code, debugging event-loop blocking or unhandled rejections, processing large files/streams, choosing worker threads, or configuring package.json, module format, or npm security."
license: MIT
metadata:
  category: "backend"
  scope: "universal"
  version: "1.0.0"
---

# Node.js Development

## Purpose
Establishes runtime-level rules for correct, resilient Node.js services: keep the event loop free, propagate async errors deliberately, stream large data, offload CPU work, and manage the process lifecycle and dependencies responsibly.

## When to Use
- Writing any Node.js server, CLI, or worker code
- Investigating latency spikes, blocked event loop, or memory growth
- Handling large files, uploads, or data exports
- Deciding between worker threads, child processes, or a queue
- Setting up module format, scripts, engines, or dependency policy

## Event Loop Discipline
- Node handles concurrency on one thread: any synchronous work > ~10ms delays *every* in-flight request.
- Never call sync APIs on request paths: `fs.readFileSync`, `crypto.pbkdf2Sync`, `zlib.gzipSync`, `JSON.parse` on multi-MB strings, `execSync`.
- CPU-heavy work (hashing, image resizing, parsing huge payloads, compression) goes to worker threads or a background job — not inline.
- Beware accidental O(n²) and giant array `sort`/`map` on hot paths; chunk with `setImmediate` only as a stopgap, offload as the fix.
- Monitor with event-loop delay metrics (`perf_hooks.monitorEventLoopDelay`) in production.

## Async/Await & Error Propagation
- `async/await` everywhere; no `.then()` chains mixed with `await`, no callback APIs without `util.promisify`.
- Every `await` either (a) is inside a `try/catch` that handles it meaningfully, or (b) propagates to a caller that does. Never `catch (e) {}`.
- A floating promise is a bug: every promise is awaited, returned, or explicitly handled. Enable `@typescript-eslint/no-floating-promises`.
- `Promise.all` fails fast — use it when any failure invalidates the batch; use `Promise.allSettled` when partial results are acceptable and you inspect each outcome.
- Don't `await` sequentially when operations are independent:

```ts
// Bad: ~2x latency
const user = await getUser(id);
const prefs = await getPrefs(id);
// Good
const [user, prefs] = await Promise.all([getUser(id), getPrefs(id)]);
```

- `try/finally` for cleanup (locks, temp files, connections) so failures don't leak resources.

## Streams for Large Data
- Any payload that can exceed a few MB must be streamed, never buffered whole (`fs.readFile` on user uploads is a memory DoS).
- Always use `pipeline` (not `.pipe()`) so errors propagate and streams are destroyed:

```ts
import { pipeline } from 'node:stream/promises';
await pipeline(
  fs.createReadStream(src),
  zlib.createGzip(),
  fs.createWriteStream(dest),
);
```

- Respect backpressure: when writing manually, honor `write()` returning `false` and wait for `'drain'`.
- For CSV/JSON exports, stream rows from the DB cursor to the response; never materialize full result sets.

## Worker Threads vs Child Processes vs Queues
- **Worker threads**: CPU-bound work sharing memory with the service (hashing, parsing, image ops). Use a pool (e.g., piscina-style) — spawning per task is expensive.
- **Child processes**: running other executables, isolation from crashes, or incompatible native deps. Communicate via stdio/IPC.
- **Background queue**: work that is retryable, slow, or survives restarts (emails, webhooks, reports). Prefer this over in-process workers for anything with delivery guarantees.
- Rule of thumb: I/O-bound → plain async; CPU-bound + must respond now → worker thread; deferrable → queue.

## ESM vs CJS
- New projects: ESM (`"type": "module"`) unless a critical dependency forces CJS. Don't mix formats within one package.
- Use the `node:` prefix for builtins (`node:fs`, `node:path`).
- In ESM there is no `__dirname`; use `import.meta.url` + `fileURLToPath`. No conditional `require()` — use dynamic `import()`.
- TypeScript: set `module`/`moduleResolution` to `NodeNext` and write explicit `.js` extensions in relative imports when emitting ESM.
- Library authors: ship explicit `exports` map; never rely on deep-path imports working forever.

## Process Lifecycle
- Graceful shutdown is mandatory: on `SIGTERM`/`SIGINT`, stop accepting connections, finish in-flight requests (with a deadline, e.g. 10s), close DB pools/queues, then exit 0.

```ts
process.on('SIGTERM', async () => {
  server.close();                 // stop new connections
  await drainInflight({ timeoutMs: 10_000 });
  await db.end();
  process.exit(0);
});
```

- `process.on('unhandledRejection')` and `uncaughtException`: log with full context, then exit (let the orchestrator restart). Never "log and continue" — state is undefined.
- Exit non-zero on failed startup (bad config, unreachable DB). Fail fast beats half-alive.
- Expose health endpoints: liveness (process up) vs readiness (deps reachable) — keep them distinct.

## Env & Config
- Read `process.env` in exactly one config module; validate at startup (zod/envalid) and export a typed, frozen config object.
- All env values are strings — parse numbers/booleans explicitly (`PORT`, `FEATURE_X === 'true'`).
- No secrets committed; `.env` is for local dev only and is gitignored, with a committed `.env.example`.

## package.json & Dependency Hygiene
- Set `"engines": { "node": ">=20" }` (or your floor) and enforce with `.nvmrc`/CI.
- Commit the lockfile; CI installs with `npm ci` (never `npm install`).
- Pin exact versions for apps (or use lockfile + automated update PRs); review transitive-heavy additions skeptically — every dep is attack surface.
- Run `npm audit --omit=dev` in CI; fail on high/critical. Prefer upgrading over `audit fix --force`.
- `dependencies` = needed at runtime; everything else is `devDependencies`. No unused deps (verify with depcheck/knip).
- Standard scripts: `build`, `start`, `dev`, `test`, `lint` — CI runs the same scripts developers do.

## Common Mistakes
- Sync crypto/fs/zlib on request path → use async versions or worker threads.
- Fire-and-forget promise for "background" work → lost errors and silent failures; await it or enqueue a real job.
- `.pipe()` chains without error handling → leaked fds on error; use `stream.pipeline`.
- Catching an error just to `console.log` and rethrow-less continue → propagate or handle; add context when rethrowing (`new Error('ctx', { cause: e })`).
- Swallowing `unhandledRejection` to keep the process alive → crash and restart instead.
- Spawning a worker thread per request → use a fixed-size pool.
- Parsing env vars at call sites all over the codebase → single validated config module.
- `npm install` in CI → nondeterministic builds; use `npm ci`.

## Checklist
- [ ] No synchronous I/O, crypto, or compression on request paths
- [ ] No floating promises; lint rule enforced
- [ ] Independent awaits parallelized with `Promise.all`
- [ ] Large payloads streamed via `pipeline` with backpressure respected
- [ ] CPU-bound work offloaded to a worker pool or queue
- [ ] Single module format (ESM preferred); `node:` prefix for builtins
- [ ] SIGTERM handler drains requests and closes resources with a deadline
- [ ] `unhandledRejection`/`uncaughtException` log then exit
- [ ] Env validated at startup into one typed config object
- [ ] Lockfile committed, `npm ci` in CI, `npm audit` gating, engines pinned
