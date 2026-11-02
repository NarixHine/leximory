# Implementation results

The implementation is local and uncommitted. No production deployment, live Supabase write, database migration, or real-device installation was performed.

## Implemented

- Signed-out launch opens the existing Home. Websites and EPUB/PDF files work through existing components. Guest books remain in memory. Guest saving, a guest library, persistent reading marks, and account migration are absent.
- Lazy guest AI credentials use Keychain and the existing Redis/AI stack. Five generated definitions are available per 30-day credential period. Request identities, reservations, recovery and cache hits are isolated from account quotas. Vercel global spending controls remain owned by the user.
- 收藏词汇 opens optional authentication and saves one word only after authentication. Registration, confirmation and password recovery use the installed Auth SDK. Source metadata is captured when lookup begins. The headword is the annotation's `lemma`; selected occurrence, optional excerpt and title remain separate. No guessed short translation is displayed.
- The account screen uses the requested title/caption, actual watercolor assets, separate light/dark variants, and the slate-blue dark palette. Existing annotation popovers and trays remain the UI used for reading.
- Account deletion verifies the intended account and recent authentication, preserves a recoverable receipt, freezes the account and queues Inngest cleanup. It inventories owned storage before metadata removal, removes associated records and files, unlinks retained transaction records, and removes Auth last. Native cleanup uses throwing purges. Status works after sign-out. A fresh-authentication request preserves the valid session; account-scoped clients verify the identity of acquired/refreshed credentials.

## Verification

| Check                                              | Result                                                                                                                                                                    |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --dir apps/leximory run test:mobile`         | 320 passed, including production Next.js HTTP/runtime checks with external services replaced                                                                              |
| `pnpm --dir apps/leximory run check:mobile-routes` | 62 operations in 57 route files; generated OpenAPI matches                                                                                                                |
| `pnpm --dir apps/leximory run check-types`         | Passed                                                                                                                                                                    |
| `swift test --package-path apps/leximory-ios/Core` | 114 tests passed, including bounded Unicode context, guest request identity, authenticated saving, receipt authorization, scoped purge and recent-authentication handling |
| Latest focused native run                          | 11 passed: annotation/source-data cases, account identity, guest entry, registration/recovery, and annotation base-form UI                                                |
| Earlier native regression run                      | 25 focused unit tests plus the existing signed-in definition recovery/save journey passed; the guest menu selector was corrected and its rerun passed                     |
| Native simulator build                             | Successful; final incremental build uses the generic simulator destination after the toolchain update                                                                     |
| Asset checks                                       | All four final PNGs have alpha; automatic light/dark catalog variants are wired                                                                                           |
| Manual UI                                          | Phone light/dark and accessibility layouts inspected. Initial iPad check exposed a short sheet; its sizing was adjusted to 560 × 900                                      |

The broad native suite was **not green**. It recorded failures in extensionless-PDF handling, a bookmark-refresh fixture missing `color`, and pending bookmark recoloring, then timed out during ebook export tests. No baseline run was completed, so these are not labeled proven pre-existing failures. Focused checks do not replace a full reader release pass.

The installed Xcode toolchain changed from iOS SDK 27.0 to 27.2 during verification. CoreSimulator reported running version 1174.9.2 while the toolchain requires 1174.21.0. Restarting its user service did not resolve the installed-component mismatch. The final iPad visual recheck and normal-mode relaunch could not complete. The known preview process was terminated; no Leximory process remains running on the two test devices. No fixture launch arguments were added to the generated scheme. The next ordinary app launch uses normal account mode.

## Remaining release checks

- Complete Xcode's matching simulator-component setup, then recheck the adjusted iPad composition, keyboard/large-text paths and the complete reader suite. The final token-refresh binding and quiet deletion-status recovery changes compiled; their native runtime rerun is still pending after the simulator mismatch.
- Allowlist `leximory://auth/callback` and `leximory://auth/callback?flow=recovery` in deployed auth configuration and verify real confirmation/recovery email delivery.
- Publish the complete privacy/retention policy and review AI processor disclosures. Existing unindexed processor/cache histories are not evidence of immediate physical erasure.
- With explicit authorization, verify deployment against Redis/Inngest and Supabase ownership, storage and foreign-key behavior, including lost acceptance responses, retries and final completion. Installed-SDK adapter tests replace external HTTP and cannot prove deployed cleanup.

No live account was deleted for verification. Apple review approval is not guaranteed by these changes. The [decision trail](implementation-decisions.tsv), [data/UX specification](experience.md), and [asset prompts](account-assets.json) record the final choices and the rejected first visual implementation.
