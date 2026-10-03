# Leximory native iOS reading companion

Revision of the attached 2026-10-02 reading-flow migration plan. This document covers design and implementation gates. For current implementation and test results, see the [execution record](verification.md). The findings and verification at the end of this plan describe the original planning review.

## Agreed scope

| Decision | Outcome |
| --- | --- |
| Product | Reading companion for existing accounts |
| Devices and minimum OS | iPhone and iPad, iOS 26+; shared Mac Catalyst target |
| Client state | SwiftUI Observation with injected clients; no TCA |
| Documents | Article/Markdown reading plus existing web-library EPUB/PDF books |
| Word actions | Show embedded definitions, generate contextual word/phrase definitions, save vocabulary |
| Persistence | Preserve existing own-library/shadow-library save behavior; no new learning status |
| Distribution and sign-in | Private TestFlight; email/password and restored sessions first |
| Formatting | Native core formatting and Japanese ruby; readable fallback for unsupported formatting |
| Generation | Incremental definitions; Save becomes available after successful completion |
| Audio | Existing recordings only; background/Lock Screen playback while the source reader remains open; stop when leaving it |

Keep direct imports, review sessions, offline downloads/sync, article editing, whole-article annotation generation, persisted range annotation, vocabulary editing/deletion, purchases, and signup outside this release. Ordinary text selection and contextual phrase lookup remain in scope. Neither requires creating a persisted article annotation.

Saved sessions and local reading position are allowed. They do not imply an offline document store or queued writes. After signout, clear account-scoped content, selection, lookup results, and navigation.

The user subsequently expanded this release to existing web-library ebooks and Mac Catalyst. Ebook contents, saved reading position, bookmarks, contextual lookup, and vocabulary saving share the existing backend; direct file importing remains separate. [DESIGN.md](../../apps/leximory-ios/DESIGN.md) is the maintained visual specification.

## Findings that change the original plan

1. The proposed annotation query/subscription API describes a different product. Current contextual definition generation is a request stream, not a feed of stored token annotations. See [generation](../../apps/leximory/service/text.ts), [definition client](../../apps/leximory/components/comment/index.tsx), and [selection client](../../apps/leximory/components/define/index.tsx).
2. Annotation occurrence, generated definition, and saved vocabulary have different identities. Embedded `{{surface||lemma||definition||etymology||cognates}}` lives inside Markdown. Lexicon records have a library and vocabulary ID, but no text range or proficiency status. See [markup utilities](../../packages/utils/src/comment.ts) and [database types](../../packages/supabase/src/types.ts).
3. Existing auth and authorization resolve Next cookies. Supabase Swift access tokens need verified bearer authentication and an explicit request subject. Calling an existing Server Action from a mobile handler will not supply that subject. See [session client](../../packages/supabase/src/server.ts), [user resolution](../../packages/user/src/index.ts), and [Kilpi](../../packages/service/src/kilpi/index.ts).
4. The database client uses the service-role key. Database reads are not authorization boundaries. Existing access permits an owner or a user who starred a public library. Private, nonowned libraries remain denied, including libraries that were formerly public. The library layout currently differs from that policy; do not silently copy the discrepancy into mobile. See [database client](../../packages/supabase/src/index.ts) and [library layout](../../apps/leximory/app/library/[lib]/layout.tsx).
5. Server Actions contain transport-specific behavior. Quota helpers default to cookie auth and call `updateTag`, which installed Next 16 documentation forbids in Route Handlers. Extract explicit-subject domain operations and keep Next invalidation/redirect behavior in their adapters. See [quota](../../packages/user/src/quota.ts) and the installed `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/updateTag.md`.
6. An ebook's `content` may contain only bookmarks or be empty. Complete books use a separate PDF/EPUB URL. Unsupported books must never appear as complete articles. See [text retrieval](../../apps/leximory/server/db/text.ts).
7. The web reader has a custom dialect, not plain Markdown. It includes definitions, ruby, images, small caps, audio blocks, and LaTeX, plus sanitization and normalization. A plain SwiftUI Markdown initializer does not establish parity. See [web renderer](../../apps/leximory/components/markdown/index.tsx).
8. Current context helpers use the first matching string, which can point at the wrong repeated word. Use actual native selection ranges, not `indexOf`, or a dictionary keyed by word spelling. See [clicked context](../../apps/leximory/components/comment/utils.ts) and [selected context](../../packages/ui/src/define/utils.tsx).
9. The original generic verification commands are unavailable. There are no existing test scripts or CI workflows discovered; `lint` invokes `next lint`. Add actual runner commands and macOS CI rather than claiming those gates already exist.

## Architecture and ownership

Use a SwiftUI app in `apps/leximory-ios`, generated by XcodeGen, with a small Swift package containing the generated API client and portable feature logic. Pin tool and dependency versions and commit the project specification and dependency resolution. Use Swift 6 concurrency checking with a tested compatible toolchain, at least Swift 6.2.

Each feature owns an `@MainActor @Observable` model only where it needs state outside a view. Views use native local state for presentation. Inject API, auth, playback, and time dependencies at the app composition point. Do not add a repository protocol that merely forwards every generated API method. Keep generated DTOs behind a handwritten client that presents operations needed by features.

Keep navigation identifiers typed and content identifiers opaque. Existing text IDs can be NanoIDs; do not assume UUIDs. Use separate library, text, and vocabulary ID types where mixing them would produce a valid but wrong request.

| Location | Responsibility |
| --- | --- |
| `packages/schema` | Shared Zod mobile DTOs and validation, with deliberate exports |
| `packages/api` | oRPC contracts and OpenAPI generation only; no app imports |
| `apps/leximory/server/mobile` | App-local router implementations and explicit-subject services |
| `apps/leximory/app/api/mobile/v1` | Next HTTP adapters, bearer auth, response/error/stream handling |
| `packages/service` | Existing genuinely shared authorization/domain helpers, refactored only where required |
| `apps/leximory-ios` | Native app, feature models, reader/playback bridge, integration and UI tests |

Retain oRPC/OpenAPI for cross-language contract generation, not as a reason to migrate unrelated web actions. Bind contract implementations inside Leximory so `packages/api` never imports an app's private services. Prove the selected generator can represent the actual unions/nullability and stream response before building screens. If that compatibility gate fails, revise the transport choice before implementation spreads.

Apple's generator produces client code at build time. Commit the OpenAPI input and generator configuration; do not commit generated Swift unless a specific tooling limitation requires it. CI checks deterministic OpenAPI regeneration and compiles the generated client. See [Apple Swift OpenAPI Generator](https://github.com/apple/swift-openapi-generator) and [oRPC OpenAPI routing](https://orpc.dev/docs/openapi/routing).

## Native interaction specification

On iPhone, library, texts, and reader navigation use a standard navigation stack and system back gesture. On iPad, use `NavigationSplitView` for library/text/document navigation, adapting to narrow windows. Test column collapse, state restoration, rotation, and keyboard selection. Do not force three visible columns in a narrow iPad window. See [Apple navigation guidance](https://developer.apple.com/documentation/swiftui/navigationsplitview).

Use native lists, toolbars, pull-to-refresh, sheets/popovers, SF Symbols, Dynamic Type, and system materials. Adopt standard iOS 26 control appearance; do not add decorative glass containers to reading content. Use a sheet for a definition on compact layouts and an anchored popover where it fits on iPad. Provide a discoverable accessible Define action in addition to tapping a marked word.

Prototype a read-only `UITextView`/TextKit reader within SwiftUI. It must support selection/copy, typed word actions, attributed spans, and ruby without turning each word into a separate SwiftUI view. This is a contained UIKit bridge, not a second application architecture. A SwiftUI-only reader can replace it if it passes the same selection and accessibility gates. See [Apple UITextView](https://developer.apple.com/documentation/uikit/uitextview).

Single-tapping an embedded definition opens it. Selecting an unannotated word or phrase exposes Define alongside standard Copy. Preserve system selection handles and paragraph-level VoiceOver reading. Use native selection to handle CJK and phrase ranges; do not tokenize by spaces. Changing definition state must not rebuild the entire reader or reset selection/scroll position.

Support headings, paragraphs, lists, block quotes, emphasis, links, images, inline definitions, ruby, and audio blocks. Unsupported math/formatting gets a readable, visibly identified fallback that retains its content. Audio containers retain their article text even when the recording is missing or inaccessible. Prevent raw annotation metadata or storage IDs from appearing as prose. Validate fallback examples with the user before claiming a document is supported.

## Reader document and occurrence contract

Create a versioned render-document contract produced by an app-local pure server transformation. Preserve the full original Markdown in the response. Produce ordered blocks, their source ranges, exact display text, supported formatting spans, definition spans, and attached audio IDs. Native code maps these blocks to attributed content; it does not duplicate Leximory's marker parsing and sanitization rules in Swift.

Distinguish raw Markdown offsets from displayed-text offsets. Lookup identifies `textId`, content revision, block ID, and a UTF-16 range in that block's canonical display text. Use a deterministic content hash to detect revisions without changing the database schema. Include the render-contract version when deriving block identities. Ruby pronunciation and hidden definition fields must not shift the main text's selection range.

The server derives context and language from the authorized document, checks the range against the requested revision, and rejects invalid/stale ranges. Validate integer bounds and grapheme boundaries explicitly: Foundation range conversion can accept an offset inside an emoji or a combining sequence. Never trust client-supplied user, library destination, language, or unrestricted AI prompt as authorization. Content changes invalidate transient occurrences; they do not relocate by matching a word's spelling. A saved lexicon ID stays separate from the source occurrence.

Do not infer that source preservation alone proves display completeness. Fixtures must show every supported block, beginning/final content, punctuation, repeated occurrences, malformed-marker fallback, ruby, and audio-body text. Server transformation and native rendering need parity tests. Profile long documents before choosing additional virtualization.

## Authentication and authorization

Use Supabase Swift for email/password auth and session lifecycle, with verified secure token storage supported by the pinned SDK. Keep passwords/tokens out of preferences and logs. Send bearer tokens to the mobile API. The API validates the token using the configured Supabase project and derives an explicit subject; decoding an unsigned JWT is insufficient. Do not reuse a cookie fallback for mobile identity.

Represent restoring, signed-out, signed-in, and expired-session behavior explicitly. Protected content appears only after restoration succeeds. Allow one coordinated token refresh for concurrent failed reads. Signout cancels all requests/streams/playback and prevents results from the previous account from entering the next account's state.

The TestFlight cohort needs accounts able to sign in with email/password. GitHub-only accounts require an established password flow before joining this cohort. Password recovery may open the existing web recovery flow. Native OAuth, signup, and public App Store release remain separate work.

Separate pure access policy from cookie lookup and Next `unauthorized()` behavior. Both web and mobile adapters must call the same policy. Mobile failures return typed JSON HTTP errors, not HTML auth redirects. Keep quota evaluation tied to the verified subject, and make cache invalidation valid for the calling adapter.

## Minimal operations

Operation names are proposed contract names, not implemented routes.

| Operation | Responsibility |
| --- | --- |
| `GET /me` | Confirm authenticated identity and the client-relevant quota/account state |
| `GET /libraries` | Accessible libraries and actual archived/shadow metadata |
| `GET /libraries/{libraryId}/texts` | Scoped summaries, format capability, stable pagination |
| `GET /texts/{textId}` | Authorized full source and render document, revision, metadata |
| `POST /texts/{textId}/definitions` | Authorized contextual definition request; incremental response |
| `POST /texts/{textId}/vocabulary` | Save completed definition using canonical lemma and own/shadow destination |
| `GET /texts/{textId}/audio/{audioId}` | Authorized playback descriptor only for an audio block in this text |

Do not add token-annotation CRUD or subscriptions. A completed definition must be validated before saving. The source library owner saves into that library; other authorized readers save into their own language-specific shadow library. The server derives this destination. Preserve annotation definition/etymology fields and canonical lemma normalization. Saving never rewrites the article.

Current saves can create duplicates. Disable concurrent taps for the same save and do not automatically replay a write after an ambiguous network failure. If adding idempotency through existing KV storage, test reservation/replay/failure recovery and document the bounded retention window. Do not claim exactly-once persistence without a durable design that handles a crash after database insert. A schema migration is outside authorized work.

Text pagination preserves `no` ascending with nulls first, then `created_at` descending, and adds a stable ID tie-breaker. Design the cursor for the null/non-null boundary and tied dates. Test beyond the backend row cap. Library ordering is currently unspecified; choose a deterministic mobile order and label it as such instead of claiming exact web-order parity. Keep active/archived/shadow metadata available even if default presentation groups them.

Use stable error codes for unauthenticated, inaccessible/missing, invalid input, stale revision, quota exceeded, unsupported format, and recoverable service failure. Distinguish a quota denial from a transport failure so retries do not cause additional generation charges.

## Streaming and lifecycle

Use a request-scoped incremental definition response. Choose one documented framing format, such as newline-delimited JSON with started/delta/completed/failed frames, and test its compatibility with the generated Swift client. If the generator requires a handwritten stream adapter, keep it isolated and test it against the actual HTTP handler.

Frames identify the request and occurrence. Decode byte chunks incrementally; HTTP chunk boundaries do not align with UTF-8 characters or JSON records. A cache hit still produces the same successful terminal contract. Save is enabled only after a completed, validated definition. HTTP errors occur before streaming starts; errors after streaming starts require a terminal failure frame.

Cancellation, switching selections, document revision changes, navigation away, and signout invalidate the request. Request generations prevent late delivery from changing the current definition. Do not automatically retry generation after headers or deltas have arrived. Cache keys include language, accent, relevant prompt/version, and context. Preserve the existing no-charge cache-hit policy deliberately; validate input and authorization before cache lookup. Charge the verified subject once for a cache miss under the chosen request retry policy.

## Audio addition

Play saved article audio only. Existing `:::audioId` blocks reference MP3 recordings and have no word timestamps. Do not promise synchronized word highlighting. Audio generation, recording, and downloads are deferred. Existing audio is not tied to a content revision, so an edited passage may have an older recording; this release cannot claim text/audio synchronization.

Authorize the source text and confirm `audioId` belongs to a parsed block before returning a signed playback descriptor. Existing `service/audio.ts` retrieval has no authorization and must not be exposed directly. Keep storage path selection server-side. Short-lived URLs must be refreshed through the same authorized operation; never log or persist them as permanent content identifiers.

Use AVPlayer and one injected playback controller shared across reader blocks, with one active recording. Play/pause, seeking, loading/error states, and accessibility are required. Configure background audio capability and an AVAudioSession playback category. Publish title, elapsed time, duration, and playback state through MPNowPlayingInfoCenter; register play/pause/seek commands through MPRemoteCommandCenter. Activate the audio session when playback begins. Handle interruptions, route changes, unplugged headphones, completion, and activation failure. Do not resume after an interruption unless both the system and the user's prior playback intent permit it.

Stop playback when navigation dismisses the source reader or selects another text, and on signout. Clear Now Playing state, remote-command handlers, and observers at that boundary. Backgrounding or locking the device while the source reader remains the active destination continues playback. Definition sheets, rotation, and iPad column adaptation do not count as leaving the reader. Drive this from navigation identity and scene state, not an unconditional view `onDisappear` hook. No app-wide mini-player is included.

Return URL expiration in the playback descriptor. Start with a one-hour mobile TTL and renew only through an authorized text-scoped request; test expiry during seek and background playback. Signed URLs cannot provide immediate revocation before expiry. Missing assets show an unavailable state without hiding article text or offering generation.

## Delivery sequence and required tests

### Gate 0: design and prerequisites

The interview decisions are recorded above. Validate representative sanitized article fixtures for all supported languages, ruby, images, malformed definitions, and audio sections. Request representative long-content fixtures if they are unavailable locally; do not claim to have measured production's largest text. Install full Xcode on the development/CI machine before Simulator gates. No schema edits or live Supabase mutations during discovery.

### Gate 1: native reader and playback feasibility

Build a fixture-driven native reader before the auth/screens scaffold grows. Prove second-occurrence selection, UTF-16 mapping and boundary validation, ruby, Dynamic Type, VoiceOver paragraph order, copy/select, iPad popover/column adaptation, and first/final sections. Audio tests cover signer authorization and block membership, missing recordings, section switching, seek bounds, expiry, interruptions, route changes, background/Lock Screen controls, and stopping on navigation/signout. Verify definition sheets and iPad adaptation preserve playback. Record real measurements for the long fixture on a named device/build. If the renderer fails these gates, revise it here.

### Gate 2: backend boundary and generated client

Write automated tests for verified bearer auth, wrong project/expired token, absence of cookie fallback, policy parity, owner/public-starred/private cases, inaccessible text IDs, and library/text scope mismatch. Inject database/auth/AI dependencies so tests make no live writes. Test exact quota boundaries and route-compatible invalidation.

Add schema/OpenAPI generation and generated Swift decoding tests for the actual optional/null/union/error variants. Regenerate twice and compare OpenAPI bytes. Compile the real streaming call site and run handler-to-Swift stream fixtures, including split multibyte characters, split JSON frames, cache hits, terminal failure, and cancellation.

### Gate 3: sign-in to reader

Implement session restoration, typed navigation, library grouping, complete pagination, and full-document loading. Swift Testing covers restoration success/failure, coordinated refresh, signout while requests are pending, stale account results, safe deep-link continuation, loading/empty/retry states, list order, and unsupported ebook states.

UI tests use XCTest/XCUITest. Verify password autofill and secure entry, no protected-screen flash, iPhone back gesture, iPad split navigation, narrow windows, rotation, keyboard access, and session restoration after relaunch. Deep links resolve typed library/text destinations, recheck authorization, and never accept an arbitrary return URL.

### Gate 4: definitions and vocabulary save

Test repeated words, phrases, emoji, decomposed accents, CJK, source/display mapping, ruby, content-revision mismatch, new selection during generation, navigation/signout cancellation, cache language/accent separation, exhausted quota, and completed-only Save.

Server tests prove own versus shadow destination, canonical lemma normalization, inaccessible source denial, caller-forged destination denial, and no article mutation. Swift tests cover duplicate-tap suppression and ambiguous save outcome without automatic replay. If idempotency is implemented, add actual concurrent reservation/replay/crash-boundary tests.

### Gate 5: TestFlight readiness

Run deterministic API generation, contract tests, Leximory typecheck, portable Swift tests, XcodeGen, Simulator build, and iPhone/iPad UI tests. Add a macOS CI job and explicitly named test scripts. Complete a real-device audio/selection/accessibility smoke check. Record fixtures, device/OS, results, and known unsupported formatting. Provision signing and App Store Connect for the agreed private cohort; uploading is a separate execution step from this plan review.

## Tests added during this review

[Current annotation-contract tests](../../apps/leximory/tests/ios-reading-contract.test.ts) exercise the existing public `@repo/utils/comment` helpers and existing editor audio serialization. They cover multilingual markers, invalid basic markers, canonical lemma saving, repeated source occurrences, preserving surrounding/final content when projecting annotation surfaces, and audio section order/body/definition preservation. The projection is a test of the marker helper, not a test of the full web/native renderer. Audio serialization tests do not test playback or URL authorization.

[Swift offset probes](probes/Tests/ReadingOffsetTests/ReadingOffsetTests.swift) test Foundation range conversion for emoji, combining marks, CJK, and the second repeated occurrence, and demonstrate why conversion needs additional grapheme-boundary validation. They are feasibility checks for the offset contract, not evidence that a native reader exists or is correct.

```sh
pnpm --dir apps/leximory exec tsx --test tests/ios-reading-contract.test.ts
pnpm --dir apps/leximory run check-types
swift test --package-path docs/native-ios/probes
```

Current markup validation is permissive and has a different field limit from extraction. These tests do not claim it is a strict mobile input validator. Define and test a strict mobile schema at the API boundary without silently changing historical content handling.

## Verification record

- Existing Leximory typecheck passed before changes and after all TypeScript tests were added.
- All 13 TypeScript contract tests passed, including final-section and audio serialization tests.
- All five Swift Testing tests passed, with ten cases including parameterized fixtures. The installed Command Line Tools have mismatched PackageDescription interfaces and Testing plugin discovery issues; tests ran with the isolated, documented [local workaround](probes/README.md). The ordinary `swift test` command did not pass on this installation.
- Full Xcode is absent. No iOS app build, Simulator run, native UI test, live Supabase operation, or audio device test has run.

## References consulted

- Local grilling, SwiftUI expert, Swift Testing, TypeScript, and writing skills, plus repository AGENTS.md and installed Next 16 route/updateTag documentation.
- [SwiftUI Observation](https://developer.apple.com/documentation/observation), [UITextView](https://developer.apple.com/documentation/uikit/uitextview), and [NavigationSplitView](https://developer.apple.com/documentation/swiftui/navigationsplitview).
- [Apple Swift OpenAPI Generator](https://github.com/apple/swift-openapi-generator), [oRPC OpenAPI routing](https://orpc.dev/docs/openapi/routing), and [Supabase Swift password authentication](https://supabase.com/docs/reference/swift/auth-signinwithpassword).
- [AVPlayer](https://developer.apple.com/documentation/avfoundation/avplayer), [AVAudioSession](https://developer.apple.com/documentation/avfaudio/avaudiosession), [MPNowPlayingInfoCenter](https://developer.apple.com/documentation/mediaplayer/mpnowplayinginfocenter), and [MPRemoteCommandCenter](https://developer.apple.com/documentation/mediaplayer/mpremotecommandcenter).

No additional plugin installation was necessary for this design review. iOS execution must use an available Xcode/Simulator toolchain when implementation begins.
