# iOS durable workflows

The native backend publishes through `server/workflows/client.ts`. Payload validation, provider error classification, retry policy, stable article/notification run identities and flow-control keys live in `publish.ts`. Thin Next.js routes under `/api/workflows/ios` expose signed Upstash Workflow handlers. The native API and Apple notification endpoint no longer publish Inngest events.

| Endpoint | Responsibility |
| --- | --- |
| `article-annotation` | Generate metadata and annotated chunks, save the article, finish progress, send any existing web-push subscription its completion notification |
| `account-deletion` | Freeze, wait two minutes, persist the ownership manifest, remove files/data/auth, confirm deletion; exhausted failures mark the existing ledger failed |
| `apple-subscription` | Reconcile one Apple environment/transaction chain using the existing versioned entitlement writer |
| `apple-recovery` | Page known chains and the overlapping 48-hour signed notification history, enqueue reconciliation |

All external I/O belongs inside `context.run`; waits use `context.sleep`. AI model instances and configuration are constructed inside generation steps; step output contains strings. Account deletion retains its persisted inventory and idempotent persistence adapter. Apple notifications carry chain identifiers, never signed evidence. Flow control limits requests/steps, not whole-run locks; persistence must remain safe under replay and overlap.

The web's article and notification workflows remain in Inngest. Shared article prompt/chunk helpers live in `server/articles`; native workflow modules do not import Inngest.

## Deployment and cutover

1. Configure the exact deployment's `NEXT_PUBLIC_LEXIMORY_URL`, `QSTASH_URL`, `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY`. The public URL must identify this deployment, including on previews; it is the workflow delivery destination. Signing keys are required for initial calls as well as resumed steps.
2. Drain existing iOS article, deletion and Apple runs in Inngest before deploying removal of their handlers. Retain the old deployment until accepted work has finished. Do not cancel an in-progress deletion. If deployment precedes draining, recover unfinished runs from the retained deployment before retiring it.
3. Deploy the new routes and publishers. Inspect a schedule plan with `pnpm --dir apps/leximory exec node --env-file=.env.local --import tsx scripts/configure-ios-workflows.ts`; supply the target deployment environment. Add `--apply` to upsert its hostname-scoped QStash recovery schedule at minute 17 every hour. Schedule provisioning is separate from application startup and is safe to repeat. Do not schedule previews against production data.
4. Verify signed delivery, retries, DLQ visibility and account-deletion failure callbacks in Upstash. Use `verify:mobile-release` against the deployed revision and designated test account to establish real import/archive completion. Local tests establish code behavior only.
5. Retire the old Inngest Apple recovery schedule after the Upstash schedule is active. Keep the web Inngest integration running.

Workflow 1.2 uses bounded provider deduplication; stable run IDs are not a permanent exactly-once guarantee. Import receipts last seven days, entitlement writes are versioned, and deletion operations remain idempotent. Replaying a failed run must use the existing domain identity and persisted source/manifest. Inspect and resume failed steps through Upstash's DLQ rather than silently accepting unresolved jobs.

The publisher uses the installed SDK's transport with immediate HTTP error propagation and no SDK send retries. Mobile request retries reuse article identity. The installed SDK does not expose a transport cancellation deadline; a stalled enqueue can consume the route budget and a lost response must be replayed with that identity.

References: [scheduling workflows](https://upstash.com/docs/workflow/howto/schedule), [run configuration](https://upstash.com/docs/workflow/howto/configure).
