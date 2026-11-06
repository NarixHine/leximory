# Test iOS subscriptions end to end

Drafted 6 November 2026. This plan covers Leximory's monthly Bilingual and Polyglot subscriptions. It proposes testing work; no Apple configuration, deployment, purchase, device installation, or Supabase operation was performed during research.

Use a development-signed build with Apple's Sandbox first, then repeat the release-critical flows through TestFlight. Local StoreKit tests remain the fast regression check. Sandbox is required to prove Apple-signed evidence, server verification, persistence, notification delivery, and actual account access together. TestFlight also uses Sandbox and does not charge testers. See [Apple's testing environments](https://developer.apple.com/documentation/storekit/testing-at-all-stages-of-development-with-xcode-and-the-sandbox).

## Establish the starting point

Read these implementation files before executing the plan:

- [MembershipStore.swift](../../apps/leximory-ios/App/MembershipStore.swift) purchases with the authenticated account UUID as `appAccountToken`, delivers signed transactions, and calls `finish()` after backend acknowledgement. It listens for updates, scans unfinished transactions every 30 seconds, and supports explicit restoration.
- [apple.ts](../../apps/leximory/server/billing/apple.ts) configures Apple's Server API client and verification. [service.ts](../../apps/leximory/server/billing/service.ts) preserves chain ownership and handles concurrent snapshot writes.
- [notification-endpoint.ts](../../apps/leximory/server/billing/notification-endpoint.ts) publishes accepted notifications to Upstash Workflow. [apple-billing.ts](../../apps/leximory/server/workflows/apple-billing.ts) reconciles chains and recovers missed notifications. Older references to Inngest Apple jobs in [billing-plan.md](billing-plan.md) are historical. Use [upstash-workflows.md](upstash-workflows.md) for current deployment instructions.
- [apple-billing.test.ts](../../apps/leximory/tests/apple-billing.test.ts) covers injected Apple/database behavior, authentication, ownership, replay, freshness, concurrent writes, and invalid signatures. These tests do not establish live Apple credentials or deployed persistence.
- [MembershipTests.swift](../../apps/leximory-ios/Tests/MembershipTests.swift) includes a local `SKTestSession` purchase. It buys Bilingual directly and checks catalog identifiers, the account token, the Xcode environment, and an expiration operation. It does not exercise the complete `MembershipStore` delivery path or prove account expiry.

The `Leximory-StoreKit-Local` scheme deliberately bypasses backend delivery for Xcode transactions. A local success screen is not evidence of paid server access. The October setup report records live configuration as incomplete; recheck App Store Connect and deployment configuration instead of assuming that report describes today's external state.

## 1. Prepare an isolated test deployment

Owner: backend engineer, with the Apple Account Holder for agreements and credentials.

1. Record the app commit, backend commit, deployment URL, build configuration, and target Supabase project. Use production code with dedicated test data and an isolated deployment. Verify the native API URL and auth configuration point to that deployment before purchasing.
2. Confirm the existing `apple_subscriptions` table, server permissions, ownership retention, and conditional writes match the implementation. Do not change the schema. Any proposed Supabase side effect, including a test purchase that writes subscription data, needs explicit authorization under the repository rules before execution.
3. Check the active Apple Developer membership and Paid Applications Agreement. Confirm the app record and signing use `com.leximory.reader`. Apple allows Sandbox testing with a development-signed build before uploading a binary. Configure the required product metadata and prices, then verify StoreKit can fetch them. See [Apple's Sandbox prerequisites](https://developer.apple.com/documentation/storekit/testing-in-app-purchases-with-sandbox).
4. Confirm one subscription group contains `com.leximory.reader.polyglot.monthly` at level 1 and `com.leximory.reader.bilingual.monthly` at level 2. Keep monthly periods and the mapping in `packages/env/src/billing.ts` aligned. Keep Family Sharing, introductory offers, and out-of-app acquisition outside this release's scope.
5. Configure the server-only Apple key, issuer, app ID, group ID, and root certificates listed in [billing-setup.md](billing-setup.md). Validate them with real Sandbox evidence later. Successful environment parsing alone does not prove they work.
6. Configure the V2 Sandbox notification URL as `https://<test-deployment>/api/apple/notifications`. Verify public HTTPS access and signed Upstash delivery to this same deployment, including its recovery schedule and failed-run visibility. Keep the production notification URL pointed at the intended production service.
7. Create dedicated Sandbox Apple Accounts and Leximory test accounts. Keep the Apple account distinct from the Leximory login. Add the Leximory auth UUIDs to `APPLE_SANDBOX_USER_IDS`, including the eventual review account when preparing review.
8. Enable `APPLE_PURCHASES_ENABLED=true` only on the isolated test deployment after preflight succeeds. Leave public checkout disabled until the release gates pass.

The enable flag currently gates checkout globally for its deployment. `APPLE_SANDBOX_USER_IDS` controls acceptance of Sandbox entitlements; it is not a cohort-only checkout switch. If testing must share the public deployment, first design and verify a server-side checkout cohort restriction. Do not enable public checkout as a shortcut to testing.

Prepare separate Leximory accounts for a free purchaser, a second free purchaser, an account outside the Sandbox cohort, and an existing legacy paid member. Keep an ownership test's original Apple account available when switching Leximory logins. Prefer fresh test accounts over deleting subscription-chain records between cases.

Exit criterion: record the deployment and account configuration without exposing keys, tokens, passwords, or signed payloads.

## 2. Run local regression checks

Owner: iOS and backend engineers.

Run the existing checks from the repository root:

```sh
pnpm --dir apps/leximory run check:mobile-routes
pnpm --dir apps/leximory run test:mobile
pnpm --dir apps/leximory run check-types
swift test --package-path apps/leximory-ios/Core
```

Generate the Xcode project with `apps/leximory-ios/scripts/generate-project.sh`. In Xcode, run `LeximoryTests/MembershipTests`, `LeximoryTests/LocalStoreKitTests`, and `LeximoryUITests/MembershipUITests` on an iPhone and iPad Simulator. Retain the test result bundles and failures.

Before relying on local coverage, add focused tests that drive the real membership store through a controllable delivery transport. Prove that a lost response or temporary delivery failure retains an unfinished transaction, a mismatched acknowledgement never finishes it, and account switching cannot deliver to the new user. Extend local product purchases to both plans and assert actual entitlement changes after simulated expiry. Keep Apple and deployed persistence verification in Sandbox.

Use Xcode's StoreKit controls for deterministic pending approval, cancellation, interrupted purchase, and failed-purchase cases. Treat fixture UI tests as presentation checks. Do not substitute fixture results for native StoreKit interaction. See [Apple's local StoreKit guide](https://developer.apple.com/documentation/xcode/setting-up-storekit-testing-in-xcode).

Exit criterion: current checks pass, missing delivery coverage is recorded or implemented, and local transactions remain unable to grant real backend access.

## 3. Prove one Sandbox purchase completely

Owner: iOS tester and backend engineer together.

1. Use a dedicated physical test device with Developer Mode for the development build. Select the ordinary `Leximory` scheme, set StoreKit Configuration to **None**, and remove `LEXIMORY_STOREKIT_LOCAL` and fixture launch arguments. Sign in to the Sandbox Apple Account using Apple's [device setup instructions](https://developer.apple.com/documentation/storekit/testing-in-app-purchases-with-sandbox).
2. Sign in to the free Leximory account. Record its effective plan, consumed AI allowances, and reset deadlines. Confirm both localized StoreKit prices load and match the storefront's products.
3. Buy Bilingual through the native Apple purchase sheet. Confirm the sheet identifies Sandbox. Record the transaction and original transaction identifiers in restricted test evidence.
4. Correlate the authenticated `POST /api/mobile/v1/account/apple-transaction` request with Apple verification and the committed `apple_subscriptions` snapshot. Verify `environment=Sandbox`, the expected product and group, immutable account ownership, and the acknowledged transaction ID.
5. Confirm the app finishes the transaction only after acknowledgement. Relaunch and verify the account remains Bilingual. Inspect the web account's effective plan and exercise an existing server-enforced paid allowance using an approved test request. A changed label alone does not pass.
6. Compare quota usage and reset deadlines with the baseline. The plan raises limits without resetting consumed amounts or changing deadlines. Confirm the legacy `users.plan` source was not overwritten.
7. Observe the corresponding real subscription notification and Upstash reconciliation. Repeat the complete purchase on a fresh account for Polyglot, then repeat purchase and restore on iPad.

Exit criterion: evidence connects the Apple transaction to backend acknowledgement, persisted ownership, native and web access, quota preservation, and real notification reconciliation for both products.

## 4. Test lifecycle, ownership, and recovery

Owner: QA, supported by iOS and backend engineers. For each case, record the action, expected state, actual state, relevant identifiers, and evidence. Mark untested cases explicitly.

- **Cancel or fail checkout.** Cancel Apple's sheet, then separately simulate a failed purchase. Neither creates paid access. Cancellation returns to selection without an error alert. Recoverable failures stay silent during retries; an exhausted user action gets feedback at the affected control.
- **Pending and interrupted checkout.** Prove pending approval locally. In Sandbox, enable interrupted purchases for the tester, complete the required external action, and verify eventual delivery without a second purchase. Do not label an interrupted transaction as proof of every Ask to Buy path. See [Apple's interrupted-purchase test](https://developer.apple.com/documentation/storekit/testing-an-interrupted-purchase).
- **Lose connectivity after Apple succeeds.** Interrupt delivery before acknowledgement, then kill and relaunch the app. Restore connectivity and prove unfinished-transaction recovery grants access once. Separately lose the HTTP response after a successful commit and replay delivery. Quota usage and deadlines remain unchanged.
- **Restore and switch accounts.** Restore on a reinstall or second device with the original Leximory account and Apple account. Try the same restore under a different Leximory account. The second account receives no grant and ownership does not move. Also test an empty restore and a different Apple account.
- **Reject invalid environments and evidence.** Exercise a Sandbox transaction for an account outside the server cohort, plus forged, Xcode-signed, wrong-product, wrong-group, and wrong-bundle evidence in automated boundary tests. No invalid evidence grants access. Keep raw signed evidence out of ordinary logs.
- **Renew with the app closed.** Use the Sandbox tester's accelerated rate, observe a new transaction, notification, workflow completion, and updated access without launching the app. Start with a slower rate if needed to capture each transition reliably. Apple's default Sandbox monthly period is five minutes with up to 12 renewals. Record the configured rate rather than assuming it. See [Sandbox renewal settings](https://developer.apple.com/help/app-store-connect/test-in-app-purchases/manage-sandbox-apple-account-settings/).
- **Cancel renewal and expire.** Disable renewal through subscription management. Retain access through the signed paid deadline, then remove Apple access at expiry even if recovery jobs are paused. Check account refresh and server authorization separately so stale UI cannot conceal continued paid access.
- **Change tiers.** Upgrade Bilingual to Polyglot through subscription management, then test the reverse downgrade. Verify immediate upgrade and next-period downgrade against Apple's current signed status. Keep one subscription chain and preserve usage. Do not infer a new plan from the selected button alone.
- **Enter grace, retry billing, and recover.** Enable grace for Sandbox, buy successfully, then disable **Allow Purchases & Renewals** in Sandbox settings. Verify access through the signed grace deadline and no Apple grant in billing retry after grace. Reenable purchases and verify recovery. Repeat with grace disabled. See [Apple's failing-renewal procedure](https://developer.apple.com/documentation/storekit/testing-failing-subscription-renewals-and-in-app-purchases).
- **Refund and revoke access.** Exercise a supported Sandbox refund flow and verify the resulting signed revocation removes access through notification reconciliation. Verify an old refund cannot replace a newer valid period. Test refund reversal deterministically with injected verified-state fixtures if no supported Sandbox control is available; record that limitation rather than claiming a live reversal passed.
- **Preserve other billing sources.** Confirm a legacy paid account cannot start duplicate checkout. Test the effective-plan resolver with both sources present using approved fixtures. Expiring Apple access preserves any valid legacy grant, and the reverse also holds. Limits never stack and usage never resets.
- **Pause new checkout.** Turn the enable flag off on the test deployment. New purchases stop, while valid unfinished delivery, restoration, renewals, notifications, and recovery continue. Do not disable verification credentials as the checkout kill switch.

Exit criterion: all applicable cases pass, and unsupported live controls have explicit automated coverage and a recorded limitation.

## 5. Prove notification recovery independently

Owner: backend engineer.

1. Call Sandbox **Request a Test Notification**, retain its test token, and inspect **Get Test Notification Status**. Confirm Apple's recorded successful response and the matching endpoint request. These calls test connectivity; they do not prove entitlement delivery. See [Apple's Server API testing endpoints](https://developer.apple.com/documentation/appstoreserverapi).
2. Confirm a `TEST` notification validates and returns success without a subscription workflow. The current verifier returns no chain for `TEST`, so the absence of a workflow is expected.
3. Trigger an actual Sandbox renewal with the app closed. Follow notification verification, durable enqueue, Upstash execution, versioned persistence, and effective access.
4. In the isolated environment, make queue acceptance fail. Confirm the endpoint returns 503. Then restore the queue and run notification-history recovery to retrieve the missed event. Apple sends Sandbox notifications only once, so waiting for an Apple retry cannot prove this case. See [Apple's response and retry rules](https://developer.apple.com/documentation/appstoreservernotifications/responding-to-app-store-server-notifications).
5. Fail an accepted workflow step, then verify Upstash retries or failed-run recovery. Replay duplicate and out-of-order deliveries, including overlapping client delivery and notification reconciliation. Confirm one owned chain and no duplicate quota grants.
6. Miss a first-purchase notification before any chain exists locally, with client delivery also unavailable. Verify history recovery discovers the chain. Separately prove known-chain recovery and inspect the hourly schedule. The implemented scan overlaps 48 hours; plan an explicit backfill for longer outages.

If replay is suppressed by bounded queue deduplication, reconcile the same chain with a new test run identity. Do not count queue suppression alone as proof of persistence idempotency. Keep deliberate failures confined to the test deployment.

Exit criterion: both first-purchase discovery and known-chain recovery converge after a missed Sandbox notification without client assistance.

## 6. Repeat release-critical flows through TestFlight

Owner: release engineer and internal testers.

Upload a signed release candidate after the development Sandbox pass. Confirm the installed build uses the intended API deployment and has no fixture or local StoreKit bypass. Repeat both products' purchase, relaunch, restore, account mismatch, renewal with the app closed, cancellation, and expiry on iPhone and iPad.

TestFlight purchases always use Sandbox. Its default subscription renewal rate is once per day, up to six renewals in a week. To use accelerated Sandbox controls, download the build first, sign out of **Media & Purchases**, then sign in to a Sandbox Apple Account in **Settings → Developer**. Use a dedicated device because signing out affects access to purchased content. See [Apple's TestFlight subscription instructions](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testing-subscriptions-and-in-app-purchases-in-testflight).

Retain two results: a controlled Sandbox-account run for lifecycle failures, and an ordinary internal TestFlight tester run for distribution behavior. Every Leximory account receiving Sandbox access still needs server cohort membership.

## 7. Record results and decide whether to release

Create a results file alongside this plan during execution. Record one result per scenario with its app/backend revisions, build number, device and OS, storefront, test-account alias, configured renewal rate, UTC times, expected result, actual result, and pass/fail status. Keep transaction, notification, request, and workflow identifiers in restricted evidence. Attach screenshots or recordings and test result bundles. Never attach passwords, private keys, auth tokens, or full signed payloads.

Require these results before enabling public checkout:

- Both products complete the full transaction-to-access path on development Sandbox and TestFlight builds.
- Ownership, delivery replay, quota preservation, expiry, billing failures, and missed-notification recovery pass.
- The deployed Apple credentials, certificate verification, persistence permissions, signed workflows, and recovery schedule have real evidence.
- Remaining App Store release requirements are rechecked against the current app, including subscription metadata and terms, privacy policy, account deletion, AI disclosure and consent, and the review account. Earlier documents list gaps that may have changed.

Keep production enablement as a separate release decision. Sandbox proves the integration without proving real charging, settlement, or App Store approval. After release, arrange a separately authorized production purchase-and-restore smoke test with a designated account and real payment expectations.

Stop test renewals when finished. Remove fixture launch arguments and fixture-only runtime data, return the app to normal account mode, and preserve real account data. Do not delete ownership records to make a failing restore pass. Report unresolved cases before proceeding to release.
