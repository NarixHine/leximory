# Free AI before signup

Revised proposal after feedback, 1 November 2026. This replaces the earlier recommendation to require sign-in for every AI lookup and vocabulary save. Research and design only; no production changes or external account setup were performed.

## Decision

Allow real contextual AI definitions without signup. Save chosen definitions locally. Offer an account when someone wants to put their words into their cloud library, use their account allowance, or access account history and personalized review.

Use Leximory's existing Redis service for guest allowances and request recovery. Keep its current server-side AI model and provider credentials. Do not create a Supabase anonymous account or introduce Firebase solely for this feature.

The user has confirmed that Vercel budget protection is already handled. A second global spend ledger, budget reservation system, or custom global kill switch is outside this proposal. This document does not audit the user's Vercel configuration.

## What we already have

| Existing code | Reusable part | Limitation |
| --- | --- | --- |
| `server/mobile/quota-store.ts` | Atomic Redis Lua quota charge and request receipts | Keys and invalidation assume a real user. This is a useful pattern, not a guest API ready to call. |
| `server/mobile/definition-generation.ts` | Cache lookup, generation and streamed response framing | Preferences and charge depend on a MobileSubject. The cache version, language, accent and context are already part of the cache key. |
| `server/mobile/definition-services.ts` | Prompt, output parsing, model call and Redis result cache | Also reads account preferences and saves into Supabase libraries. Guest generation must bypass those account-specific operations. |
| `server/mobile/browser.ts` and native definition UI | Contextual web lookup and in-place definition presentation | Current selection and saving paths still use an authenticated client. |
| `@repo/kv/redis` | Existing Upstash Redis connection | No second persistence service is needed for a small guest ledger. |
| Native Keychain/auth infrastructure | Secure storage already exists in the app | Use a separate guest credential key; never reuse account tokens or fake user IDs. |

The current free signed-in plan has 20 commentary points per 30-day quota period, and word annotation costs 0.25 points. That nominally allows 80 uncached word lookups if nothing else uses those points. Some existing cached definitions bypass charging. Do not choose a generous daily guest limit that makes registration reduce access without adjusting the signed-in baseline too.

## Smallest useful first implementation

1. Mint a server-issued opaque guest credential with a random subject and sufficient entropy. Store it in Keychain. Keep a hash/server record in Redis with explicit expiry; rotate without discarding active request receipts. No email, profile, Supabase user or cloud library is created.
2. Apply a modest enrollment/IP burst limit and a per-guest allowance using Redis atomic operations. IP is a supplementary abuse signal, not identity; shared school, office and mobile networks must not share one normal user's entire allowance.
3. Add a narrow guest-definition endpoint accepting a word, supported language, short surrounding context and a stable request ID. Do not accept arbitrary prompts, model names, instructions, server-fetch URLs or a library ID that grants access to account content.
4. Reuse the current definition generation and streaming format through a small guest adapter with default/local accent preferences. Preserve the existing account authorization path. A guest credential is valid only for guest routes.
5. Keep the selected result and optional 收藏词汇 locally. Opening an existing saved definition does not consume another generation. Viewing or editing local words does not require an account. Reuse the existing saved-vocabulary presentation through a local-data adapter and reading collection controls; do not add a new tab or local folder system.
6. When someone explicitly chooses to save local words into an account, authenticate and import only those chosen records with stable per-item IDs. Reuse existing vocabulary contracts where possible. Do not upload books, browser history or unrelated guest data, or build an automatic two-way merge engine.

Guest service state still needs privacy controls. Clearing local guest reading data should revoke its service credential and remove its recoverable request contexts/results. Document any narrowly retained abuse metadata and its expiry. Calling the record a session, rather than an account, is not a reason to ignore data deletion obligations.

Suggested initial policy: a small renewable daily word-lookup allowance, with the amount configurable server-side. Five new definitions a day is a starting hypothesis, not a finalized entitlement. Signed-in users should get at least the same basic access. Before implementation, decide whether to raise the beginner allowance or provide the same daily baseline through one common policy. Avoid two visible wallets, two counters on a definition tray, or an incentive to sign out for more access.

Start guest AI with contextual word definitions. Full-text annotation, generated audio, AI outlines and AI-reviewed writing have different input sizes, response times and persistence needs; keep their existing account flows initially. Supporting every AI workflow is not required to make this first experience useful.

## What "reliable" means

The lean design can reliably meter accepted logical requests and recover retries. It cannot guarantee one allowance per human or physical device. A user or attacker can reset local state or request fresh guest credentials. That is an explicit tradeoff for a cheap, capped service, rather than a hidden claim that a Keychain ID is unresettable.

For correct accounting:

- Bind each request receipt to the verified guest subject, request ID and normalized input hash. Reusing an ID with a different payload fails validation.
- Atomically reserve a credit and claim the logical operation before generation. Concurrent duplicates must join/read that operation instead of calling the model independently.
- Record running, completed, definitively failed and unresolved states. Persist the final parsed result so reconnecting clients can recover it. A quota receipt alone does not prevent duplicate provider calls.
- Refund/release according to the logical request state, once. Do not refund an uncertain provider timeout and simultaneously create an unrelated new paid request. Provider execution itself cannot generally be guaranteed exactly once.
- Keep results for a short documented period, such as 24 hours, and credentials/counters only as long as needed. Reading content must not enter logs. Do not turn this temporary service state into a cloud library.
- If Redis is unavailable, stop new metered generation while preserving reading and existing definitions. Bounded automatic recovery stays silent. Exhausted allowance is an intentional state, not a network error.

Use the same validation and output caps as signed-in definitions, and explicitly bound context size, concurrency and automatic retries. The current generator already caps output at 800 tokens for most languages and 1,600 for Dutch. Preserve language-specific requirements rather than reducing output until definitions become incomplete. No price estimate is asserted here; actual provider usage and latency should determine the final allowance.

## Available hardening if abuse appears

| Option | What it provides | Fit |
| --- | --- | --- |
| Apple App Attest | Attested installation key plus assertions over server challenges and requests | Preferred next layer for this native app. No new analytics/auth platform. |
| Apple DeviceCheck | Two Apple-maintained bits of device state that can mark a redeemed promotion | Useful for a one-time offer; not a normal daily numeric quota ledger. |
| Firebase App Check | Official SDKs verify app integrity against custom backends using providers including App Attest | Available managed alternative, but adds Firebase configuration, dependencies and credentials. Unnecessary for the lean version. |
| Supabase anonymous Auth | A real backend account without an email | Does not establish app integrity; adds account cleanup/conversion/deletion work. |
| CAPTCHA on every lookup | Interactive bot checks | Poor fit for reading. Do not add this to the normal flow. |

Apple App Attest can attest an installation and validate requests without collecting account credentials. Its keys are installation-specific and do not survive reinstallation; it is not a permanent device identity. [Apple's App Attest explanation](https://developer.apple.com/videos/play/wwdc2021/10244/)

A direct integration would validate the attestation, store the public key, then verify a fresh challenge and request-bound assertion. Challenge consumption and the assertion counter update must be atomic. Serialize the native assertion path or handle out-of-order requests deliberately. Check the current Apple validation requirements, including applicable newer extension fields, rather than copying an old verifier unchanged. [Apple server validation](https://developer.apple.com/documentation/devicecheck/validating-apps-that-connect-to-your-server)

`node-app-attest` is an available Node verifier candidate exposing attestation/assertion verification. Its documentation was inspected, but its implementation, maintenance state and compatibility with the latest Apple protocol were not audited. Pin and review any chosen verifier, validate against Apple test material, and exercise production-environment behavior on a real device before relying on it. [Project source](https://github.com/uebelack/node-app-attest)

DeviceCheck offers only two bits, and Apple explicitly describes promotion redemption as a use case. Those bits are not an arbitrary stable device ID or a counter. [DeviceCheck](https://developer.apple.com/documentation/devicecheck)

Firebase App Check can protect our existing API without moving it into Firebase or adopting Firebase Auth. Its optional token consumption/replay protection is currently beta and adds a verification round trip. [Custom backend verification](https://firebase.google.com/docs/app-check/custom-resource-backend) The decoded token identifies the Firebase app, not an individual device, so it does not replace a guest quota identity. [Decoded token fields](https://firebase.google.com/docs/reference/admin/node/firebase-admin.app-check.decodedappchecktoken)

For App Attest outages or unsupported devices, keep ordinary reading available and provide a deliberately smaller guest fallback allowance if needed. Do not silently give unlimited AI to any request claiming attestation failed, or turn transient attestation errors into forced signup. Apple's guidance includes checking support and retrying temporary server failures with the same key. [Establishing app integrity](https://developer.apple.com/documentation/devicecheck/establishing-your-app-s-integrity)

## Revised UX

The first proposal borrowed Leximory's fonts and wallpaper but left its most important moment as a generic credential form. The revision changes the interaction first:

1. Open a real text immediately.
2. Tap a word and receive contextual AI in the existing anchored definition presentation.
3. Choose 收藏词汇. It saves locally and remains available without signup.
4. Mention remaining free uses quietly near the lookup action, without a progress ring, point currency or signup banner. Cached/local results do not spend a new use.
5. On exhaustion, preserve the reader and saved words. Explain the reset near the affected lookup control. Offer system/dictionary lookup and optional use of an account's allowance.
6. Offer an account from More or an explicit 保存到账号 action. Show the actual word and source sentence that the person chose to keep. The reason to authenticate is their content, not an abstract promotional slogan.

Keep the watercolor lawn and cat as a small signature on the optional account sheet, using original assets. Use fine newspaper rules, native neutral controls, real serif typography and actual reading excerpts. Keep deletion clear and familiar; it does not need a decorative mascot or a dramatic redesign.

The new studies are `04-free-ai-reading.png`, `05-optional-account.png` and `06-allowance-state.png`. They are concepts, not tested native components. The existing source remains authoritative for anchored popover placement, bottom browser chrome and artwork treatment. Bubbles overlay the existing reading viewport and must not reflow prose or change the reading position. The generated typography and spacing are approximate; do not implement new layout chrome by tracing a bitmap. [Exact generation prompts](revised-prompts.json).

Before the first AI transmission, retain the required specific processing disclosure and permission. Free access does not remove that requirement. Only a short selected context should be sent; choosing a local book does not authorize uploading its full contents.

## Verification before shipping

Prove concurrent request deduplication, payload-bound receipts, quota-boundary races, result recovery, refunds, token expiry, enrollment throttling, local vocabulary persistence, and signing in without losing a word. Test logout/deletion without carrying account data into the guest namespace. If App Attest is adopted, add real-device attestation, replay, counter, key rotation, unsupported-device and Apple-outage checks.

No such production checks have been run in this research task. No new dependency is installed. No Firebase project, Apple entitlement, Supabase schema or Vercel setting has been changed.
