# Browser experience verification

Verified locally on 2026-10-13. The signed-in root now uses the shared browser workspace. The implementation includes resource history, persistent bottom controls, animated Home actions, inline native folders, EPUB/PDF import, in-page Defuddle article import, website folder preferences, and the annotation queue and completion reveal.

Webpage declarations and Defuddle language metadata are not used for language routing. Authorized resource/folder context supplies known language; otherwise the existing Jev resolution applies.

## Results

- Native simulator build succeeded after the final title and row-hit-area fixes.
- Swift package tests: 58 passed.
- Targeted native browser/model and UI checks: 16 passed. They cover sequential history, stale async results, completion while reading or away, Home keyboard actions, inline folders, real in-page Defuddle extraction, article import, unread completion, and ebook contents.
- Mobile API tests: 109 passed, including folder ownership, vocabulary-warehouse exclusion, invalid bodies, and rejection of an extra webpage language hint.
- Leximory TypeScript check passed.
- Direct iPad checks passed for Home, inline folder expansion, full-row ebook opening, contents/chapter selection, Back/Forward, preserved chapter position, and persistent controls. Automated iPad checks stalled waiting for SpringBoard idle; they are not recorded as passing.
- The broader native run passed 65 of 66 tests. The unchanged `ReaderNativeTests.coverEmojiUsesBundledMonochromeGlyphsIncludingSequences` failed because ☀️ fell back to AppleColorEmoji rather than LeximoryNotoEmoji.

## Live-account deployment

Deploy the updated mobile API before using folder creation/rename and edited bookmark titles with live accounts. No database schema changes, live Supabase writes, deployment, or physical-device installation were performed. Import and annotation flows were verified with isolated simulator transport and local webpage fixtures, not production accounts.

Verification simulators are returned to normal launch mode; fixture data is removed by the normal root initialization. Existing account data is preserved.

## Typography and layout follow-up

The Home wordmark uses Garamond; Chinese labels use the bundled serif cascade. Large screens show a horizontal row of square cards, while phone and keyboard layouts remain stacked. Home uses the supplied blue, pink, and cream pastels with tinted dark variants. My Bookmarks uses the 640 pt article width cap; saved resource emoji appear in rows, folder previews, the annotation queue, and the address capsule. Account values anchor to each card’s bottom with compact padding, and the native passkey screen is removed.

The follow-up simulator build succeeded. Light/dark Home, iPad square cards, phone Home and keyboard actions, the capped bookmarks list, and account card alignment were checked directly in Simulator. These visual edits did not rerun the earlier full test suites. Both verification simulators were restored to normal account mode.

## Simplification follow-up

Home cards are restrained to a centered, overlapping group with near-paper washes and thick pastel frames. Continue-reading text matches the linked title size. Unavailable navigation controls disappear. Bookmark search, filled folder icons, dot-separated metadata, the extra paste button, and destination shortcuts in More are removed. Native empty-state headings explicitly use Leximory typography. Address editing uses a single dimming layer; Cancel prevents queued focus restoration. Browser chrome is outside the content navigation container. The original EPUB/PDF toolbar and controls remain.

Two updated iPhone UI tests passed: recent-reading Back/Forward/Home and address cancellation, and the original ebook contents control. The reported navigation failure did not reproduce with the original simulator fixtures; the control placement and keyboard-focus changes address potential interference, and the updated paths pass. The first follow-up test run exposed a folder accessibility identifier masking child resource IDs; that was corrected before the passing run. The final result is recorded in `test_sim_2026-10-13T13-24-17-952Z_pid3226_6a949cff.log`.

An additional check exposed an unresponsive one-item native menu on Home. That redundant menu has been removed: More on Home and ebooks opens annotation activity directly, while websites/articles keep contextual actions. This final adjustment receives a build check; further interaction verification is left to human review at the user’s request.

## Control hit areas and native reader actions

Browser controls now explicitly include their full rendered tap shapes. Cancel uses a framed label inside its button; the previous shape was applied before the frame. The navigation regression check now taps at 15% of each control’s width to cover touches away from the glyph. Article audio and Share are restored at the top, the redundant ebook return button is omitted in the shared workspace, and folders use native DisclosureGroup styling/default animation. Address editing blurs underlying content by 3 pt beneath the existing light dimming layer.

The targeted edge-tap navigation/Cancel regression test passed in `test_sim_2026-10-13T13-51-40-629Z_pid3226_580110e6.log`. The subsequent build passed after adding shared-bar animation on destination changes, closing address editing when the keyboard hides, an explicit 保存方式 section header, removal of the dynamic definition destination label, destructive trash coloring, and the account avatar/fallback. Visual review of these final refinements is left to human review rather than another broad test run.

## Recent webpage and clipboard Home action

Home restores the most recently opened webpage per account, including its saved-link identity where applicable. Clearing browsing data removes that record. The wordmark uses Leximory Browser when it fits. During address editing, the existing first card changes to 跳转到剪贴板 without changing its appearance. Only its explicit tap reads the clipboard; valid HTTP(S) website links open, and invalid contents show a brief native-glass notice and VoiceOver announcement. The simulator build passed; clipboard permission behavior is left for human verification on iOS.
