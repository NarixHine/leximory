# Guest AI implementation

This replaces the earlier local-saving proposal after the user rejected guest storage and migration.

Guests use the real browser and the existing EPUB/PDF readers, annotation trays and selection controls. Files open in memory. Guests cannot save words, cloud libraries, reading marks, or review records. 收藏词汇 opens the approved optional account screen with the actual word and a short excerpt. The word is saved through the authenticated vocabulary endpoint only after sign-in. Closing creates nothing.

## Allowance

The first AI lookup lazily creates a random guest credential. The credential lives in Keychain and expires after 30 days. It permits five generated definitions during that period. Cached results and failed generations do not spend another use. There is no daily allowance or “come back tomorrow” copy.

The existing Redis service atomically reserves allowance and binds a UUID to the request payload. Repeated requests recover the same result without another charge. One generation may run per credential. Completed definitions expire after 24 hours; request identities remain through credential expiry to prevent a retry from being charged again. Expired result identities return an unavailable result instead of generating again. Enrollment uses Vercel's trusted network header and a six-per-hour limit. Guest bearers cannot authorize account endpoints.

A disposable credential and network throttle reduce casual abuse. They do not identify a person or stop a determined attacker from changing networks. No App Attest, Firebase, anonymous Supabase user, migration system, custom global budget, or new database schema was added. Vercel's global spending controls remain the user's responsibility.

## Reading UI

The first guest lookup requests permission in the existing definition tray. It explains the five free uses and that nearby context passes through Vercel to Google for language detection and DeepSeek for definitions. It does not upload the book. Inputs preserve the exact UTF-16 quote offset and bound nearby context. Exhaustion offers sign-in to use the account's existing allowance. Existing signed-in quotas and prompts retain their current behavior.

The selected visual reference is [the optional account screen](05-optional-account.png). The generated reader studies are rejected explorations. Native implementation uses the real reader UI.

## Verification

Server coverage exercises Redis scripts, payload binding, duplicate requests, quota races, terminal failures, cached results, session expiry and revocation. Native coverage exercises Unicode context bounds, guest transport authorization, stable retry identity, local file validation, authenticated saving, and receipt-only deletion status. See implementation.md for run results and deployment limits.
