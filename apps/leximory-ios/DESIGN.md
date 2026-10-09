# Leximory on Apple platforms

The web app defines copy, colors, typography and product actions. Use native navigation, selection menus, sheets and popovers. Keep implementation details out of the interface. App-authored Chinese uses Chinese punctuation; imported text keeps its original punctuation.

## Appearance

Use the canonical palette in `apps/leximory/tailwind.config.ts` and its native equivalents in `App/LeximoryTheme.swift`.

| Role | Light |
| --- | --- |
| Paper | `#FFFFFF` |
| Shell | `#F8FAF8` |
| Inset | `#F1F5F1` |
| Border | `#E7ECE7` |
| Marker | `#BDD981`, 45% opacity |
| Illustration | `#9CAEA1` |
| Secondary label | `#9CA8AB` |
| Secondary border | `#D0D6D8` |
| Muted text | `#67787C` |
| Navigation | `#5A715A` |
| Ink | `#192024` |

Dark appearance uses neutral paper `#100F0F`, shell `#18181B`, inset `#27272A`, border `#3F3F46` and ink `#CECDC3`. Paper follows the system. Liquid Glass belongs to navigation, playback and controls; reading content stays on paper. Ebook actions use neutral ink.

Covers retain the web's newspaper rules, artwork and identity-derived paper wash. Draw rules above the wash. Use the bundled monochrome Noto Emoji for cover artwork; prose keeps native emoji.

## Typography and layout

| Role | Face | Default |
| --- | --- | --- |
| Library eyebrow | Space Mono | 12 pt, 1.2 tracking |
| 我的文库 | WenKai Screen | 30 pt |
| Library/text titles | EB Garamond with CJK cascade | 20–36 pt by role |
| English/French prose | Libre Baskerville | 18 pt phone, 20 pt wide |
| Chinese prose | ChillDuanHeiSongPro | Bundled Regular OTF |
| Japanese prose | ChillDuanHeiSongProJP | Bundled Regular OTF, with ruby |
| Interface text | Raleway with script cascade | 12–17 pt |
| Chinese navigation/topics | WenKai Screen | 12–14 pt topics |
| IPA/code | Source Code Pro | 85% of prose |

Use real prose italics. Scale with Dynamic Type; titles wrap and containers grow. Garamond is for display titles. System-owned controls retain platform typography.

`LeximoryLayout` owns measurements: 20 pt page inset, 640 pt article/library measure and 880 pt gallery measure. Library cards use 46 pt outer and 32 pt inner corners. Phones use compact text rows with newspaper thumbnails. Wide galleries show a featured cover and up to five supporting entries in landscape or three in portrait. Archived libraries are compact chips.

Article covers and wrapping titles scroll with the prose. Phone titles use 28 pt Garamond, wide titles 32 pt. A 22 pt toolbar title appears after the full title scrolls away. Article paper continues through the bottom safe area.

## Navigation and account state

Phones use native 文库 and 账户 tabs. Regular-width windows use a library sidebar with the segmented picker inside it and the gallery alongside. Readers push full width and return to the same browser. Put corpus/import actions beside the gallery heading.

Scope cached content and recent reading to the account and library. On a library switch, show that library's cache or loading scene immediately. Superseded requests cannot replace it. Show cached content before refreshing; see [offline storage](../../docs/native-ios/offline-sync.md).

Handle downloading, caching, synchronization and recovery automatically. Preserve editing actions and disable them when unavailable. Show an error only when the requested action cannot complete.

Use the lawn and cat together for spacious loading scenes, at 80% width up to 560 pt and constrained by height. Compact loading states use standard spinners. Respect Reduce Motion and inactive scenes.

## Reading and learning

Selection menus offer 猫忆查 before Copy, retain native Define/Web Search, and add 添加书签 for ebooks. Keep actions beside the selection with native icons. Capture ebook context and location before dismissal.

Static annotations highlight on touch-down and open on touch-up, anchored to the selected line. Use a fitted popover on iPad and tray on phone, with a comfortable 400 pt measure and 24 pt insets. Keep actions below the definition. Article highlights are short sage-yellow strokes behind the lower glyph area, separately fitted to each line.

Dynamic definitions overlay the reader in a top-anchored card. Content determines height, capped at 78% of the viewport. Use 36 pt corners and the web's drawer easing. Drag upward or tap outside to dismiss; downward dragging resists. Streaming must preserve the reading viewport and offset.

Annotation content uses prose typography, bold headwords and muted 释义/语源/同源词 labels. Defaults are 16 pt phone/17 pt iPad body and 20/22 pt headwords. Keep bookmark, editing and dictionary actions. Saved definitions reopen for editing with the canonical 词条、释义、语源、同源词 fields.

Audio playback uses a compact glass capsule, at most 420 pt wide, with playback, title, elapsed time, scrubbing and dismissal. Allow scrolling past the last prose line beneath it. Seek on scrub release.

## Ebooks

EPUB currently uses bundled epub.js; PDF uses PDFKit. EPUB reading options offer 白纸、暖纸、青纸 as diagonally split circular previews of their light and dark variants. Remember the selected theme and follow system appearance; color changes preserve pagination. Preserve CFI positions, private bookmarks, selection context, authorization and quotas. Ebook bookmark content is not the complete book text.

A center tap toggles controls without reflow. Running titles are centered and fade when controls appear. Use separate circular glass buttons for back, contents, bookmarks, settings and sharing, with 44 pt touch targets. Titles use 18 pt serif; page labels use 15 pt interface text. EPUB labels include chapter and page; PDF labels give page X of Y.

Empty outer gutter taps turn one page in reading order without animation. Swipes use flat, interruptible slides that track the finger and ease into completion or cancellation. Forward turns move the current page away; backward turns bring the previous page over it. The underneath page moves a short distance with proportional shading. Visible text stays stable throughout motion. Preserve the left-edge back gesture and Reduce Motion.

Horizontal EPUB prose defaults to 18 pt phone/20 pt wide with 1.6 leading, a 560 pt maximum column measure and at least 44 pt outer gutters. Use two columns only in landscape windows at least 760 pt wide. Japanese always uses one spread, vertical pagination, bundled Japanese serif, ruby, publisher indentation and paragraph spacing. Its separately remembered defaults are 24 pt and 1.7 leading. Preserve emphasis, poetry, images and tables. Resizing and reading settings retain reading position. Selection excludes ruby pronunciation and stays within its paragraph or line.

PDFs scroll vertically and offer fit-page/fit-width. Reserve 24 pt below EPUB and 36 pt below PDF, with 8 pt beneath page labels. Contents, bookmarks and settings use paper popovers on iPad and fitted sheets on phone. Short lists fit their content; long lists scroll. Dismiss outside or with the system gesture.

Bookmarks use spaced quote cards with chapter names or PDF page numbers. Show and highlight saves immediately, then reconcile the result. Failed saves remove the pending bookmark and announce a brief error. Reading-position sync failures stay silent.

## Importing and vocabulary

Every readable library exposes 语料本; owned libraries also expose 导入. Start 创建文章 with URL import, followed by review and 保存 or 生成. Manual entry has a title and blank body; ebook upload uses the native picker and the web's 4.5 MB limit. Use the muted `https://theleximorytimes.com/` placeholder, collapsed generation options, quiet cancellation and one primary action.

语料本 is a collection screen with Chinese date groups and centered word chips: two columns on phone, three or four on iPad. Words open fitted definitions with an explicit edit action. Shared-library words and welcome annotations remain read-only. Native omits lottery and story controls.

## Verification

Check phone and iPad widths, portrait/landscape, dark appearance, long titles and Dynamic Type. Verify selection, bookmarks, real horizontal and Japanese books, and supported offline actions. Mac Catalyst also needs keyboard, resizing and lifecycle checks. Fixtures are for automated verification; hand off the real app in normal account mode. Database mutations and device installation require authorization.
