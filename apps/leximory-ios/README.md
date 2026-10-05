# Leximory for iOS

Japanese EPUBs support vertical right-to-left reading with ruby and RTL page turns. Account-scoped local storage opens downloaded articles, annotations, vocabulary, images, and ebooks before network refresh; offline access is read-only. See [native sync architecture](../../docs/native-ios/offline-sync.md) for lifecycle, storage, verification, and limits. Debug `--offline` exercises cached reopening without network access.

This native iOS build follows `docs/native-ios/plan.md`. It preserves Library → Texts → Reader navigation with sage collection cards, illustrated covers, native sheets and popovers, and bundled display typography. Chinese onboarding adapts the web hero's slogan, watercolor lawn, and wandering white cat. Reduce Motion, Low Power Mode, inactive scenes, and the sign-in tray pause the lawn animation.

The app connects to the mobile API for sign-in, libraries, articles, contextual definitions, vocabulary saving, and recording descriptors, existing EPUB/PDF books, private bookmarks, reading positions, and archive preferences when `App/Resources/Connection.json` is configured. Automated live checks have verified the supplied test account’s sign-in, real library/article browsing, full reader loading, restored sessions, and article-link navigation. One explicitly authorized live generation and vocabulary save has also passed; the test saved “weekend” to the account’s English vocabulary collection. `--fixtures` runs the local browsing fixtures; add `--ebook-fixtures` for EPUB/PDF samples, or `--catalog-layout-fixtures` for a nine-text collection to verify iPad rail limits. Add `--tab-fixtures --remote-gallery-fixtures` to exercise the production text-gallery and reader routes with delayed in-memory API responses, without an account or network traffic. Debug `--ebook-read-only` prevents book position, bookmark, and lookup writes during live reading checks. Debug `--onboarding` previews the welcome and sign-in tray without restoring an account.

## Open and run

Requirements: full Xcode, an iOS 26 or newer Simulator runtime, and network access for the first XcodeGen download. The generator script pins and verifies XcodeGen 2.44.1.

```sh
apps/leximory-ios/scripts/generate-project.sh
open apps/leximory-ios/Leximory.xcodeproj
```

Choose the Leximory scheme and an iPhone or iPad simulator. The same scheme also builds for My Mac (Mac Catalyst). Read [DESIGN.md](DESIGN.md) before changing visual styles. Generated projects, downloaded tooling, build products, and test result bundles are ignored. Edit `project.yml` and regenerate to change project settings.

## Fixtures and checks

The TypeScript server transformation produces the canonical display text and UTF-16 spans. Swift decodes these blocks rather than parsing Leximory markers again. Rebuild fixtures after changing the contract or source fixture:

```sh
pnpm --dir apps/leximory mobile:fixtures
pnpm --dir apps/leximory test:mobile
pnpm --dir apps/leximory run check-types
swift test --package-path apps/leximory-ios/Core
```

Run the Leximory scheme's tests in Xcode for UIKit and UI coverage. Swift Testing covers the portable contract and native rendering. XCUITest covers library/text/reader navigation, dark appearance, final content, selection menus, definition presentation, missing recordings, playback across a sheet, and stopping playback on navigation. Two UI cases use a default iPhone fixture coordinate and explicitly skip on iPad. The remaining UI cases also run on iPad.

The long fixture is synthetic: 800 passages, 1,603 blocks, and about 90,000 displayed UTF-16 units. It does not represent the largest production article. `longAttributedDocumentPreservesEveryBlock` logs decoding and attributed-text construction times without asserting a machine-dependent time limit.

Display typography uses bundled EB Garamond for Latin display, ChillDuanHeiSongPro for Chinese serif text, ChillDuanHeiSongProJP for Japanese titles, and LXGW WenKai Screen for the library heading, hero slogan, and topic pills. Libre Baskerville supplies English/French reading and definition prose. Raleway supplies Latin controls with Chinese serif fallback; Space Mono and Source Code Pro supply the web’s monospace roles. Chinese and Japanese serif roles use the supplied Regular Chill OTF fonts. Font licenses are in `App/Resources/Fonts`. Sizes scale with Dynamic Type; app-authored controls use the bundled interface faces. The iPhone welcome uses a generated portrait adaptation of the original web lawn.

The bundled tone is a local diagnostic playback fixture. It does not implement audio generation. The forest fixture reuses Leximory's existing web asset. Neither fixture requires a Supabase write.

## Before advancing the feasibility gate

Check VoiceOver paragraph order, custom Define actions, ruby pronunciation placement, large accessibility text, iPad popover anchoring after scrolling, keyboard selection, and narrow-window column adaptation. Test background playback, Lock Screen commands, interruption recovery, unplugging headphones, and descriptor expiry on a real device. Simulator automation is not sufficient evidence for those device behaviors.

Review the visibly identified math and malformed-definition fallbacks with the user before claiming format support. Record remaining work in `docs/native-ios/verification.md`. Follow the plan's backend and authentication gates before replacing fixtures with account data.


Article links use `leximory://read/<textId>` or `leximory://library/<libraryId>/<textId>`. Incoming links wait for sign-in and resolve their real library through the authorized document API. Universal-link deployment remains separate; the parser also accepts canonical web links from the configured backend origin. Sharing and password recovery use the existing web routes. A final rejected token clears account content and playback; network failures retain the session. Definition lookup failures expose Retry.

The opt-in `testLiveAccountBrowsingAndRestoration` UI case requires `LEXIMORY_TEST_EMAIL` and `LEXIMORY_TEST_PASSWORD` in the test runner environment and a local backend on port 3001. It expects the test account’s “AI, With The Atlantic” library and performs no vocabulary write or AI generation. Do not commit credentials.

`liveGeneratedDefinitionAndOneVocabularySave` additionally requires `LEXIMORY_TEST_WRITE=1`. It consumes definition quota and inserts one item. Run it only after explicit authorization; never enable it for the normal suite or CI, and do not rerun after an ambiguous save failure.

Ebooks open with controls hidden. Tap the center to reveal navigation, contents, reading settings, and PDF progress; swipe horizontally to turn pages. EPUB settings adjust prose size, line spacing, and paper appearance. Long-press book text to use 查词 or 收藏 in the system selection menu. Publisher executable content is removed before EPUB rendering.
