# Library archive verification

## Reproduced failure

The native archive endpoint rejected an authenticated reader with an accessible library when the reader had no `users` profile row. The web archive read initializes that row. The mobile write instead returned `inaccessible`, so the app displayed its generic failure alert.

The regression test initially failed with HTTP 404 instead of 200. It exercises the real route wrapper, archive operation, persistence adapter, and installed Supabase client. Only the external database transport is replaced. This establishes a concrete failure case; it does not establish that the reported account had a missing profile.

## Changes

Catalog reads and archive writes now share an injectable preference adapter. A mutation initializes a missing profile with the existing web defaults and ignores conflicts, preserving an existing profile's balance and plan. Preference reads remain read-only. Conditional writes retain other folders' archive settings, validate the write receipt, and retry conflicts within a fixed limit. A final read accepts a competing write that already achieved the requested state.

The native client retries temporary failures with the same explicit archive target. It changes its cache only after success. The workspace prevents overlapping actions for one folder and assigns the confirmed state instead of toggling it. Cancellation does not produce an archive error.

The HTTP boundary records server failure request IDs, operation names, and bounded provider error codes. Logs omit bearer tokens, request bodies, SQL messages, and provider details. The response carries the same request ID.

## Checks

- The default mobile suite includes the new adapter tests. All 262 tests passed.
- The real Next.js runtime test covers authenticated archive, replay, unarchive, and cache invalidation, as well as static and dynamic parameter handling.
- The contract and route checks passed for 54 operations in 49 route files.
- Leximory's required type check passed.
- All 102 Swift Core tests passed. Archive tests cover recovery, replay after a lost response, exhausted retries, permanent access failure, cancellation, and cache retention.
- The iOS Simulator app build passed, including the workspace action guard and disabled archive control. This was a compile check; the app was not installed or launched.
- The configured Supabase API schema was read without accessing account rows. It reports `users.archived_libs` as `text[]`.

No database schema or live account data was changed. These source changes require a backend deployment and an updated native build. The exact reported account failure remains unconfirmed without a matching failing request or server diagnostic.
