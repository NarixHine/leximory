# Article import and mutation recovery

An annotated import succeeds when its source text is saved and the annotation job is accepted. Generation completes later. Annotation acceptance must not be confused with the finished generated article.

## Confirmed shared failures

A connection error in `BearerMiddleware` marked the entire account's `LocalReadingStore` offline unless the endpoint appeared in a hardcoded allowlist. Imports and archive mutations were absent from that list. The next retry therefore failed in `requireOnline()` before it reached the transport. Earlier retry tests omitted the account store and could not catch this.

The regression `aConnectionFailureCannotDisableAccountRequests` failed before the fix for article import, library archive, and a subsequent account read. It now passes with the real account store attached. Explicit offline mode still blocks requests. Network-path observation now owns connectivity; server/request failures do not change account connectivity.

The backend also rejected saved, accepted imports when optional progress or receipt work failed. The new regression initially returned 503 instead of 200 for both. Optional effects now use a shared boundary. Receipt and cache work run after the response with bounded recovery; progress writes cannot stop job submission. Required database, quota, and queue-acceptance failures continue to reject the operation.

All mobile mutation adapters use this cache invalidation boundary. The real Next.js runtime test invokes it from an authenticated archive route and checks that deferred invalidation succeeds. `check:mobile-boundaries` prevents direct cache mutation imports outside the shared helper and account-connectivity mutation in the client middleware. Both type checks and the mobile suite run this guard.

## Import identity and diagnostics

Import requests carry a stable request ID. The saved identity includes the account, folder, request ID, and canonical import fields. A replay returns existing stored text instead of overwriting it. Quota and annotation jobs use stable identities, and saved source text survives a failed acknowledgement.

Receipt bookkeeping is an optimization, not proof of generation completion. Receipts last seven days. Inngest event IDs suppress duplicate starts within its [24-hour deduplication window](https://www.inngest.com/docs/durable-execution/guides-and-advanced/idempotency). This is bounded recovery, not a permanent exactly-once guarantee.

Required dependency failures retain their cause and named step for server logs, along with the response's request ID. Logs omit request content, credentials, and raw database/provider messages.

## Read-only runtime census

`apps/leximory/scripts/diagnose-mobile-backend.ts` reads the bundled preview origin and checks unauthenticated HTTP behavior, Inngest function/key presence, database schema metadata, and Redis PING. It never signs in, reads account rows, writes data, or sends jobs. Load the app's environment file before running the script.

The October 30, 2026 census found the preview reachable, five annotation/billing/notification functions configured in cloud mode, the expected tables present, and Redis responding. These health checks do not establish the outcome or triggering error of the user's particular authenticated import.

That read-only census changed no database schema or account data. Native checks compile and test fixture transports without installing or launching the app on a user's device.

Those earlier checks passed 280 mobile backend tests and 106 Swift Core tests, but did not exercise the production import composition through the real queue SDK. Those counts did not establish that the deployed import worked.

## Queue acceptance incident and verification changes

The subsequent iPhone request failed with HTTP 503 at `annotation.enqueue`. Its log contained only `Error`, with no upstream status or code. That identifies the failing dependency, but does not establish whether the provider rejected credentials, environment, payload, or availability.

Queue construction now uses validated, explicit configuration. Hosted deployments reject development queues. Provider requests have a five-second deadline per SDK attempt, bounded within the import route's sixty-second budget. All external producers use the shared publisher, which validates the article event and the provider acknowledgement. It converts the installed SDK's failures into safe service/status/code diagnostics and a retry policy. Authentication, payload and environment rejections are not transient. Timeouts remain retryable. Raw provider messages, keys, and article content are not included in request diagnostics.

`tests/mobile-next-runtime.test.ts` now builds a temporary Next.js app and starts its production server, invoking the actual article and archive routes, production bearer verification, stores, quota adapter, and installed Supabase/Redis/Inngest SDKs. Only external HTTP services are replaced. It checks archive persistence from an absent profile, null archive preferences, conditional writes, replay identity, event/environment delivery, and queue rejection. A provider 401 initially produced `retryable: true`; that regression now requires `false` and an actionable, credential-free diagnostic. This is a reproduced defect, not evidence that the user's particular request received a provider 401.

The build runs this production-route check before `next build`. The strict production check exposed an invalid optional context in the shared route-handler signature that the separate type checker had accepted. The wrapper now matches Next's required handler context while still normalizing absent static params at runtime. The application no longer sets `ignoreBuildErrors`; the full framework build validation must pass.

`check:mobile-boundaries` also scans server actions, server modules and App Router files for queue-client construction and direct publish bypasses. A negative control confirmed that it rejects an aliased `inngest.send` call. Native CI now includes the queue implementation, all shared packages, service actions, Next configuration and test scripts in its path triggers.

## Deployed release verification

The first authorized isolated-account run exposed a separate account lifecycle defect. Auth sign-in and account reads returned 200, but creating the private test folder returned 503. Reading only the new fixture's deterministic IDs confirmed that neither its database profile nor its folder existed. The same request against the production build retained PostgreSQL code `23503`: the folder owner referenced an absent account profile.

The authenticated API composition now runs the shared `ensureUserExists` operation after bearer verification and before feature operations. Its insert ignores existing IDs, preserving balances, plans and preferences. Initialization is bounded by the request deadline and failures retain the `account.initialize` step. The runtime fixture now enforces the owner/profile foreign key, creates the first folder through the actual route, checks replay and welcome-word uniqueness, preserves an existing balance, and rejects downstream writes when initialization fails. The rebuilt backend then created the same real isolated folder successfully through this path. This validates the account bootstrap fix against the actual database, without modifying its schema.

`pnpm --dir apps/leximory run verify:mobile-release` is a separate, required proof of the configured deployment. Missing configuration exits with status 1 and `not_verified`; it never skips a missing integration and reports success. A unit-test result is not a deployed release result.

The command signs into an isolated account marked `app_metadata.backend_e2e: true`, verifies the expected account and dedicated English folder, and checks `X-Leximory-Revision` against `BACKEND_E2E_EXPECTED_REVISION` on every API response. It then:

1. Imports a uniquely marked article through the public API with annotation enabled.
2. Replays the same request and requires the same saved article ID.
3. Waits for the deployed worker to finish, requiring generated definitions, topics and emoji.
4. Requires exactly one annotation quota charge across the import and replay.
5. Archives the test folder and checks the catalog reflects the write.
6. Removes only this run's articles and restores the original archive state. It also discovers a saved article when a failed import never returned its ID. Unconfirmed cleanup fails verification.

The final `verified` result includes the tested origin, revision and completed checks. Queue acceptance without generation completion cannot pass. A changed deployment, failed cleanup, duplicate charge or unpersisted archive cannot pass.

The workflow `.github/workflows/mobile-release.yml` runs this command after successful preview deployments or manual dispatch. It executes verification code from the trusted default branch and checks the deployed revision named by the event. Its `mobile-preview` environment must have the listed `BACKEND_E2E_*` settings. Use a protected, fixed API origin; credentials must never target an arbitrary URL supplied by deployment metadata. Configure this job as a required deployment check. A workflow file alone does not configure repository protection or provision its credentials.

Fixture provisioning is explicit and separate:

```sh
# Read-only plan, no account or database writes:
pnpm --dir apps/leximory run prepare:mobile-release
# Only after the human authorizes isolated Supabase fixture creation:
pnpm --dir apps/leximory run prepare:mobile-release --apply
# Recover an interrupted attempt using the same account and folder identity:
pnpm --dir apps/leximory run prepare:mobile-release --resume
```

Provisioning reads the bundled connection, checks it matches the local Supabase target, creates one designated auth user and one private English folder, and writes credentials to the ignored `apps/leximory/.env.backend-e2e.local` with mode 0600. It persists recovery credentials before the first remote write and refuses to overwrite an existing file. If creation fails or loses its acknowledgement, it retains credentials and the folder request ID for recovery. It does not change the database schema or personal accounts.

After deploying the revision under test, load that ignored file and set the expected full commit SHA:

```sh
cd apps/leximory
BACKEND_E2E_EXPECTED_REVISION=<full-deployed-commit-sha> node --env-file=.env.backend-e2e.local --import tsx scripts/verify-mobile-release.ts
```

Until this deployed command actually returns `verified`, the production incident remains unverified regardless of local test counts. The gate covers article import and folder archiving; it does not establish correctness of unrelated features or guarantee continued availability of external services after the run.
