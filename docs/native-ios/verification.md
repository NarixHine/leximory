# Native iOS execution record

Updated October 3, 2026. This records implementation and evidence against `plan.md`. The full delivery plan is not complete. The current app supports authenticated article and ebook reading, contextual definitions, vocabulary saving, and library archiving against the development backend on port 3001.

## Environment

Full Xcode 27.0, build 27A266a, Swift 6.4. Deployment target iOS 26. Tests currently use the iOS 27 Simulator runtime on iPhone 18 Pro and iPad Pro 13-inch M5. The minimum iOS 26 runtime and physical devices still need validation.

The Build iOS Apps plugin drives Simulator builds and tests through XcodeBuildMCP. The SwiftUI expert and Swift Testing skills guide the native implementation. The browsing redesign applies Design Partner, frontend-design, and UI polish guidance, with consultation of the redesign and high-end visual design skills. The original Leximory components and the user's Family reference take precedence over generic skill presets. No database schema changes have been made. One explicitly authorized live generation and vocabulary save is recorded below; subsequent checks are read-only.

## Implemented

- A strict versioned render-document schema exported from `@repo/schema/mobile`.
- A pure server Markdown transformation with original source, revision hash, canonical display blocks, source ranges, typed spans, and validated occurrence ranges.
- Sanitized multilingual fixtures with repeated words, emoji, combining characters, CJK, Japanese ruby, formatting, an image, audio bodies, malformed markers, and visible fallbacks.
- A SwiftUI fixture app with Library → Texts → Reader navigation, four sample libraries, six complete reading fixtures, native iPhone back navigation, and an adaptive iPad split view. The route path is shared across size-class changes.
- A read-only TextKit 2 reader with native selection, Copy and Define, marked-word actions, viewport paragraph accessibility, and pronunciation labels for visible ruby spans.
- Shared AVPlayer playback with cancellation generations, a serialized audio session, seeking, expiration handling, interruption and route observers, Now Playing, and remote commands. These are implemented paths, not proof of every device behavior.
- Canonical pale sage library cards and compact archived collections, responsive text covers and topic pills, bundled script-aware typography with tuned tracking and leading, and Dynamic Type. White reading pages, native selection, reference-based definition sheets, and anchored iPad popovers are implemented. The Recordings menu appears only for documents with audio. See `design.md` for the latest direction, source audit, contrast measurements, and Family reference.
- A shared pure library access policy used by the existing web Kilpi adapter, stateless mobile bearer verification through the configured Supabase Auth server, and typed private JSON errors. These foundations now protect the connected mobile HTTP routes.

## Automated evidence

The server suite passes 45 tests. Twenty cover shared access policy, credential parsing, absence of cookie fallback, the real Supabase SDK against a fake Auth endpoint, provider rejection, and private typed errors. These tests do not verify the live provider's cryptographic implementation. The portable Swift suite passes seven tests, including parameterized Unicode boundaries and the full long fixture. Leximory's prescribed `check-types` command passes. Repository-wide `pnpm exec turbo check-types` also passes all three configured app checks.

Native unit tests validate attributed-text parity, actual second-occurrence selection, TextKit 2 mode, long-document completeness, missing recordings, and navigation identity. UI tests exercise the library/text/reader journey, switching collections, dark appearance, opening/final content, long-reader rotation, unavailable recordings, marked definitions, native Copy and Define, playback through a sheet and stopping on back navigation, large accessibility text, and the visible ruby passage. Browsing screenshots also cover the largest accessibility text category. All six document fixtures regenerate identically.

The browsing redesign's final iPhone regression passed 16 tests with no failures or skips, with result bundle `test_sim_2026-10-03T03-37-07-215Z_pid3070_920c3d46.xcresult`. After the font resource repair, the iPad full suite passed 14 tests with two explicit skips for iPhone coordinate cases; its selection test opened a definition popover. Final iPad browsing, dark, large-text, and native-unit checks passed ten tests without skips after contrast and composition refinements. Do not treat the full suite's skipped cases as device coverage. The iPad result bundles are `test_sim_2026-10-03T03-31-24-040Z_pid3070_a526ad6d.xcresult` and `test_sim_2026-10-03T03-34-54-832Z_pid3070_a93248ad.xcresult`.

XcodeBuildMCP retains build logs, screenshots, and `.xcresult` bundles under its Leximory workspace in `~/Library/Developer/XcodeBuildMCP/workspaces/leximory-9af2a1acd391/`.

## Long fixture measurement

The synthetic fixture has 800 passages, 1,603 blocks, 1,600 embedded definitions, and 91,959 UTF-16 units after native layout separators. Paragraph spacing now belongs to the attributed paragraph style, with one newline between blocks. One Debug iPhone 18 Pro Simulator measurement recorded 0.037897 seconds to decode and validate and 0.164864 seconds through attributed-text construction. This is one construction sample, not a frame-rate measurement, device benchmark, or production maximum.

The initial long-reader UI test timed out while accessibility traversed the full TextKit 1 document. TextKit 2 and viewport-scoped paragraph accessibility fixed that test. A later marked-word test exposed disappearing accessibility objects; retaining paragraph element identities fixed their empty labels and frames. Visual inspection also caught missing ruby pronunciation after scrolling. Visible UIKit labels now render the pronunciation, and the text view uses its designated initializer so Swift subclass storage initializes correctly.

## Remaining gates

| Gate | Status and remaining work |
| --- | --- |
| 0: design and prerequisites | Xcode and source audit complete. Fixtures are synthetic. User review of math and malformed-definition fallbacks is pending. |
| 1: reader and playback | Automated reader and fixture playback checks are in place. The mobile recording descriptor authorizes text access and parsed audio membership before signing. VoiceOver traversal, keyboard selection, narrow iPad windows, advanced ruby cases, device audio, background/Lock Screen, interruption/route behavior, and expiry still need verification. |
| 2: API and generated client | HTTP handlers, oRPC/Zod OpenAPI generation, Apple generated Swift client, typed errors, bearer middleware, deterministic cursors, bounded NDJSON parsing, and handler-to-client stream tests are implemented. Portable Swift tests and injected server tests pass. Live authenticated boundary verification and stronger database cursor/adapter coverage remain. |
| 3: account reading flow | Keychain-backed Supabase sign-in/restoration, live library and article pagination, archived libraries, account tab, and authorized document loading are wired to localhost:3001. Chinese hero-based onboarding opens a native sign-in tray. Supplied test account sign-in, account restoration, real browsing/reader loading, and custom-scheme article-link navigation pass live checks. Broader session lifecycle coverage remains. |
| 4: definitions and saving | Contextual NDJSON generation, no-charge cache hits, atomic quota admission, occurrence-bound completion receipts, server-derived vocabulary destinations, and native save states are implemented. One explicitly authorized live generation and vocabulary save passes. Additional destination-adapter coverage remains. |
| 5: delivery | Contract/client generation and simulator CI workflow added. Production configuration, signing, physical-device verification, and TestFlight remain. No build has been uploaded. |

The diagnostic tone proves local player integration only. Account signout clears playback before removing the account view. Production URL renewal uses the authorized text-scoped API. The initial automated checks made no live database mutation or AI generation. The one later explicitly authorized generation/save is recorded below.

## Onboarding and system typography verification

The web hero source was inspected before building the native welcome. Its original lawn, night lawn, and white-cat sprite are reused. The system-only typography experiment was superseded by the user restoring the bundled display fonts. `@ScaledMetric` owns display sizing; Chinese serif text uses Noto Serif SC; WenKai is confined to the hero slogan and the Latin wordmark uses EB Garamond. Noto Serif SC substitutes for the web’s LXGW Neo ZhiSong Screen while preserving the font roles.

The welcome opens and dismisses the native sign-in tray on iPhone and iPad. Both devices pass the largest accessibility text category in dark appearance with the primary action reachable. The iPad pair passed without skips in `test_sim_2026-10-03T04-49-01-026Z_pid3070_dadda9f1.xcresult`; the iPhone accessibility case passed in `test_sim_2026-10-03T04-48-24-476Z_pid3070_0cc411e4.xcresult`. Earlier Copy checks expected the wrong localized label; captured UI hierarchy identifies the actual system action as “拷贝”. The corrected full iPhone regression passed 17 tests without failures or skips in `test_sim_2026-10-03T04-51-02-040Z_pid3070_01c7b27d.xcresult`.

## Required user input

The plan requires reviewing the visible format fallbacks before claiming support. A preview screenshot and the native definition sheet have been provided for that review. Only simulators were connected during device discovery. The physical-device audio checks also need the user's available device and iOS version. Neither pending item authorizes or requires a database schema change.

The final contrast adjustment also passes both iPhone onboarding cases in `test_sim_2026-10-03T04-55-37-836Z_pid3070_f2e270d3.xcresult`. That earlier system-only build contained no bundled TTF/OTF fonts; the subsequent font restoration is verified separately below. OpenAPI regeneration produced identical SHA-256 results on two consecutive runs. App dependency pins are retained outside the generated Xcode project and restored by the project generator.


The portrait-lawn and font-role correction passes eight focused iPhone tests with no failures or skips in `test_sim_2026-10-03T06-46-27-366Z_pid7529_fbe8f616.xcresult`. These verify all four bundled faces, native reader checks, the sign-in tray, and onboarding at the largest accessibility size in dark appearance. A subsequent simulator build/run succeeded; visual inspection confirms the complete portrait lawn fits above the primary action at the default text size.


## Canonical typography and minimum reading flow

The hero now uses built-in small caps, a true italic gradient AI accent, semibold neutral-gray Chinese text, tighter tracking, and lowered feature underlines. Native tests verify the registered regular/italic/semibold faces and that the cat’s facing vector aligns with its actual displacement in both directions while turning before movement.

The supplied account passes authenticated library → texts → reader navigation and relaunch restoration. The first live run selected the empty vocabulary collection and correctly displayed the empty state; the corrected test selects its article library. Ten focused checks passed in `test_sim_2026-10-03T07-07-57-229Z_pid7529_9b303fbd.xcresult`. After adding authorized custom-scheme article navigation, eight checks passed in `test_sim_2026-10-03T07-12-41-020Z_pid7529_a4408071.xcresult`. Neither run issued a vocabulary write or generated a definition.

Final 401 handling reports the actually rejected token, clears the matching account session and playback, and never retries a POST. Terminal Supabase refresh errors require sign-in; network and cancellation errors do not. The portable middleware checks passed with 13 tests before the additional route-parser case. Universal-link deployment, physical-device checks, live generation/save verification, signing, and TestFlight remain outside these verified results.


The full iPhone regression passed 21 tests with no failures or skips in `test_sim_2026-10-03T07-15-04-663Z_pid7529_7028711e.xcresult`, and the updated portable Swift suite passed 14 tests. After explicit permission for one generation/save, the opt-in native check passed in `test_sim_2026-10-03T07-22-28-632Z_pid7529_2b2f95d9.xcresult` (nine native checks). It generated “weekend” and received vocabulary ID `0d02ca30-7c04-4b9a-bada-4ec253a22b61` in destination library `54b8b3f7-35ff-41a1-aff5-2305dbadd4d6`. This is the one authorized persistent test item; it has not been deleted or recreated.

A subsequent live reading run exposed an intermittent loader cancellation in the conditional view roots. Account, catalog, texts, and reader async tasks now attach to stable `ZStack` containers. Session cleanup also waits for an in-flight refresh before clearing Keychain storage, and the login form appears after that cleanup completes. Verification of this refinement is recorded below.


After the stable-container and refresh-cleanup fixes, the final focused run passed ten tests with no failures in `test_sim_2026-10-03T07-25-33-250Z_pid7529_e65056bb.xcresult`. The opt-in write test was deliberately disabled (one skip) to avoid generating or saving a second item. This run verifies live browsing, article links, final reader content, font registration, heading alignment during cat movement, and native selection/playback checks.


The final build/run succeeds and leaves the configured simulator signed in against the local Next.js backend on port 3001. The combined development command could not download/run Inngest and QStash under the shell sandbox, so Next.js was started separately with approval. The synchronous mobile reading/definition/save flow above did not require those local job emulators.


## Signed-in canonical design pass

The local web app was opened on port 3001 and signed in with the supplied account. Libraries, Texts, the live reader, and an existing annotation were inspected alongside the original source and supplied screenshots. Design Partner and the Build iOS Apps SwiftUI UI Patterns plugin guided this pass; canonical Leximory styling takes precedence over their generic examples.

Libraries now uses the web heading copy and WenKai role, layered pale sage cards with the actual library names, and compact archived/shadow collections under 已归档. Invented card symbols, counts, opening footers, and duplicate headings were removed. Texts uses the web's phone cover sequence, centered editorial titles, and compact WenKai topic pills; wider iPad layouts use the featured cover and supporting rows. Flat icon-only navigation exposes the implemented library and account destinations. iPad initially uses the full Libraries canvas, then presents its library sidebar and Texts detail when a collection opens.

All app-authored sans text now uses bundled Raleway with script-aware cascades. Chinese serif faces are Noto Serif SC Medium (500) and SemiBold (600); the 400-weight face is removed. EB Garamond, its true italic, WenKai, Space Mono, and Source Code Pro retain their respective web roles. Native registration tests verify the bundled PostScript names. OS-owned controls and SF Symbols retain native rendering.

The annotation tray uses the supplied reference's pale surface, bold serif headword, muted labels 释义/语源/同源词, serif Markdown, bracketed IPA, circular bookmark action when saving is available, and language-specific external dictionary link. Phone trays fit their content and support native drag dismissal; iPad uses an explicitly 480-point anchored popover. The popover receives the reader's size class because its own presentation environment reports compact width.

Final iPhone regression: **22 passed, 0 failed, 2 deliberately skipped** in `test_sim_2026-10-03T08-28-25-759Z_pid7529_20fa0ca1.xcresult`. The skips are the iPad-only presentation check and the opt-in persistent write check. This run covers authenticated browsing/restoration, archived grouping, account quota, article links, reader navigation, long-document rotation, native selection, annotations, playback, ruby, dark appearance, accessibility text sizes, onboarding, font registration, and cat direction.

Final iPad checks: **11 passed, 0 failed, 1 write-check skip** in `test_sim_2026-10-03T08-20-42-235Z_pid7529_20e1971b.xcresult`; **4 passed, 0 failed** for the completed catalog, dark appearance, accessibility sizing, and live journey in `test_sim_2026-10-03T08-23-22-425Z_pid7529_45272673.xcresult`; **1 passed, 0 failed** for the final anchored annotation and rotation in `test_sim_2026-10-03T08-26-40-436Z_pid7529_3225f6ef.xcresult`. Full-resolution test screenshots were inspected and copied to the chat's visualizations directory as `libraries-canonical-iphone.png`, `texts-canonical-iphone.png`, `annotation-canonical-iphone.png`, `libraries-canonical-ipad.png`, `texts-canonical-ipad.png`, and `annotation-canonical-ipad.png`.

This pass performed no additional definition generation or vocabulary writes. Physical-device audio, minimum iOS runtime, signing, production configuration, and TestFlight remain unverified delivery gates.


## Liquid Glass, ebook migration, and Mac Catalyst

`apps/leximory-ios/DESIGN.md` now owns the native color, typography, spacing, and interaction conventions. The web remains canonical. Navigation uses native Liquid Glass with sage selection and muted supporting icons. Library title panels follow the web's top/bottom padding, and 已归档 uses the border color rather than the illustration color. Active cards expose the actual recently opened title and an independent archive button. Recent history stays local and is scoped per account. Archive/unarchive updates the existing user preference with authorization, idempotency, and conditional concurrent-update protection. Its server handler is tested against injected stores; the real account's archive preference was not mutated.

Reader titles wrap in scrolling content. Phone reader covers are reduced to 196 points; wide layouts recompose the heading beside the artwork. English and French prose now uses bundled Libre Baskerville with its real italic face, while Garamond remains a display face. Initial lookup loading is centered, and 查词 has its own native inline selection-menu group. Chinese app copy uses full-width punctuation and the full ellipsis `……`. Source reading content is preserved.

Existing EPUB and PDF library items now open through authorized signed assets. EPUB uses the web's epub.js version with CFI contents navigation, position restoration, selection context, and bookmarks. PDF uses PDFKit with contents/page navigation, position restoration, and exact selected-range context. Both expose the shared definition/save flow and existing-table synchronization routes. Fractional ISO 8601 asset-expiry dates are handled by the generated client's date transcoder; a portable regression covers a realistic signed ebook descriptor. Publisher paragraph font rules no longer override the native prose font. Reader controls wait until the book is ready.

The supplied `OfAIpjTrE9hx` library was opened in the authenticated web and through the local mobile API. Its five books include three EPUBs and two PDFs. The read-only iPhone test opened the actual Histories EPUB, navigated to BOOK I, verified rendered prose, and opened the actual Histories V PDF through page three. Reading-position and bookmark writes were disabled for this verification. No additional quota was consumed, vocabulary saved, or book position modified.

Current portable checks pass 69 server tests, 15 Swift Core tests, and Leximory's prescribed `check-types`. The iPhone regression passed 21 cases with two annotation-tap failures and two deliberate skips; paragraph accessibility frames now cover every wrapped line, and both failed annotation/audio cases pass in the focused rerun `test_sim_2026-10-03T10-00-02-097Z_pid7529_0890a54a.xcresult`, alongside the real ebook test. This is focused repair evidence, not a new all-green full-suite run.

On iPad, library/text navigation, EPUB contents/rotation, and PDF navigation passed in `test_sim_2026-10-03T10-03-22-887Z_pid7529_d3ae800b.xcresult`. Its annotation tap initially missed the marked word after the font change. The corrected tap passes anchored popover opening, sizing, dismissal, and landscape rotation, with a final PDF check in `test_sim_2026-10-03T10-10-15-035Z_pid7529_dfe88067.xcresult` (two passed, no failures or skips). Screenshots confirm the popover anchors to the actual word.

The final unsigned Mac Catalyst build succeeds for both arm64 and x86_64. This establishes compilation, not verified Mac runtime behavior. Keyboard interaction, Mac window resizing, signing, minimum-runtime and physical-device checks, production mobile-route deployment, and TestFlight remain. Direct book importing, DRM support, and offline downloads are outside the completed existing-library migration. Book-position/bookmark persistence and ebook-specific generation/save are implemented and fake-tested, but have not been exercised as additional live writes.


Final live account regression passes in `test_sim_2026-10-03T10-15-32-632Z_pid7529_83e25f4f.xcresult`. An intermittent relaunch link failure exposed a race with the initial catalog presentation. Link loading now waits for the catalog to finish before publishing the reader route. The final real EPUB/PDF test also passes in `test_sim_2026-10-03T10-11-47-737Z_pid7529_f5046104.xcresult`; that earlier bundle still records the pre-fix article-link failure. A subsequent iPhone build/run succeeds.

The final Catalyst app at `/tmp/leximory-catalyst/Build/Products/Debug-maccatalyst/Leximory.app` was launched through the native computer-use plugin. Its Chinese onboarding and sign-in tray appear. This verifies launch and those controls only; authenticated Mac reading, keyboard selection, and window resizing remain to be checked. The app was left open for the user's testing.

Updated full-size evidence in the chat's `leximory-native` visualization directory includes `libraries-glass-iphone.png`, `texts-glass-iphone.png`, `reader-short-cover-iphone.png`, `annotation-baskerville-iphone.png`, `annotation-baskerville-ipad.png`, `reader-landscape-ipad.png`, `real-histories-epub-iphone.png`, `real-histories-pdf-iphone.png`, and `epub-landscape-ipad.png`.


## Book-first reader and cover refinement — October 3

The ebook shell now hides chrome initially, reveals edge controls on a center tap, and exposes 查词/收藏 directly in the native selection menu. EPUB publisher paragraph typography is replaced with bundled Libre Baskerville, 22 pt and 1.8 leading, with size/leading/paper controls preserving chapter position. Publisher executable markup is sanitized before the trusted parent event bridge is enabled. PDFs use the same shell, native selection actions, page swipes, fit controls, and progress slider. No additional live bookmark, definition, or reading-position writes were performed.

Library panels now have 16 pt bottom padding and shorter minimum height; inactive phone tabs retain muted outline glyphs inside the native Liquid Glass bar. Login 取消 is plain. Annotation headwords and body use prose faces. Annotated article words use a low marker stroke, preserving canonical ranges. The wrapping title remains in the cover; a matching opening document heading is omitted without changing selection offsets. The wide title panel uses a subtle shell wash. Every Texts cover uses newspaper rules above brighter animated paper washes derived from the canonical web OKLCH formula.

Portable Core passes 16 tests, including title omission with canonical selection mapping. Native font, reader, playback, and publisher sanitization checks passed; the opt-in write test remains skipped to avoid a second persistent item. iPad rail assertions pass three portrait/five landscape in `test_sim_2026-10-03T12-47-13-535Z_pid7529_d14b5bf2.xcresult`. Full-screen screenshots confirm both orientations; application-bounds screenshots had cropped rotated content and were replaced. The anchored article annotation check passes in `test_sim_2026-10-03T12-43-31-091Z_pid7529_7735b90c.xcresult`. EPUB and PDF native contextual lookup pass on iPad in `test_sim_2026-10-03T12-45-28-192Z_pid7529_6d76f1ea.xcresult`. Disabling WebKit scrolling had prevented native selection; the wrapper now limits overflow while the native scroll view retains text interaction and disables bounce.

On iPhone, both ebook selection menus, reading preferences preserving the chapter, and article highlighter lookup pass in `test_sim_2026-10-03T12-48-34-791Z_pid7529_f7319d29.xcresult`. Its swipe test still records an offscreen accessibility assertion failure even though the screenshot shows the next page; focused verification is recorded below. This is not an all-green full-suite result.


The chapter-page accessibility value now reports rendered EPUB page position. Swipe forward/back, real Histories EPUB navigation, real PDF page-three navigation, and account restoration/link opening all pass in `test_sim_2026-10-03T12-54-21-613Z_pid7529_dd1dadb1.xcresult` (three tests, no failures). Screenshot review confirms inactive phone tab glyphs retain muted outlines and covers use brighter newspaper paper.

The NYT screenshot supplied by the user prompted a smaller phone prose scale: article body 18 pt with 5 pt additional leading, EPUB 18 pt with 1.6 leading; wide layouts retain 20 pt. Garamond remains a display face, Libre Baskerville remains prose. Dynamic Type, ruby clearance, and canonical selection ranges remain. A one-time preference migration replaces the previous 22 pt/1.8 defaults while preserving other explicitly chosen settings.


Final smaller-typography verification: EPUB swipe position, reading preferences, and contextual lookup pass in `test_sim_2026-10-03T12-58-17-523Z_pid7529_80ac868c.xcresult`. Its article tap initially missed the word after reflow. The corrected visible-word tap and real read-only EPUB/PDF checks pass in `test_sim_2026-10-03T13-01-46-361Z_pid7529_09f3a5e7.xcresult` (two tests, no failures). iPad EPUB lookup now asserts the popover opens near the selected paragraph; this and the native reader/font/sanitization suite pass in `test_sim_2026-10-03T13-03-34-176Z_pid7529_99ca8820.xcresult` (11 passed, one deliberate live-write skip). The final unsigned Catalyst build succeeds. Mac authenticated reading, physical devices, minimum supported runtime, and production delivery remain unverified.

Evidence includes `texts-bright-newspaper-iphone.png`, both `texts-bright-newspaper-*-ipad.png` orientations, `reader-subtle-title-panel-ipad.png`, `article-compact-prose-iphone.png`, `real-epub-compact-prose-iphone.png`, and `epub-anchored-lookup-ipad.png` in the chat's `leximory-native` visualization directory.


## Compact phone layout and book controls — October 3, evening

The eight requested refinements are implemented: phone annotation sheets use native corner geometry and measured detents without extra height; article titles use a smaller, tighter phone scale with less topic spacing; the jump-to-end menu item is removed and the web-opening action has a Safari symbol. A brighter, thicker lower-line marker preserves word selection. A secondary Garamond title appears in the toolbar only after the wrapping article title scrolls away. All phone Texts entries are compact rows.

EPUB contents and reading options are anchored paper popovers on iPad, native sheets on phone. Short contents lists size to their entries, the duplicate contents heading is removed, and the paper picker fits in the settings popover. Navigation keeps native glass while chapter/page labels remain plain. The horizontal pan drives a curved snapshot paper turn, including cancellation and a soft settling animation; Reduce Motion skips the paper transform. The left edge remains reserved for return. PDFKit now uses continuous vertical scrolling, preserving native selection, contents navigation, fit controls, and the shared learning menu. PDF accessibility announces page X of Y; EPUB includes the chapter name so a chapter change remains distinguishable when both chapters fit on one page.

Phone compact rows, wrapping header, conditional toolbar title, stronger-marker lookup, EPUB forward/back turns, and PDF contents navigation pass in `test_sim_2026-10-03T13-41-56-790Z_pid7529_1eeddf65.xcresult` (four tests). Ebook selection and preference preservation pass in `test_sim_2026-10-03T13-43-49-375Z_pid7529_64fd740f.xcresult`; its long-reader fixture check initially jumped before layout was ready. Deferred fixture scrolling passes long-document rotation and accessibility sizing in `test_sim_2026-10-03T13-47-27-684Z_pid7529_d6936d82.xcresult`. Normal swipe navigation to the final short-document section passes in `test_sim_2026-10-03T13-53-08-286Z_pid7529_540260a0.xcresult`.

The final real-book read-only phone check, cancelled EPUB drag/committed slow drag/edge return, and continuous PDF scroll plus contents navigation pass in `test_sim_2026-10-03T14-01-31-507Z_pid7529_e667de50.xcresult` (three tests, no failures). The real Histories EPUB and Histories V PDF were opened from the supplied library. All definition, bookmark, and reading-position writes remained disabled. Slow-drag video frames were inspected: the paper bends with the finger, a short drag returns to the same page, and a committed drag advances. The original strip shading showed seams and was replaced with continuous directional shading before this verification.

On iPad, article annotation anchoring/rotation, EPUB contents/rotation, preferences, and PDF contextual lookup pass in `test_sim_2026-10-03T13-50-05-428Z_pid7529_8b09b6e7.xcresult` (four tests). Adaptive popover sizing, the complete reading-options form, and vertical PDF navigation pass in `test_sim_2026-10-03T14-09-43-731Z_pid7529_93ea993c.xcresult`. Its ten native checks pass and the opt-in persistent write check is skipped. That bundle still records a false EPUB position assertion: the next short chapter on iPad also starts on page one. With chapter-aware accessibility position, slow drag cancellation/commit/return, forward/back paging and chrome toggling, and contextual selection pass in `test_sim_2026-10-03T14-14-20-695Z_pid7529_58da28fe.xcresult` (three tests, no failures).

These are focused regression runs, not a fresh all-green full suite. Full-resolution phone and iPad screenshots and a four-second slow-drag clip are saved in the chat's `leximory-native` visualization directory. The final unsigned Catalyst build succeeds for arm64 and x86_64; this pass does not establish authenticated Mac reader runtime or physical-device performance. No additional live learning writes or schema changes were performed.

Final phone confirmation of the chapter-aware position and gesture-recognizer changes passes cancelled/committed drag, edge return, and native contextual selection in `test_sim_2026-10-03T14-17-08-433Z_pid7529_740bfdba.xcresult` (two tests, no failures).


## Annotation geometry and EPUB destination previews — 2026-10-04

Article markers now enumerate tight TextKit 2 standard segments, separately on each wrapped line. Visible segment geometry is cached and invalidated for reflow, typography and image changes. Annotation tags resolve precomputed canonical selections and definitions, avoiding full-document validation and repeated block/span scans on taps. Viewport entry lookup uses a binary search; selection boundary checks remain grapheme-safe but operate on the selected block. Header fitting and attachment discovery no longer repeat on every scroll layout. The saturated marker uses #BDD981 at 45% opacity and a 28%-height lower-glyph band. DESIGN.md records these choices.

The 18 portable Core tests pass. On the synthetic 90k reader, 1,000 final-block selections take about 7 ms on the host; this is not an end-to-end tap latency or physical-device measurement. Phone native/annotation/selection/EPUB checks pass in test_sim_2026-10-04T04-57-56-960Z_pid14199_18236c0c.xcresult (15 passed, one explicitly disabled write test). The new native geometry case verifies that a wrapped annotation has distinct tight line segments and fewer segments after widening, while retaining its canonical occurrence.

The iPad anchored annotation and rotation case passes in test_sim_2026-10-04T05-01-30-041Z_pid14199_a8512199.xcresult. That run exposed two fixture/assertion issues: pagination has a separate accessibility value, and the debug final-document fixture needed to re-anchor after width changes. Native tests and final-document rotation pass in test_sim_2026-10-04T05-05-46-679Z_pid14199_993799ed.xcresult; its remaining pagination assertion assumed a chapter change must change the page number. Both short chapters fit on one iPad page. With chapter-aware pagination accessibility, the final forward/back turn, quiet title/page label, cancelled drag and edge return checks pass in test_sim_2026-10-04T05-09-36-283Z_pid14199_3b8c464f.xcresult (two tests).

EPUB turns now load the destination behind the current paper snapshot at gesture start. Intermediate relocations are withheld from native reading-position state; cancellation restores the origin CFI, and only completion publishes the destination. Snapshot generations prevent stale pages during rapid turns. Recorded iPad frames were inspected and show the destination behind the folding page. Quiet running titles and chapter page counts remain visible when action chrome is hidden. The EPUB shell's bottom reservation decreases from 64 to 28 px. This pass uses local fixtures, without additional live definition, vocabulary, bookmark, or position writes.
