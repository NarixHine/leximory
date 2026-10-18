# Subscription setup and testing

The backend and StoreKit delivery are implemented. Live purchases remain disabled until App Store Connect setup and release verification are complete. No database operation was run by the agent. The regenerated `apple_subscriptions` types are the schema contract; no additional table or database function is required.

## Test now, without App Store Connect

1. Generate the Xcode project if needed:

    ```sh
    apps/leximory-ios/.tools/xcodegen/bin/xcodegen generate --spec apps/leximory-ios/project.yml
    ```

2. Open `apps/leximory-ios/Leximory.xcodeproj` and choose **Leximory-StoreKit-Local** and an iPhone or iPad simulator.
3. Run the app, sign in with a free Leximory account, and open the subscription card. The scheme loads `StoreKit/Leximory.storekit` and enables `LEXIMORY_STOREKIT_LOCAL=1`.
4. Purchase a plan using the native StoreKit confirmation. Use **Debug → StoreKit → Manage Transactions** to inspect and change test transactions. The StoreKit configuration editor can simulate Ask to Buy, interrupted purchases, billing issues, renewal and expiration.
5. Stop the app and choose the ordinary **Leximory** scheme when finished.

Local test transactions never call the production delivery endpoint or change real quotas. The purchase sheet and purchase completion can be tested; account access still comes from the backend. Apple Server API calls and real server notifications require Sandbox testing after registration. The local switch compiles only into Debug simulator builds. The StoreKit configuration is bundled in the unit test target, not the application.

The `LocalStoreKitTests` suite buys a monthly product with an account token, checks the Xcode environment, and expires the subscription. It clears its transactions afterward. Backend tests inject Apple and database dependencies; they do not access live Supabase accounts. Signature-boundary tests also exercise Apple's verifier against forged and Xcode evidence.

See [Apple's local testing guide](https://developer.apple.com/documentation/xcode/setting-up-storekit-testing-in-xcode) and [testing environments](https://developer.apple.com/documentation/storekit/testing-at-all-stages-of-development-with-xcode-and-the-sandbox).

## Register before Sandbox verification

Create the App Store Connect app for `com.leximory.reader`, then one subscription group with these monthly products:

| Product identifier                      | Plan      | Group level |
| --------------------------------------- | --------- | ----------- |
| `com.leximory.reader.polyglot.monthly`  | Polyglot  | 1           |
| `com.leximory.reader.bilingual.monthly` | Bilingual | 2           |

Product identifiers are maintained in `packages/env/src/billing.ts`. The API returns them to iOS. The local StoreKit catalog is a test fixture checked against that mapping. Set actual storefront pricing in App Store Connect; production prices displayed by iOS always come from StoreKit. Do not enable Family Sharing, promoted purchases, introductory offers, or out-of-app acquisition for this first release.

Create an In-App Purchase key under **Users and Access → Integrations → In-App Purchase**. Configure these server-only deployment variables through the deployment secret manager:

| Variable                      | Value                                                                |
| ----------------------------- | -------------------------------------------------------------------- |
| `APPLE_APP_ID`                | Numeric Apple app ID, not the bundle identifier                      |
| `APPLE_SUBSCRIPTION_GROUP_ID` | Subscription group's identifier                                      |
| `APPLE_ISSUER_ID`             | Issuer UUID                                                          |
| `APPLE_KEY_ID`                | In-App Purchase key ID                                               |
| `APPLE_PRIVATE_KEY`           | Complete `.p8` PEM with actual newlines                              |
| `APPLE_ROOT_CERTIFICATES`     | JSON array of base64-encoded DER Apple root certificates             |
| `APPLE_SANDBOX_USER_IDS`      | Comma-separated Supabase auth UUIDs for test and review accounts     |
| `APPLE_PURCHASES_ENABLED`     | Leave unset or `false` until verification completes; then set `true` |

Obtain root certificates from [Apple PKI](https://www.apple.com/certificateauthority/). Keep private keys out of Git, chat, client bundles, logs and Inngest payloads. Malformed keys, certificates, or incomplete configuration keep checkout disabled. The API signing key and verification configuration are independent of the purchase enable flag so existing purchases can still be delivered while new checkout is paused.

Configure **V2 Production and Sandbox notifications** to:

```text
https://<Leximory deployment>/api/apple/notifications
```

Deploy the Inngest functions from the existing `/api/inngest` integration. Verify function discovery for `apple-subscription` and `apple-subscription-recovery`, delivery retries, failure alerts and replay. Notifications receive 200 only after signature validation and durable queue acceptance. Events contain an environment and original transaction ID; raw signed evidence stays out of event and step output.

Hourly recovery re-fetches known chains and scans an overlapping 48-hour Apple notification history window. For a longer outage, perform a controlled notification-history backfill before enabling checkout again. Account access always checks signed expiry at request time, so an unavailable scheduled job cannot keep an expired subscription active.

See [Apple's official server library](https://github.com/apple/app-store-server-library-node) for key creation and root certificate requirements.

## Verify before enabling purchases

Use Apple's Sandbox with the ordinary Leximory scheme and no StoreKit configuration. Explicitly add the Supabase UUIDs of Sandbox testers and the App Review account to the server cohort. A client build flag cannot admit Sandbox entitlements.

Verify new purchase, restore, pending approval, renewal, cancellation with access through expiry, grace, billing retry, refund and refund reversal. Restart the app before server acknowledgement, interrupt connectivity, replay notifications and try restoring while signed into another Leximory account. Confirm that the original owner retains the subscription and that consumed AI quotas and reset times stay unchanged.

Run the mobile suite, contract checks, type checks, and the iPhone/iPad StoreKit tests. Include a real Sandbox notification test and inspect Inngest retry recovery. Local and injected tests do not establish successful Apple credentials, certificate validation against real transactions, deployment configuration, or database RLS in the live project.

## Remaining App Store release gates

The purchase implementation alone does not make the app submission-ready. Complete the gates in `billing-plan.md`: publish and link the actual privacy policy, provide the required account-deletion flow, finish AI data-use disclosure and consent, configure subscription metadata and agreements, and complete Sandbox/App Review testing. Native legacy membership now opens status and support, without a Creem upsell portal. Web and mobile Creem checkout also check the shared purchase eligibility before creating another subscription.

Keep checkout disabled until those gates pass. No claim of App Store approval or live production verification is implied by the automated checks.

## Implementation verification, 18 October 2026

- The complete mobile suite passes 234 tests, including authenticated Next.js HTTP routes. The final focused billing suite passes 17 tests, including independent transaction/renewal freshness and forged-signature rejection.
- `pnpm exec turbo check-types` passes for all three apps. The generated mobile contract matches all 52 operations and 47 route files.
- Focused native membership, wallpaper and local StoreKit tests pass 14 tests each on iPhone and iPad. Card activation and purchase selection/success pass on both; the iPad largest-text and landscape interaction also passes.
- The three Swift Core account tests pass, including generated-client purchase acknowledgement. The simulator test configuration is isolated from the ordinary app scheme, and both simulators are left in normal account mode.
- No live Supabase account or Apple Sandbox transaction was used. Actual credentials, deployment, live RLS, privacy/deletion/AI-consent release gates and Apple's end-to-end Sandbox verification remain unverified.
