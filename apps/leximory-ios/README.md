# Leximory for iOS

This is the native browsing and reader feasibility build from `docs/native-ios/plan.md`. It uses local sanitized fixtures in a Library → Texts → Reader journey. Custom sage library cards and illustrated text covers use the web display typography, with native navigation, menus, sheets, and popovers. Live sign-in, libraries, contextual generation, vocabulary saving, and production recordings are not connected yet.

## Open and run

Requirements: full Xcode, an iOS 26 or newer Simulator runtime, and network access for the first XcodeGen download. The generator script pins and verifies XcodeGen 2.44.1.

```sh
apps/leximory-ios/scripts/generate-project.sh
open apps/leximory-ios/Leximory.xcodeproj
```

Choose the Leximory scheme and an iPhone or iPad simulator. Generated projects, downloaded tooling, build products, and test result bundles are ignored. Edit `project.yml` and regenerate to change project settings.

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

Display fonts and their licenses are bundled under `App/Resources/Fonts`. They load locally without a network request.

The bundled tone is a local diagnostic playback fixture. It does not implement audio generation. The forest fixture reuses Leximory's existing web asset. Neither fixture requires a Supabase write.

## Before advancing the feasibility gate

Check VoiceOver paragraph order, custom Define actions, ruby pronunciation placement, large accessibility text, iPad popover anchoring after scrolling, keyboard selection, and narrow-window column adaptation. Test background playback, Lock Screen commands, interruption recovery, unplugging headphones, and descriptor expiry on a real device. Simulator automation is not sufficient evidence for those device behaviors.

Review the visibly identified math and malformed-definition fallbacks with the user before claiming format support. Record remaining work in `docs/native-ios/verification.md`. Follow the plan's backend and authentication gates before replacing fixtures with account data.
