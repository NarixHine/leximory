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

No database schema or live account data was changed. Native checks compile and test fixture transports without installing or launching the app on a user's device.

The final checks passed 280 mobile backend tests, including the real Next.js runtime test, 106 Swift Core tests, type checks, contract/route checks, and the Simulator build. A negative control confirmed that the boundary checker rejects an aliased direct cache mutation. The exact production request remains unmatched because the existing browser session did not permit computer-use access to Vercel's runtime logs.
