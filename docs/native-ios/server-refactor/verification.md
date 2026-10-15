# Verification results

The refactor is complete in the workspace. The server uses native Next.js route files and named operations, with no Hono dependency or custom production path dispatcher.

| Check                                             | Result                                                                    | Evidence                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------ |
| Baseline mobile server tests                      | 117 passed                                                                | `/tmp/leximory-hygiene-baseline-tests.log` |
| Final mobile server tests                         | 154 passed, 0 failed                                                      | `/tmp/leximory-hygiene-tests.log`          |
| Full repository type checking                     | All 3 app tasks passed                                                    | `/tmp/leximory-hygiene-repo-types.log`     |
| Source contract, generated OpenAPI, native routes | 42 operations in 39 route files agree                                     | `/tmp/leximory-hygiene-route-check.log`    |
| Negative consistency checks                       | Stale OpenAPI and an incorrect route export both rejected, files restored | `/tmp/leximory-hygiene-guard-negative.log` |
| Real local Next.js endpoints                      | All 42 return private typed 401 without credentials                       | `/tmp/leximory-hygiene-live-routes.log`    |
| Native core tests                                 | 70 tests in 14 suites passed                                              | `/tmp/leximory-hygiene-swift-tests.log`    |
| iOS simulator app build                           | Build succeeded                                                           | `/tmp/leximory-hygiene-ios-build.log`      |
| Prettier                                          | Formatting applied and check passed                                       | `/tmp/leximory-hygiene-format-check.log`   |

The server suite includes authorization and ownership, protected vocabulary, completed-definition provenance, quota failures, bounded Unicode inputs, file signatures and size limits, malformed provider output, review forwarding, account operations, required retry identities, concurrent Shortcut retries, and a failed-generation retry that debits quota once. Native Shortcut tests include a store-backed client recovering from a lost network response.

The temporary local server was stopped after verification. No app was installed, fixture session launched, database schema changed, or live account/provider mutation performed. Server tests inject external adapters; the live smoke check verifies real framework entrypoints and stops at authentication. Production latency and real-account end-to-end saving were not measured.

## Independent review

Reviewed by `gpt-5.6-sol`. Findings about store-backed native retry, overlapping Shortcut retries, failed-generation quota recharging, account test coverage, and stale-contract detection were resolved and regression checked. The reviewer found no remaining code blocker. The requested transcript marker was absent from the supplied session file, so the reviewer used the diff, tests, and logs and did not inspect unrelated conversations.

Earlier decision-log rows record intermediate checkpoints and combine some claims under one pointer. The final rows separate each check and supersede the intermediate verification status.

## Run again

- `pnpm --dir apps/leximory run test:mobile`
- `pnpm --dir apps/leximory run check:mobile-routes`
- `pnpm exec turbo check-types`
- `swift test --package-path apps/leximory-ios/Core`
- `pnpm --dir apps/leximory exec next dev --port 3101`, followed in another terminal by `pnpm --dir apps/leximory run smoke:mobile-routes`
- `pnpm format <edited supported paths>` and `pnpm format:check <edited supported paths>`

The Swift app build uses the existing Xcode project and the iOS Simulator destination. Regenerate the project from `project.yml` if no generated project is present.

## Static-route regression correction

After deployment, the user reported that requests and sign-in failed. The shared boundary incorrectly required `context.params` to exist. Installed Next.js passes `params: undefined` on static routes, so authenticated `/me`, `/libraries`, `/account`, and other static operations returned 400. Native sign-in authenticates with Supabase and then loads `/me`, making that failure appear as sign-in failure.

The original test adapter supplied a promise of `{}` for static routes. The real-route smoke check sent no bearer credentials and returned before the broken parameter parsing. Those checks did not verify the authenticated framework boundary.

The boundary now normalizes absent params to `{}` and its type matches that runtime shape. The adapter passes undefined for static routes. A regression test failed with 400 before the fix. All 155 existing server tests pass after it. The real Next.js regression is now part of the default mobile suite, bringing it to 156 tests. `test:mobile-runtime` starts an isolated real Next.js server and verifies authenticated static GET/POST, authenticated dynamic params, and an unauthenticated rejection without any account, database access, or production test route. That integration test passes. Leximory type checking passes.

Evidence: `/tmp/leximory-static-route-regression-before.log`, `/tmp/leximory-static-route-regression-after.log`, `/tmp/leximory-static-route-next-runtime.log`, and `/tmp/leximory-static-route-types.log`. This correction is server-side and needs server deployment. It does not require a native client rebuild.
