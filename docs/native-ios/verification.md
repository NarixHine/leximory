# Native iOS execution record

Updated October 3, 2026. This records implementation and evidence against `plan.md`. The full plan is not complete. The current app is a local reader and playback feasibility preview.

## Environment

Full Xcode 27.0, build 27A266a, Swift 6.4. Deployment target iOS 26. Tests currently use the iOS 27 Simulator runtime on iPhone 18 Pro and iPad Pro 13-inch M5. The minimum iOS 26 runtime and physical devices still need validation.

The Build iOS Apps plugin drives Simulator builds and tests through XcodeBuildMCP. The SwiftUI expert and Swift Testing skills guide the native implementation. The browsing redesign applies Design Partner, frontend-design, and UI polish guidance, with consultation of the redesign and high-end visual design skills. The original Leximory components and the user's Family reference take precedence over generic skill presets. No database schema changes or live Supabase mutations have been made.

## Implemented

- A strict versioned render-document schema exported from `@repo/schema/mobile`.
- A pure server Markdown transformation with original source, revision hash, canonical display blocks, source ranges, typed spans, and validated occurrence ranges.
- Sanitized multilingual fixtures with repeated words, emoji, combining characters, CJK, Japanese ruby, formatting, an image, audio bodies, malformed markers, and visible fallbacks.
- A SwiftUI fixture app with Library → Texts → Reader navigation, four sample libraries, six complete reading fixtures, native iPhone back navigation, and an adaptive iPad split view. The route path is shared across size-class changes.
- A read-only TextKit 2 reader with native selection, Copy and Define, marked-word actions, viewport paragraph accessibility, and pronunciation labels for visible ruby spans.
- Shared AVPlayer playback with cancellation generations, a serialized audio session, seeking, expiration handling, interruption and route observers, Now Playing, and remote commands. These are implemented paths, not proof of every device behavior.
- Custom pale sage library cards, a featured text cover with smaller supporting entries, bundled EB Garamond display typography, handwritten Chinese titles, and Mincho-style Japanese titles. White reading pages, native selection, and plain definition sheets remain. The Recordings menu appears only for documents with audio. See `design.md` for the latest direction, source audit, contrast measurements, and Family reference.
- A shared pure library access policy used by the existing web Kilpi adapter, stateless mobile bearer verification through the configured Supabase Auth server, and typed private JSON errors. These are backend foundations; no mobile HTTP routes are connected yet.

## Automated evidence

The server suite passes 45 tests. Twenty cover shared access policy, credential parsing, absence of cookie fallback, the real Supabase SDK against a fake Auth endpoint, provider rejection, and private typed errors. These tests do not verify the live provider's cryptographic implementation. The portable Swift suite passes seven tests, including parameterized Unicode boundaries and the full long fixture. Leximory's prescribed `check-types` command passes. Repository-wide `pnpm exec turbo check-types` also passes all three configured app checks.

Native unit tests validate bundled display fonts, attributed-text parity, actual second-occurrence selection, TextKit 2 mode, long-document completeness, missing recordings, and navigation identity. UI tests exercise the library/text/reader journey, switching collections, dark appearance, opening/final content, long-reader rotation, unavailable recordings, marked definitions, native Copy and Define, playback through a sheet and stopping on back navigation, large accessibility text, and the visible ruby passage. Browsing screenshots also cover the largest accessibility text category. All six document fixtures regenerate identically.

The browsing redesign's final iPhone regression passed 16 tests with no failures or skips, with result bundle `test_sim_2026-10-03T03-37-07-215Z_pid3070_920c3d46.xcresult`. After the font resource repair, the iPad full suite passed 14 tests with two explicit skips for iPhone coordinate cases; its selection test opened a definition popover. Final iPad browsing, dark, large-text, and native-unit checks passed ten tests without skips after contrast and composition refinements. Do not treat the full suite's skipped cases as device coverage. The iPad result bundles are `test_sim_2026-10-03T03-31-24-040Z_pid3070_a526ad6d.xcresult` and `test_sim_2026-10-03T03-34-54-832Z_pid3070_a93248ad.xcresult`.

XcodeBuildMCP retains build logs, screenshots, and `.xcresult` bundles under its Leximory workspace in `~/Library/Developer/XcodeBuildMCP/workspaces/leximory-9af2a1acd391/`.

## Long fixture measurement

The synthetic fixture has 800 passages, 1,603 blocks, 1,600 embedded definitions, and 91,959 UTF-16 units after native layout separators. Paragraph spacing now belongs to the attributed paragraph style, with one newline between blocks. One Debug iPhone 18 Pro Simulator measurement recorded 0.037897 seconds to decode and validate and 0.164864 seconds through attributed-text construction. This is one construction sample, not a frame-rate measurement, device benchmark, or production maximum.

The initial long-reader UI test timed out while accessibility traversed the full TextKit 1 document. TextKit 2 and viewport-scoped paragraph accessibility fixed that test. A later marked-word test exposed disappearing accessibility objects; retaining paragraph element identities fixed their empty labels and frames. Visual inspection also caught missing ruby pronunciation after scrolling. Visible UIKit labels now render the pronunciation, and the text view uses its designated initializer so Swift subclass storage initializes correctly.

## Remaining gates

| Gate | Status and remaining work |
| --- | --- |
| 0: design and prerequisites | Xcode and source audit complete. Fixtures are synthetic. User review of math and malformed-definition fallbacks is pending. |
| 1: reader and playback | Automated reader and fixture playback checks are in place. VoiceOver traversal, keyboard selection, narrow iPad windows, advanced ruby cases, device audio, background/Lock Screen, interruption/route behavior, and expiry still need verification. Production audio signing and membership authorization do not exist yet. |
| 2: API and generated client | Render contract, bearer verifier, typed errors, and shared access policy implemented as foundations. HTTP adapters, text/library scope checks, quota behavior, OpenAPI, generated Swift HTTP DTOs, and handler-to-client stream tests remain. |
| 3: account reading flow | Fixture browsing structure is implemented. Session restoration, sign-in, real library metadata, stable complete pagination, and authorized document loading remain. |
| 4: definitions and saving | Embedded definitions work in fixtures. Live contextual streaming and authorized vocabulary saving remain. |
| 5: delivery | CI, signing, production configuration, physical-device verification, and TestFlight remain. No build has been uploaded. |

The diagnostic tone proves local player integration only. Signout is not available in the fixture app. Its future session owner must call playback stop and cancel all account-scoped work. Production URL renewal must use the authorized text-scoped API rather than the fixture resolver.

## Required user input

The plan requires reviewing the visible format fallbacks before claiming support. A preview screenshot and the native definition sheet have been provided for that review. Only simulators were connected during device discovery. The physical-device audio checks also need the user's available device and iOS version. Neither pending item authorizes or requires a database schema change.
