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
