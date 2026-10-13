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
| Library eyebrow | Raleway | 12 pt, 1.2 tracking |
| 我的文库 | Bundled Chinese serif | 30 pt |
| Library/text titles | EB Garamond with CJK cascade | 20–36 pt by role |
| English/French prose | Libre Baskerville | 18 pt phone, 20 pt wide |
| Chinese prose | ChillDuanHeiSong | Bundled Regular and Bold OTF; choose Bold explicitly |
| Japanese prose | ChillDuanHeiSongProJP | Bundled Regular OTF, with ruby |
| Interface text | Raleway with serif CJK cascade | 12–17 pt |
| Chinese navigation/topics | Bundled Chinese serif | 12–14 pt topics |
| IPA/code | Source Code Pro | 85% of prose |

Use real prose italics. Scale with Dynamic Type; titles wrap and containers grow. Garamond is for display titles. English interface labels use Raleway; Chinese labels use the bundled serif cascade, including controls and dialogs. Keep native label sizes, primary/secondary colors, spacing, and dialog structure. Never apply the green theme to text labels. IPA and code retain their specialized faces.

Interface hierarchy uses regular weight and primary/secondary label colors. Headings, including empty-state headings such as 选择文库, use primary color. Supporting descriptions, metadata, and library language labels use secondary color. Preserve authored bold prose and dictionary headwords.

`LeximoryLayout` owns measurements: 20 pt page inset, 640 pt article/library measure and 880 pt gallery measure. Library cards use 46 pt outer and 32 pt inner corners. Phones use compact text rows with newspaper thumbnails. Wide galleries show a featured cover and up to five supporting entries in landscape or three in portrait. Archived libraries are compact chips.

Article covers and wrapping titles scroll with the prose. Phone titles use 28 pt Garamond, wide titles 32 pt. A 22 pt toolbar title appears after the full title scrolls away. Article paper continues through the bottom safe area.

## Navigation and account state

Browser navigation uses a Safari-compatible identity and mobile content on iPhone, desktop content on iPad and Mac. Keywords search Bing; URLs open directly. Preserve webpage cookies and verification frames. Load failures use a Liquid Glass surface above the page.

网页选项 offers 清除浏览数据 with destructive confirmation. Clear all browser history, remembered pages, cookies, and website storage, leaving an empty browser. Preserve Leximory account data, bookmarks, vocabulary, and website library choices.

Vocabulary saves use the saved resource’s folder, then a configured website folder, then the respective language warehouse. Never resolve language when authorized resource or folder metadata supplies it. Do not trust webpage language declarations or Defuddle language metadata. Remove the destination selector from the definition tray. New website navigation evaluates its own rules. The article import switch 本网站总是存于此文件夹 also governs vocabulary routing and future import preselection; future imports still show review.

The browser fills its safe areas with the webpage’s theme color, falling back to WebKit’s page background. Track color changes without shifting the webpage or controls.

iPhone and iPad use one browser workspace with no navigation tabs. Fresh launches show Home without opening a URL; returning to an existing session preserves the current resource. Back and Forward share a sequential history across Home, My Bookmarks, websites, articles, and ebooks. Folder expansion, dialogs, and page turns do not create history entries. Restore destination state on return and replace the forward branch after a new visit.

Keep a compact translucent bottom bar with resource identity, Back, Forward, Home, and More. Websites have a separate magic-colored save button. Native WebKit gestures work within webpages; screen-edge and address-bar gestures cross resource boundaries without stealing ebook page turns. Keep reading content through the bottom edge and accommodate audio and ebook controls above the bar. More owns contextual ebook controls and article audio. System sheets may cover the bar.

Home uses Garamond for Leximory and the bundled serif CJK cascade for Chinese labels. Cards use soft blue `#DFE7FD`, pink `#FDE2E4`, and cream `#FFF1E6`, with darker tinted surfaces and lighter borders in dark appearance. Home shows the logo, Leximory, and three tilted, colorful bordered cards: 浏览网页、我的书签、打开电子书. On large screens, the cards form a horizontal row of squares; compact screens stack them. Address editing morphs the cards into compact actions above the native material overlay; keep them fully colored and interactive. Use explicit 粘贴并打开. Respect Reduce Motion, large text, and narrow landscape windows.

My Bookmarks is capped at the 640 pt article measure. Resource icons use the text’s saved emoji in the bundled monochrome face, with a resource symbol only when no emoji is available. My Bookmarks uses native grouped rows with inline expandable folders and indented resources. Keep recent reading, search across collapsed folders, archive categorization, native context menus, and folder creation/renaming. App-authored UI calls libraries 文件夹. Keep folders language-specific, with muted metadata and · separators. Account is available from Home and More.

Scope cached content and recent reading to the account and library. On a library switch, show that library's cache or loading scene immediately. Superseded requests cannot replace it. Show cached content before refreshing; see [offline storage](../../docs/native-ios/offline-sync.md).

Handle downloading, caching, synchronization and recovery automatically. Preserve editing actions and disable them when unavailable. Show an error only when the requested action cannot complete.

Use the lawn and cat together for spacious loading scenes, at 80% width up to 560 pt and constrained by height. Compact loading states use standard spinners. Respect Reduce Motion and inactive scenes.

## Reading and learning

Selection menus offer 猫忆查 before Copy, remove unrelated native lookup, sharing, replacement, find, and Select All in learning mode; and add 🖍️荧光笔 for ebooks. Keep actions beside the selection with native icons. Capture ebook context and location before dismissal.

Static annotations highlight on touch-down and open on touch-up, anchored to the selected line. Use a fitted popover on iPad and tray on phone, with a comfortable 400 pt measure and 24 pt insets. Keep actions below the definition. Article highlights are short sage-yellow strokes behind the lower glyph area, separately fitted to each line.

Dynamic definitions overlay the reader in a top-anchored card. Content determines height, capped at 78% of the viewport. Use 36 pt corners and the web's drawer easing. Drag upward or tap outside to dismiss; downward dragging resists. Streaming must preserve the reading viewport and offset.

Annotation content uses prose typography, bold headwords and muted 释义/语源/同源词 labels. Defaults are 16 pt phone/17 pt iPad body and 20/22 pt headwords. Keep bookmark, editing and dictionary actions. Saved definitions reopen for editing with the canonical 词条、释义、语源、同源词 fields.

Dynamic lookup opens the tray immediately with a spinner and 正在理解语境; language resolution stays inside the same loading state. Spinner labels omit ellipses. The shared save control morphs through saving, a brief disabled checkmark confirmation at full contrast, and editing. Keep the ink circle and paper icon fully colored even when disabled; success has a short scale-and-turn flourish and symbols slide without fading. Reduce Motion changes symbols immediately. Browser destinations align with the prose in muted text, without a destination selector. Omit implementation explanations and empty website-setting sections.

Audio playback uses a compact glass capsule, at most 420 pt wide, with playback, title, elapsed time, scrubbing and dismissal. Allow scrolling past the last prose line beneath it. Seek on scrub release.

## Ebooks

EPUB currently uses bundled epub.js; PDF uses PDFKit. EPUB reading options offer 白纸、灰纸、暖纸、米纸 as diagonally split circular previews of their light and dark variants. Theme names are for VoiceOver only; omit visible captions and automatic-switch explanations. Remember the selected theme and follow system appearance; color changes preserve pagination. Preserve CFI positions, private bookmarks, selection context, authorization and quotas. Ebook bookmark content is not the complete book text.

A center tap toggles controls without reflow. Running titles are centered and fade when controls appear. Use separate circular glass buttons for back, contents, bookmarks, settings and sharing, with 44 pt touch targets. Titles use 18 pt serif; page labels use 15 pt interface text. EPUB labels include chapter and page; PDF labels give page X of Y.

Empty outer gutter taps turn one page in reading order without animation. Swipes use flat, interruptible slides that track the finger and ease into completion or cancellation. Forward turns move the current page away; backward turns bring the previous page over it. The underneath page moves a short distance with proportional shading. Visible text stays stable throughout motion. Preserve the left-edge back gesture and Reduce Motion.

Horizontal EPUB prose defaults to 18 pt phone/20 pt wide with 1.6 leading, a 560 pt maximum column measure and at least 44 pt outer gutters. Use two columns only in landscape windows at least 760 pt wide. Japanese always uses one spread, vertical pagination, bundled Japanese serif, ruby, publisher indentation and paragraph spacing. Its separately remembered defaults are 24 pt and 1.7 leading. Preserve emphasis, poetry, images and tables. Resizing and reading settings retain reading position. Selection excludes ruby pronunciation and stays within its paragraph or line.

PDFs scroll vertically and offer fit-page/fit-width. Reserve 24 pt below EPUB and 36 pt below PDF, with 8 pt beneath page labels. Contents, bookmarks and settings use paper popovers on iPad and fitted sheets on phone. Short lists fit their content; long lists scroll. Dismiss outside or with the system gesture.

Bookmarks use spaced quote cards with chapter names or PDF page numbers. Show and highlight saves immediately, then reconcile the result. Failed saves remove the pending bookmark and announce a brief error. Reading-position sync failures stay silent.

## Importing and vocabulary

Remove the corpus entrypoint and retain quiet 已存词汇 access in More. Website import runs bundled Defuddle in an isolated world inside the loaded page. The native review offers 导入并预注释全文 by default, or 存为链接书签; both show an editable title, folder selection, and 本网站总是存于此文件夹. Full-text mode adds a safe Markdown preview and a focused 编辑全文 screen. Use the shared native folder selector and one primary action. Full-text import opens the article immediately while annotations prepare.

Ebook import starts with the native EPUB/PDF picker, then a folder-selection sheet with the filename and optional title edit, then opens the reader. Preserve the 4.5 MB limit. Cancellation creates nothing; failures retain selection. Prevent resubmission when a mutation result cannot be confirmed.

Track article annotation activity across destinations and foreground sessions. More shows a small dot for pending work and a numbered badge for newly ready articles not yet opened. Opening the menu does not acknowledge completion. Opening the article does. Reveal newly completed highlights across the visible text without changing reading position; respect Reduce Motion.

已存词汇 is a collection screen with Chinese date groups and centered word chips: two columns on phone, three or four on iPad. Words open fitted definitions with an explicit edit action. Shared-library words and welcome annotations remain read-only. Native omits lottery and story controls.

## Verification

Check phone and iPad widths, portrait/landscape, dark appearance, long titles and Dynamic Type. Verify selection, bookmarks, real horizontal and Japanese books, and supported offline actions. Mac Catalyst also needs keyboard, resizing and lifecycle checks. Fixtures are for automated verification; hand off the real app in normal account mode. Database mutations and device installation require authorization.

## Account

账号 preserves the web settings page's profile header, daily LexiCoin claim, balance, subscription, AI 词点额度 and AI 语点额度, monthly vocabulary calendar, English accent, profile edits and learning-progress sharing. Display only the integer part of used quotas; keep fractional usage in the API and quota accounting. Use the Shanghai calendar for activity and daily claims.

Use native navigation, segmented preferences, a photo picker, edit sheets, sharing and destructive confirmations. Plan comparison opens in a native sheet and checkout uses the existing billing service. Account summaries are cached within the account's reading store; editing stays visible and is disabled offline. Keep each summary value at the bottom of its card with compact padding; quota reset information stays beside its value. The native account page does not expose passkeys.
