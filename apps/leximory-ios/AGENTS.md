# Native app experience

- Before every user handoff, remove active fixture launch arguments and fixture-only runtime data, and leave the real Leximory app in normal account mode. Fixtures are for automated verification only; never hand off the fixture catalog or a test app. Preserve real account data and do not install on the user's device unless authorized.
- Read `DESIGN.md` before changing native UI. The web remains the trusted reference; do not change web behavior for a native task.
- NEVER display UI that is not a user concern. Handle downloading, caching, syncing, and connectivity recovery automatically. Do not expose download labels, storage counters, sync timestamps, manual synchronization controls, or redundant read-only indicators.
- Preserve normally available editing buttons and disable them when editing is unavailable, including offline access. Do not substitute status labels or hide the button.
- Article content must flow to the screen's bottom edge. Never add a persistent opaque footer, blank safe-area bar, or infrastructure status banner to the reader.
- Static annotations must highlight immediately on touch-down, open on touch-up, and anchor to the exact tapped word or wrapped line. Use balanced content-sized bubbles with readable type and comfortable spacing; preserve the action row below the definitions rather than moving it into the heading; keep the tap path local and avoid document-wide work.
- PDF zoom actions use aligned full-width rows and consistent touch targets.

- Key native texts views by library identity. On a switch, show only that library’s cached snapshot or its loading scene; reject cancelled and superseded responses. Never reuse the previous library’s rows with a new language/font.
- Size the cat and lawn together to the available page space. Text galleries have no progressive top scroll blur.
- URL import placeholders use muted text, including URL-shaped strings; never inherit system link blue.
- Japanese EPUB changes must consult the web EPUB wrapper, theme, language strategy, selection and bookmark helpers. Preserve publisher paragraph structure, ruby, indentation, and nested contents. Do not re-display a reported CFI during resize; epub.js owns relocation. Test supplied real books as well as synthetic fixtures.
