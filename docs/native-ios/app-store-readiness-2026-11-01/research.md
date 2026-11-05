# Compliance research

Checked against Apple's published guidance on 1 November 2026. Recommendations distinguish requirements, design guidance, and conclusions drawn from Leximory's source. The [free-AI addendum](guest-ai.md) revises the original AI/sign-in boundary after feedback.

## What the rules mean here

Apps without significant account-based features must allow use without login. Account creation brings an in-app deletion requirement; personal information needs a relevant purpose. [App Review Guidelines, 5.1.1(v)](https://developer.apple.com/app-store/review/guidelines/#data-collection-and-storage)

For Leximory, separating ordinary reading from personal cloud services is the recommended application of that rule. It does not imply building a complete offline clone.

Apple's HIG recommends deferring authentication and explaining its benefit where it appears. That supports letting someone start reading, then asking for sign-in when they choose an account feature. It is design guidance rather than a promise of approval. [Managing accounts](https://developer.apple.com/design/human-interface-guidelines/managing-accounts)

For deletion, Apple requires a discoverable in-app starting point and removal of the account and associated data, except required legal retention. Deactivation alone is insufficient. A direct deletion webpage is permitted, but support email or chat is not an appropriate required path for this app. Reasonable identity verification is allowed. Auto-created guest accounts also need deletion. Subscription cancellation and account deletion are separate. [Apple's account deletion guidance](https://developer.apple.com/support/offering-account-deletion-in-your-app/)

## Findings in this repository

| Source | Current behavior | Implication |
| --- | --- | --- |
| `App/AppRootView.swift`, `AccountRoot` | Signed-out users see WelcomeGate or SignInView. BrowserWorkspaceView is only constructed for a signed-in account. | Account-independent reading is behind the same gate as cloud features. |
| `App/OnboardingView.swift`, `WelcomeGate` | 开始学习 opens sign-in. | The first promised learning action leads to credentials. |
| `App/AppRootView.swift`, `SignInView` | Email/password, password recovery web link, no native registration entry. | New users cannot complete an obvious in-app account creation journey. |
| `App/AccountView.swift`, `management` | Profile edits and 退出登录; no 删除账号. | Sign-out does not satisfy deletion. |
| `server/mobile/endpoints/account.ts` | Account settings, claims, tokens, avatar and billing routes; no self-service deletion operation. | A user-facing button has no suitable deletion operation to call yet. |
| Web `app/admin/actions.ts`, `deleteUser` | Administrator-only Supabase Auth deletion. | It is not a reusable self-service deletion contract or proof of full data cleanup. |
| `App/Browser/BrowserWorkspaceView.swift` | Files picker routes a chosen ebook into BrowserImportRequest. | The current 打开电子书 action begins the cloud import flow. Guest reading needs a local branch. |
| `App/Reader/EbookScreen.swift`, `load` | Account path uses cached/downloaded books; client-free path reads bundled resources. | Reuse the renderer, but add a genuine picked-file source. Passing `nil` alone is insufficient. |
| `Core/.../LocalReadingStore.swift` | Budgeted cache with eviction and excluded-from-backup storage. | Guest-authored data needs durable storage separate from disposable reading cache. |
| `App/MembershipStore.swift` | Purchase and restore depend on account identity and server entitlement delivery. | Treat commerce as a separate account-dependent design decision. Do not assume StoreKit itself requires registration. |
| `server/mobile/auth.ts` | Server verifies bearer tokens through Supabase `getUser`. | Preserve this boundary. Guest reading must not weaken protected routes. |

These are source findings, not a completed live usability or accessibility audit. Paths are relative to `apps/leximory-ios` for native code and `apps/leximory` for server/web code.

## Which guest architecture is smallest overall?

| Approach | Native work | Server/lifecycle work | Assessment |
| --- | --- | --- | --- |
| Keep mandatory sign-in | Small | Small | Weak fit for browsing and local reading. Relies on defending the entire product as account-based. |
| Add Skip but send most actions back to sign-in | Small | Small | Poor experience; the presence of Skip proves little. |
| Auto-create a Supabase anonymous account | Small to medium initially | Identity conversion, existing-account merge, abuse controls, quotas, cleanup, deletion | Appears cheap at first; introduces server users for people who only wanted to open a book. |
| Local guest workspace plus existing cloud account | Medium and bounded | No guest APIs or anonymous users | Recommended. Supports useful reading without expanding the backend identity model. |
| Full local vocabulary/review system with automatic cloud merge | Large | Merge, conflict and duplicate handling | Defer. It duplicates the most account-specific parts of the product. |

Supabase anonymous sign-in creates a real user with the authenticated role. Linking to an existing account requires conflict handling, and the documented approach also needs abuse prevention and explicit cleanup. Those are material costs for this product, whose quotas and account creation effects currently assume a user identity. [Supabase anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous)

The revised guest scope includes web browsing, local EPUB/PDF reading, local reading position and marks, a small renewable contextual AI allowance, and local saved definitions. Keep the bundled annotated article as an optional starting point. Do not build a second cloud library or local spaced-repetition engine. A sample or generic browser alone demonstrates too little of Leximory's purpose. This is our product judgment, not an Apple-prescribed minimum.

## Authentication choice

Keep native email/password for the first implementation, with native registration and email confirmation. Reuse Supabase's existing account model. Avoid adding passkeys, magic-link callbacks, or a second provider solely for this work.

Third-party/social login generally requires an equivalent privacy-preserving option. A company's own account system has an exception. [App Review Guidelines, 4.8](https://developer.apple.com/app-store/review/guidelines/#login-services)

Our recommendation is native email/password first. If GitHub login is added to iOS, plan Sign in with Apple alongside it.

Check existing GitHub-only users before shipping this baseline: they need a verified way to establish a password or use a supported provider. Do not invent an automatic provider merge from matching email addresses. Apple's guidance also warns against sending people to the default browser to register or sign in. [Account deletion FAQ, including linked account creation](https://developer.apple.com/support/offering-account-deletion-in-your-app/)

Sign in with Apple remains a good later UX improvement. It adds provider configuration, account-linking decisions and token revocation on deletion, so it is not included as a free dependency of this proposal.

## Deletion must cover more than Auth

Build an ownership inventory before coding the deletion operation. Do not assume undocumented foreign-key cascades exist. The repository has proposals and generated database types, not proof of the deployed constraints.

| Data category | Plan |
| --- | --- |
| Auth, profile, API tokens, sessions | Remove the user and credentials. Reauthentication must authorize the current subject, never a user ID supplied by the client. |
| Owned folders, texts, bookmarks, vocabulary, review answers, reading history | Delete owned records and private associations. Preserve other users' independent data and shared dictionary entries. Determine ownership of shared/published material explicitly. |
| EPUB/PDF originals, generated outlines, handwriting and audio | Enumerate object keys before deleting metadata. Existing code uses the `user-files` bucket, including `ebooks/{id}.{extension}` and `audio/{id}.mp3`. Establish all other paths rather than guessing a user-ID prefix. |
| Avatar | Existing upload code uses the `avatars` bucket and the subject ID. Remove it and account-derived local copies. |
| Redis state, imports, Inngest jobs, delayed actions | Cancel or invalidate work and remove account-bearing state. Workers must not recreate data after deletion starts. |
| Billing records | Remove personal linkage where permitted; retain only records required for billing/legal obligations with an actual retention policy. Do not delete Apple transaction facts needed to prevent duplicate delivery blindly. |
| Device data | Clear the deleted account's tokens, caches, history, pins, wallpaper photos, pending edits, widgets and app-group snapshots. Keep source files in Files untouched. Clear in-memory state too. |
| Logs, backups and processors | Document actual retention and processor deletion mechanisms. Do not promise instantaneous removal from backups or third parties without verification. |

Supabase documents that deleting Auth does not immediately invalidate every issued JWT, and that owned Storage objects can prevent user deletion. Therefore, delete storage safely before Auth and test access after deletion across all API paths. The current mobile `getUser` verification is useful, but does not prove web, direct database, or storage access is closed. [Supabase user management](https://supabase.com/docs/guides/auth/managing-user-data#deleting-users)

Use a retryable operation with a stable deletion ID. Prefer existing Inngest infrastructure if cleanup spans several systems. Persist the object inventory and progress before destructive steps. Mark an account as deleting and reject new writes before cleanup, then remove Auth last. If the deployed system lacks a suitable durable state mechanism, propose the smallest required change for separate approval. No schema change or Supabase side effect is authorized by this research deliverable.

## Adjacent submission issues to check later

Keep these separate from the two current deliverables:

- AI processing: identify providers and payloads; disclose third-party personal-data sharing and obtain explicit permission. [Guidelines, 5.1.2(i)](https://developer.apple.com/app-store/review/guidelines/#data-use-and-sharing)
- Payments: verify purchase, restore, entitlement delivery and storefront behavior against the applicable payment rules. [Guidelines, 3.1](https://developer.apple.com/app-store/review/guidelines/#payments) Our recommendation is to assess local benefits separately from account-bound services.
- Privacy: reconcile the app privacy answers, SDK behavior, required-reason APIs and privacy manifests with the shipped binary. [App privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/), [SDK requirements](https://developer.apple.com/support/third-party-SDK-requirements/)
- Review access: supply working credentials for cloud features and explain the guest and deletion paths. Guest reading is not a replacement for access to the complete account experience. [Complete review information](https://developer.apple.com/help/app-review/before-submitting-for-review/complete-review)
- Rights and availability: verify bundled sample rights and imported-content handling. Do not assume that a reading interface automatically qualifies for every reader-app commerce exception.

The two proposed changes address prominent risks. They do not certify the entire binary, billing setup, privacy disclosures, or regional legal compliance.
