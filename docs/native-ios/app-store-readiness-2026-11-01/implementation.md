# Implementation results

The user committed and deployed the implementation at `32dbbfcbaf84fe67146588b85a69c43d97bee076`. On November 2, the deployed API returned that exact revision and the native app completed a real guest lookup against it. Follow-up verification changes and the monochrome emoji font fix are local. No live Supabase write, database migration, or real-device installation was performed during verification.

## Implemented

- Signed-out launch opens the existing Home. Websites and EPUB/PDF files work through existing components. Guest books remain in memory. Guest saving, a guest library, persistent reading marks, and account migration are absent.
- Lazy guest AI credentials use Keychain and the existing Redis/AI stack. Five generated definitions are available per 30-day credential period. Request identities, reservations, recovery and cache hits are isolated from account quotas. Vercel global spending controls remain owned by the user.
- 收藏词汇 opens optional authentication and saves one word only after authentication. Registration, confirmation and password recovery use the installed Auth SDK. Source metadata is captured when lookup begins. The headword is the annotation's `lemma`; selected occurrence, optional excerpt and title remain separate. No guessed short translation is displayed.
- The account screen uses the requested title/caption, actual watercolor assets, separate light/dark variants, and the slate-blue dark palette. Existing annotation popovers and trays remain the UI used for reading.
- Account deletion verifies the intended account and recent authentication, preserves a recoverable receipt, freezes the account and queues Inngest cleanup. It inventories owned storage before metadata removal, removes associated records and files, unlinks retained transaction records, and removes Auth last. Native cleanup uses throwing purges. Status works after sign-out. A fresh-authentication request preserves the valid session; account-scoped clients verify the identity of acquired/refreshed credentials.
- The bundled monochrome font now explicitly supports emoji variation selectors. Its existing glyph outlines and order are identical. The bundler repeats this asset fix, so cover symbols such as `☀️` use Leximory's artwork instead of falling back to Apple Color Emoji.

## Verification

| Check                                              | Result                                                                                                                                                                    |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --dir apps/leximory run test:mobile`         | 320 passed, including production Next.js HTTP/runtime checks with external services replaced                                                                              |
| `pnpm --dir apps/leximory run check:mobile-routes` | 62 operations in 57 route files; generated OpenAPI matches                                                                                                                |
| `pnpm --dir apps/leximory run check-types`         | Passed                                                                                                                                                                    |
| `swift test --package-path apps/leximory-ios/Core` | 114 tests passed, including bounded Unicode context, guest request identity, authenticated saving, receipt authorization, scoped purge and recent-authentication handling |
| November 2 native unit run                         | 224 passed, 1 failed, 1 skipped across 226 tests. The sole failure was the monochrome sun variation; its asset fix passed the native glyph test afterward. The skipped test requires a designated live account. |
| Previously failing reader checks                   | Bookmark refresh, pending recoloring, export and extensionless PDF checks passed. Fixtures now include the required bookmark color and signed-in editing permission. Production permission guards remain unchanged. |
| Deployed guest API                                 | Real AI returned `leaf` for `leaves` and `walk` for `walked`; replay returned the same result without another charge. The disposable probe credential was revoked. |
| Deployed native guest journey                      | Passed on a fresh simulator with normal launch arguments and the real API: select `leaves`, receive `leaf`, open optional sign-in from 收藏词汇, close it and return to the webpage without saving. |
| Account form                                       | iPad light/dark composition inspected. Phone and iPad UI checks passed with the software keyboard explicitly required for both fields, including the largest accessibility size. |
| Signed-in annotation UI                            | Existing definition recovery and vocabulary-save journey passed in both appearances on iPad. |
| Native sharing                                    | PDF and EPUB native share sheets, original filenames, Files actions, reading-position preservation and iPad popover dismissal passed. |
| Native simulator build                             | Successful phone and iPad builds and normal-mode launches with SDK 27.2 and simulator runtime 27.0. The previous CoreSimulator mismatch is resolved. |
| Asset checks                                       | All four final PNGs have alpha; automatic light/dark catalog variants are wired                                                                                           |
| Monochrome artwork                                 | Native sequence-glyph test and the full app emoji-choice check passed after the fix. Only `cmap` and the font header checksum/timestamp changed. |
| Manual UI                                          | [Real guest result on phone](implemented-phone-live-guest.png), [iPad light](implemented-ipad-light.jpg), [iPad dark](implemented-ipad-dark.jpg). The 560 × 900 iPad sheet shows the full meadow. |

The original PDF, bookmark and export failures did not recur in the complete November 2 unit run. That run finished after the MCP tool's five-minute response limit; its completed `.xcresult` was read directly. It exposed one font failure, fixed and rechecked separately. There has not been a second complete unit run after that asset-only fix. The initial iPad native-share UI check used a phone dismissal gesture and failed to close the popover; the test now taps outside the iPad popover and the rerun passed for PDF and EPUB.

Both existing verification simulators were relaunched with empty launch arguments and the real bundled connection after the final UI checks. Their normal Home screens were inspected. No fixture arguments were added to the generated scheme.

The [deployed guest results](deployed-guest-check.json) contain the actual AI results, usage and deployment revision, with no credentials. `LiveGuestReleaseUITests` is opt-in through `LEXIMORY_LIVE_GUEST_TEST=1`; run it on a disposable signed-out simulator. It does not create an account or save vocabulary.

## Remaining release checks

- Allowlist `leximory://auth/callback` and `leximory://auth/callback?flow=recovery` in deployed auth configuration and verify real confirmation/recovery email delivery.
- Publish the complete privacy/retention policy and review AI processor disclosures. Existing unindexed processor/cache histories are not evidence of immediate physical erasure.
- With explicit authorization, create one disposable account and verify deployed Supabase ownership, storage and foreign-key cleanup through Inngest, including lost acceptance responses, retries and final completion. Public guest Redis/AI behavior is verified; installed-SDK deletion adapter tests cannot prove deployed account cleanup.

No live account was deleted for verification. Apple review approval is not guaranteed by these changes. The [decision trail](implementation-decisions.tsv), [data/UX specification](experience.md), and [asset prompts](account-assets.json) record the final choices and the rejected first visual implementation.
