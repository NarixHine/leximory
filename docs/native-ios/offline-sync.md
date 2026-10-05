# Native Japanese ebooks and offline reading

The iOS, iPadOS, and Mac Catalyst app renders cached content before refreshing from the existing mobile API. No web-client or database behavior changes are required.

## Japanese EPUBs

The reader follows the trusted web implementation in `packages/ui/src/epub-reader/index.tsx` and the web ebook digest component: Japanese uses `vertical-rl` with inline `ltr` direction. These styles are installed through the EPUB spine hook before epub.js measures its pagination axis, then reinforced in the native prose stylesheet. Publisher horizontal or RTL styles cannot override the Japanese layout. Bundled Japanese typography retains ruby alongside the base text.

Swipe right to advance and left to return. Left Arrow advances Japanese pages; Right Arrow returns. Contents, selection, bookmarks, appearance changes, and resizing retain CFI-based navigation. Cancelled curl previews do not publish reading positions. PDF keeps its continuous layout.

`--fixtures --ebook-fixtures` includes an original two-chapter Japanese EPUB with ruby and conflicting publisher styles. Rebuild it with `python3 apps/leximory-ios/scripts/make-japanese-fixture.py`.

## Local storage and synchronization

`LocalReadingStore` owns one backend/account partition in Application Support. It stores the account, complete library/text/vocabulary collections, canonical article documents and annotations, article images, ebook descriptors, and EPUB/PDF files. Authentication stays in the existing Keychain storage. Cache files use hashed names, SHA-256 integrity checks, atomic writes, a versioned manifest, a 512 MiB budget that evicts downloaded content before browsing indexes and preserves the account snapshot, backup exclusion, and iOS file protection. Corrupt entries are discarded and fetched again when connected.

`AccountSession` restores the cached authenticated account without waiting for token refresh. Collection and reader views hydrate local snapshots and revalidate in the background. `NativeSync` refreshes on foreground entry, connectivity recovery, and the account screen's manual sync action. It polls every five minutes while active and retries unavailable servers every twenty seconds. Inactive scenes cancel sync. Downloads run in batches of three, with an 80 MiB ebook limit and an 8 MiB image limit. Concurrent identical API GETs share a request; mutations and definition streams never do.

Collections are committed and reconciled only after every page succeeds. Failed pagination preserves the previous snapshot. Completed collections remove deleted items; access rejection removes the rejected library or text and its ebook files. Local version guards prevent an older refresh from overwriting a confirmed archive, word edit, or reading position. Confirmed online changes update the local snapshot. Unchanged responses avoid rewriting content. Ebook bytes are reused only when their saved object URL matches the current descriptor, ignoring expiring signing parameters.

The account screen reports saved books, storage size, the last complete sync, and incomplete/storage failures. Text rows identify offline availability. A quiet footer identifies offline read-only mode. Cached article annotations, vocabulary definitions, ebook contents, and existing bookmarks remain readable. Lookup, saving, editing, importing, archiving, bookmarks, position writes, and audio require connectivity; there is no offline mutation queue. The API middleware also blocks requests before authorization when offline, covering actions already open when connectivity disappears.

Sign-out or confirmed authentication expiry deletes the active partition and account-specific recent access. The closed store rejects late responses so old tasks cannot repopulate another account's cache. A server outage preserves the session and cached reading.

## Verification and limits

Portable tests cover persistence, account/backend isolation, integrity, eviction, deletion reconciliation, failed pagination, stale position races, inaccessible content, offline mutation rejection, and GET coalescing. Native WebKit tests use phone, portrait tablet, and landscape tablet sizes to verify the bundled renderer, vertical pagination, ruby, UTF-16 selection, appearance changes, and cancelled/committed turns. UI tests cover Japanese RTL gestures, contents, rotation, and reopening a live account/article/EPUB with networking disabled.

Run `swift test --package-path apps/leximory-ios/Core`; run the Leximory scheme tests in Xcode for native and UI coverage. Live reopening requires `LEXIMORY_TEST_EMAIL` and `LEXIMORY_TEST_PASSWORD` in the test runner environment and the configured backend. Debug `--offline` blocks API access and connectivity restoration; `--ebook-read-only` suppresses live book writes. Credentials are never committed.

Only downloaded content is available offline. The finite cache can evict content; rows update their availability accordingly. Audio is not downloaded. Authorization changes made while disconnected take effect on the next successful server refresh. Synchronization uses the existing paginated API rather than a new server delta protocol. Physical-device performance, signed distribution, and DRM support remain outside these simulator and unsigned Catalyst checks. See `verification.md` for recorded results and existing unrelated regressions.
