# Mobile server architecture

To change an endpoint, start at `apps/leximory/app/api/mobile/v1/<path>/route.ts`. Its named export points to the feature's dependency composition under `server/mobile/endpoints`. The matching operation lives in that feature's module. For example, `shortcuts/words/route.ts` exports `saveShortcutWord`, composed in `endpoints/shortcuts.ts` and implemented in `shortcuts.ts`.

Native route files own paths and methods. Feature operations receive an authenticated subject, cancellation signal, route parameters, and diagnostic identity. They return data or a streaming response. They do not select routes, authenticate independently, or implement their own error envelope.

Shared policy has a specific owner:

| Concern                                                       | Owner                                             |
| ------------------------------------------------------------- | ------------------------------------------------- |
| HTTP boundary, bounded body/query parsing, private responses  | `http.ts`                                         |
| Bearer verification                                           | `auth.ts` and `endpoints/verify.ts`               |
| Error codes and messages                                      | `errors.ts`                                       |
| Library/text access                                           | `catalog.ts`                                      |
| Definition generation, quota/cache preparation, NDJSON frames | `definition-generation.ts`                        |
| Completed definition provenance                               | `definitions.ts` and `browser.ts`                 |
| Stable mutation identities and duplicate-safe saving          | `vocabulary-save.ts`                              |
| Atomic quota debit and per-action debit receipts              | `quota-store.ts`                                  |
| Canonical vocabulary serialization                            | `word-format.ts`                                  |
| Personal language warehouse creation                          | `shadow-library.ts`                               |
| Jev language identification                                   | `language-detection.ts` and `browser-language.ts` |
| Shortcut orchestration and retry receipts                     | `shortcuts.ts` and `shortcut-store.ts`            |
| API schemas and operation IDs                                 | `packages/api/src/index.ts`                       |

The Shortcut sends one POST to `/api/mobile/v1/shortcuts/words` with a word and a request ID. The server binds that ID to the word, detects language, checks quota, generates a definition, and saves using the same mutation identity. A completed retry returns its stored result. A retry after an uncertain save uses the cached definition and duplicate-safe save. Different words cannot reuse one receipt identity. Overlapping retries wait for the active owner through an expiring lease. Quota debits are recorded atomically per user/request so failed generation retries do not spend the allowance again. All vocabulary save endpoints require a request ID; the legacy direct-insert path is removed.

To add an endpoint, define its contract and operation, wire it in its feature composition, register its feature in the route generator, and regenerate OpenAPI and native routes. `check:mobile-routes` compares every route export with the generated contract and rejects missing, changed, extra, or obsolete routes. Review endpoints now belong to this contract too.

The test helper reads the actual route files and injects external services into the same HTTP boundary. It is only a test adapter. Production uses Next.js routing directly. Server tests never need a database account. Swift tests verify generated-client request bodies and retry behavior.

Run `pnpm format <paths>` to format edited supported files. The repository pins Prettier and preserves its four-space, single-quote, no-semicolon style. Generated OpenAPI remains owned by its generator.

Account operations now inject an `AccountStore`, matching the other feature factories. `account-store.ts` owns the live billing, auth-admin, storage, and database adapters. This keeps boundary tests independent of credentials. The daily claim retains its existing optimistic concurrency conditions. The avatar size constant lives in the existing credential-free `@repo/env/content` export and remains reexported from configuration.

The route check first regenerates the specification in memory and compares it with the committed OpenAPI. It then checks native route files, so changing only the source contract cannot bypass the consistency gate. `smoke:mobile-routes` checks all entrypoints against a local Next server without sending authentication or making account mutations.
