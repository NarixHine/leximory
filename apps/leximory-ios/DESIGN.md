# Leximory on Apple platforms

Japanese EPUBs follow the web's vertical-rl/ltr pagination with bundled Japanese serif and ruby. Reading direction controls gestures and keyboard paging. Local snapshots appear before network refresh, with quiet offline availability labels and a read-only footer that reserves space below prose. The account screen owns manual sync, storage size, and last-complete-sync status. See `../../docs/native-ios/offline-sync.md` for the native storage lifecycle.

The web app is canonical for copy, content, color roles, and typography. Native iOS navigation, selection menus, sheets, and popovers supply platform behavior. Read this before changing any screen. Do not add copy, decorative symbols, metrics, or destinations without a corresponding product function.

App-authored Chinese text uses Chinese punctuation, including `，、。！？：；（）` and the full ellipsis `……`. Never use three ASCII periods in Chinese loading messages. Preserve punctuation in imported reading content and system-owned controls.

## Color roles

The source palette lives in `apps/leximory/tailwind.config.ts`; native equivalents live in `App/LeximoryTheme.swift`.

| Role | Light | Use |
| --- | --- | --- |
| Paper | `#FFFFFF` | Reading and browsing canvas |
| Shell | `#F8FAF8` | Outer cards and annotation trays |
| Inset surface | `#F1F5F1` | Library title panels |
| Border | `#E7ECE7` | Archive dividers and quiet separation |
| Marker | `#BDD981` at 45% opacity | Saturated, quiet lower-line annotation strokes |
| Illustration | `#9CAEA1` | Artwork and language labels |
| Secondary label | `#9CA8AB` | Archive heading and secondary metadata |
| Secondary border | `#D0D6D8` | Topic pill outlines |
| Muted | `#67787C` | Supporting text and dictionary actions |
| Sage action | `#5A715A` | Navigation tint, links, selection affordances |
| Ink | `#192024` | Editorial titles and prose |

Use the web's neutral dark tokens: paper #100F0F, shell #18181B, inset surfaces #27272A, borders #3F3F46, and warm text #CECDC3. Dark surfaces, controls, and reading markers must not acquire a green tint. Ink belongs to reading content, not selected navigation icons. Let native Liquid Glass own tab and toolbar backgrounds, optical contrast, safe-area sizing, and selected states. Use sage for app navigation and neutral ink for the ebook control cluster. Glass belongs to navigation and controls; paper cards and prose retain the web's quiet surfaces.

Cover paper follows the web's identity-derived OKLCH formula, rather than the library inset token: lightness 0.975–0.993, hue 120–174, and chroma 0.003–0.0075. A slow colored wash and a white wash brighten different areas. Draw newspaper rules above the washes so they stay legible. Preserve variation between texts; do not flatten the collection into a single gray-green surface. Dark paper uses the web's identity-derived neutral lightness.

## Typography

| Role | Face | Sizing and rhythm |
| --- | --- | --- |
| Library eyebrow | Space Mono | 12 pt, tracking 1.2 |
| 我的文库 | WenKai Screen | 30 pt |
| Library and text titles | EB Garamond with CJK cascade | 24 pt phone library card, 20 pt compact text row, 30 pt wide library card, 36 pt featured text |
| English/French prose | Libre Baskerville | 18 pt / 5 pt additional line spacing on phone; 20 pt / 7 pt on wide layouts |
| Chinese prose | ChillDuanHeiSongPro | Supplied Regular OTF |
| Japanese prose | ChillDuanHeiSongProJP | Supplied Regular OTF; preserve ruby pronunciation |
| Interface text | Raleway with script cascade | 12–17 pt by role |
| Topics | WenKai Screen | 12–14 pt, compact pills |
| IPA/code | Source Code Pro | 85% of prose size for inline IPA |

Garamond is a display face. Do not use it for English body text. Use real italics for prose. All roles scale with Dynamic Type; titles wrap and containers grow. Full article and library titles belong in wrapping scrolling content. Once the article title leaves the viewport, a secondary 22 pt Garamond title appears in the toolbar and disappears when the full title returns. Native menus and OS-owned controls retain platform typography where the OS owns it.

## Layout and hierarchy

`LeximoryLayout` owns shared measurements. The page inset is 20 pt and article reading measure is at most 640 pt; library cards cap at 640 pt and text galleries at 880 pt. Cards use 14 pt top and horizontal outer insets, 6 pt beneath their action footer, 46 pt outer radius, and 32 pt inner radius. Title panels have 20 pt top padding and 16 pt bottom padding; their minimum height is 104 pt. Do not add a blank footer to imitate unavailable actions. Archived/shadow libraries form compact chips below a faint 0.5 pt divider in the border color.

On phones, Texts begins with a wrapping collection title in the content. On iPad, the selected library card identifies the collection. Every text cover uses the newspaper gridline background, with a restrained moving wash. Phones use compact text rows throughout, with small newspaper cover thumbnails; there is no featured hero card. Wide windows use a featured cover and at most five supporting entries in landscape, three in portrait; remaining articles continue below. The reader opens with the web's artwork, topic metadata, and a wrapping title. Wide reading covers have a shell-colored title panel, lighter than the artwork panel. Phone article titles use 28 pt Garamond, tightened tracking and an 8 pt gap before topics; wide titles use 32 pt. The header scrolls with the prose; the native toolbar contains navigation, actual actions, and the conditional secondary title.

The phone reader's cover is 196 pt tall. Active library cards expose the actual recently opened text when available and a separate 44 pt archive action. Archived libraries expose the inverse action. Recent reading history is scoped to the signed-in account on the device, matching the web's local history behavior.

## Navigation and learning

On compact-width screens, use the native `TabView` for 文库 and 账户. On regular-width screens, use the native segmented picker inside the library sidebar. Inactive tab symbols are muted outlines; active symbols use sage. Use native toolbars for article navigation and playback. Ebook controls use a separate 36 pt glass back circle and one connected glass capsule for contents, settings, and sharing. Retain 44 pt touch targets without native glass-button padding. Do not rebuild the tab bar or draw a separator around it. 🐈 猫忆查 precedes Copy in its own inline selection-menu group; ebook selections also expose 收藏 there. Preserve the native Define and Web Search actions beside custom lookup. Remove share, find, replacement, and 全选 from the reading selection menu. Keep these actions beside the selected text. Both 猫忆查 and 收藏 have native menu icons, including on Mac. The login tray's 取消 is a quiet text action with no shared glass background.

Annotation trays use a pale surface, bold prose headword, Libre Baskerville body, and muted 释义/语源/同源词 labels. Never use the title face for annotation content. Dynamic annotation loading occupies a compact row until definition text arrives. Saving uses the reference's dark circular bookmark action. Phone sheets adapt to measured content without surplus detent height. The solid action has equal 24 pt left and bottom insets measured from the sheet edge; subtract the bottom safe area from the height detent rather than adding it again. Leave their corner radius to iOS so the sheet follows the screen geometry. Dynamic definitions use a top-anchored rounded card on every device, following the canonical web annotation card. It overlays the reader so streaming never changes the document viewport or reading offset. Children determine its height, starting with a compact loading row; long content scrolls within a 78% viewport cap. Dragging moves the whole card, with upward distance/velocity dismissal and resisted downward movement. There are no manual resize controls or handle strip. Use continuous 36 pt corners and Vaul's 500 ms drawer easing, with reduced-motion support. Keep only the canonical bookmark, vocabulary editing, and dictionary actions. Tapping outside the tray dismisses it before returning to reading. Static definitions use iPad popovers anchored to the selected occurrence; let the system choose the arrow edge so words near the bottom open above rather than collapsing below. Pre-annotated article words use a saturated sage-yellow highlighter stroke at 45% opacity behind 28% of the glyph height. Use tight TextKit segments separately on each wrapped line, without extending to blank line tails or forming a rectangular word background. Cache visible geometry and resolve taps through canonical annotation tags. Highlights retain selection and lookup behavior.

## Importing and editing

Every readable library exposes 语料本; owned content libraries also expose 导入. Start 创建文章 with the web's 网址导入外刊 URL field. Extract title and text, allow review, then offer 保存 without AI or 生成 with the canonical annotation options. 手动录入 and 上传电子书 remain alternatives. EPUB/PDF selection uses the native file picker and the same 4.5 MB limit as the web. Keep forms on paper, with quiet cancellation and one solid primary action.

语料本 follows the canonical date groups and compact, centered word chips: two columns on iPhone, three on narrower iPad layouts, four on wide layouts. Use a wrapping library title and Chinese date labels. Open 语料本 as a full collection screen. A word opens a prose popover anchored to its chip on iPad, adapting to a fitted tray on iPhone; edit is an explicit action inside it. Shared-library words and welcome annotations remain read-only. Omit the word lottery, date-range, draw and story controls on native platforms.

After saving a definition, the pencil opens editing in the annotation tray. Existing saved words can also be reopened from 语料本. Preserve the web's 词条 / 释义 / 语源 / 同源词 fields, original occurrence, and prose typography. Editing does not use the display-title face. Confirm with a circular check action and cancel with the neighboring outline action. On iPad, cap form width and retain the same reading measure.

## Ebooks and Mac

EPUB uses the same bundled epub.js version as the web, preserving CFI navigation and reading positions. PDF uses PDFKit. Authorized book descriptors, user-private bookmarks, and reading-position sync use the existing database tables. Keep article source ranges separate from ebook selection context. Preserve quotas, completed-definition receipts, and library access checks. Do not treat an ebook's bookmark-only `content` as its complete text.

Ebooks open with quiet running titles and page counts; action controls stay hidden until a center tap. EPUB page counts describe the current chapter. A center tap toggles the shared edge controls; horizontal swipes turn EPUB pages with an interactive curved paper transition revealing the destination page underneath; cancelled previews restore the original CFI without syncing a temporary reading position; Reduce Motion changes pages directly. The left-edge return gesture takes priority over page turning. PDFs scroll continuously vertically. Controls overlay reserved margins, so revealing them does not reflow the book. Contents and bookmarks live in a paper tray anchored to the reader actions on iPad, adapting to a native sheet on phone. Reading settings use a sliders icon and a plain paper scroll layout, with neutral ink actions. Ebook controls share a connected glass capsule at the right, with a separate glass back control; the reading-position label is plain muted text. Short contents lists size to their entries; long lists scroll. Paper appearance always follows the system; do not expose a paper picker or honour old manual appearance preferences. EPUB accessibility position includes the chapter as well as its page; PDF announces page X of Y rather than a percentage. EPUB prose defaults to 18 pt on phone, 20 pt on wide layouts, with 1.6 leading and a maximum 560 pt prose measure inside a 616 pt viewport, 24 pt minimum outer margins. Override dense publisher paragraph typography while preserving emphasis, poetry, images, tables, and ruby. Reading options adjust size and leading without changing CFI position. PDFs preserve their typeset page in continuous vertical flow and offer fit-page/fit-width and the same contextual learning menu. Capture selection context and location before the system dismisses its menu.

Mac Catalyst shares the native implementation. Keyboard navigation, window resizing, selection, and app lifecycle require Mac verification beyond compilation. Browser importing, DRM-protected books, signing, and production delivery remain separate work.

## Review gate

Inspect the signed-in web when a layout is uncertain. Verify real long titles, narrow phone widths, iPad portrait/landscape, dark appearance, and accessibility text sizes. Check supported actions and unavailable states, then capture screenshots. Database mutation tests require explicit authorization; fixtures verify ebook rendering without changing the test account.

On regular-width screens, one NavigationStack owns the library browser and reader destinations. Its browsing root contains the library sidebar and text gallery side by side. The native 文库/账户 segmented picker belongs to the sidebar, so it does not reserve vertical space over the text gallery. Readers push at full width and return to the same browser root. Text galleries hide the navigation bar and place corpus/import actions beside the heading. Chinese and Japanese Chill body text uses softer adaptive ink while headings keep their original contrast.

Unarchived libraries use a single column in compact layouts, including iPhone. Two columns require a regular size class and enough gallery width. Archived libraries remain compact chips.

Native section controls and navigation labels use the Chinese serif face. On iPad, omit library names from the text gallery because the selected sidebar card already identifies the library. Featured article titles use tight leading. All emoji use Apple native rendering, including reader font fallback; do not bundle Noto Emoji or replace emoji with web emoji assets.

The ebook running title stays in one centered frame as controls appear. Reader buttons own their complete 44 pt hit rectangles without extra button-style padding. The native contents popover uses a plain list on paper, including its rows and presentation background.

Ebook contents and reading settings dismiss by clicking outside or by the native sheet gesture; do not add a redundant 完成 action. Dynamic annotation trays first commit a measured offscreen frame, then enter from the top.

EPUB page turns use the finger’s starting horizontal/vertical position and vertical travel to shape the fold axis and curvature. Project release velocity before choosing completion or cancellation, and shorten settling for faster releases. Paper backs follow the selected reading appearance. Respect reduced motion.

PDF readers expose page labels without a progress slider. Ebook page labels have 8 pt of bottom breathing room, with reserved EPUB footer space so the label cannot cover the last prose line. Curl tension follows horizontal motion and the fold axis follows vertical motion; a deliberate reverse release cancels the turn.

Annotation surfaces use neutral near-white in light mode and charcoal in dark mode. Tapping outside a dynamic annotation card dismisses it with the same exit animation as dragging it away. EPUB reserves 24 pt below its viewport; PDF reserves 36 pt, keeping prose close to the page label without consuming extra reading space.

EPUB curl facets share parallel seam edges and identical front/back transforms; finger-height deformation grows away from the fixed left binding. One display-link trajectory carries release velocity into a stationary endpoint; content commits after the curl completes. Running book titles use 18 pt serif and pagination uses 15 pt interface text. Loading annotations keep a 32 pt indicator row inside equal 16 pt vertical padding. Article navigation has a transparent bar and a Liquid Glass title capsule, with a 5 pt title reveal lasting 240 ms and a 180 ms exit; reduced motion omits the transition.

Use the web lawn artwork and running cat sprite only in spacious page loading states. Compact content, audio, annotation, vocabulary, and button loading states use standard spinners. Pause movement for reduced motion and inactive scenes. Corpus controls stay hidden while a library loads. Dynamic annotation prose is 16 pt on phone and 17 pt on iPad, with 20/22 pt headwords, 14 pt section labels, and tighter content spacing. Preserve Dynamic Type scaling. Ebook selection menus name the bookmark action 🔖书签; remove 全选 while retaining Copy and contextual lookup.

Both turn directions keep the left binding stationary. Forward turns peel the current page away; backward turns snapshot the previous page and unfold it over a stationary image of the current page. Remove that temporary image only after the turn completes or the cancelled location is restored.

Audio playback floats in a compact 420 pt maximum Liquid Glass capsule, with play/pause, track title, elapsed time, scrubbing, and dismissal in a single row. Measure its height to leave scrollable space beneath the final prose line without shrinking the reading viewport. Seek after scrub release. Hide renderer diagnostic notices from both displayed prose and VoiceOver while preserving fallback text. Spacious loading states use a 224 pt lawn scene; compact loading contexts use standard spinners.

Previous-page previews live outside the WKWebView snapshot area so the stationary current-page cover cannot contaminate the incoming image. Animate the visible unfolding phase from edge-on to flat, with bounded curvature that reveals content immediately as the finger moves. Forward-turn rendering remains unchanged.

Keep the article paper background continuous through the bottom safe area. Previous-page unfolding uses negative angles approaching zero, bringing the sheet toward the reader with the opposite angular velocity to a forward turn; the left binding remains fixed.

URL import uses https://theleximorytimes.com/ as a muted placeholder and neutral control tint. Manual entry has one title prompt and a blank body editor, without duplicate field labels, file selection, or boilerplate AI copy. Keep generation preferences in a collapsed options disclosure; ebook file selection stays in the upload tab.
