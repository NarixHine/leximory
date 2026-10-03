# Leximory on Apple platforms

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
| Marker | `#D9E8BF` | Translucent lower-line annotation strokes |
| Illustration | `#9CAEA1` | Artwork and language labels |
| Secondary label | `#9CA8AB` | Archive heading and secondary metadata |
| Secondary border | `#D0D6D8` | Topic pill outlines |
| Muted | `#67787C` | Supporting text and dictionary actions |
| Sage action | `#5A715A` | Navigation tint, links, selection affordances |
| Ink | `#192024` | Editorial titles and prose |

Use the adaptive tokens for dark appearance. Ink belongs to reading content, not selected navigation icons. Let native Liquid Glass own tab and toolbar backgrounds, optical contrast, safe-area sizing, and selected states. Use sage for app navigation and neutral ink for the ebook control cluster. Glass belongs to navigation and controls; paper cards and prose retain the web's quiet surfaces.

Cover paper follows the web's identity-derived OKLCH formula, rather than the library inset token: lightness 0.975–0.993, hue 120–174, and chroma 0.003–0.0075. A slow colored wash and a white wash brighten different areas. Draw newspaper rules above the washes so they stay legible. Preserve variation between texts; do not flatten the collection into a single gray-green surface. Dark paper uses the web's identity-derived neutral lightness.

## Typography

| Role | Face | Sizing and rhythm |
| --- | --- | --- |
| Library eyebrow | Space Mono | 12 pt, tracking 1.2 |
| 我的文库 | WenKai Screen | 30 pt |
| Library and text titles | EB Garamond with CJK cascade | 24 pt phone library card, 20 pt compact text row, 30 pt wide library card, 36 pt featured text |
| English/French prose | Libre Baskerville | 18 pt / 5 pt additional line spacing on phone; 20 pt / 7 pt on wide layouts |
| Chinese prose | Noto Serif SC | Minimum weight 500; 600 for stronger labels |
| Japanese prose | Noto Serif JP | Preserve ruby pronunciation |
| Interface text | Raleway with script cascade | 12–17 pt by role |
| Topics | WenKai Screen | 12–14 pt, compact pills |
| IPA/code | Source Code Pro | 85% of prose size for inline IPA |

Garamond is a display face. Do not use it for English body text. Use real italics for prose. All roles scale with Dynamic Type; titles wrap and containers grow. Full article and library titles belong in wrapping scrolling content. Once the article title leaves the viewport, a secondary 17 pt Garamond title appears in the toolbar and disappears when the full title returns. Native menus and OS-owned controls retain platform typography where the OS owns it.

## Layout and hierarchy

`LeximoryLayout` owns shared measurements. The page inset is 20 pt and article reading measure is at most 680 pt. Cards use 14 pt top and horizontal outer insets, 6 pt beneath their action footer, 46 pt outer radius, and 32 pt inner radius. Title panels have 20 pt top padding and 16 pt bottom padding; their minimum height is 104 pt. Do not add a blank footer to imitate unavailable actions. Archived/shadow libraries form compact chips below a faint 0.5 pt divider in the border color.

Texts begins with a wrapping collection title in the content. Every text cover uses the newspaper gridline background, with a restrained moving wash. Phones use compact text rows throughout, with small newspaper cover thumbnails; there is no featured hero card. Wide windows use a featured cover and at most five supporting entries in landscape, three in portrait; remaining articles continue below. The reader opens with the web's artwork, topic metadata, and a wrapping title. Wide reading covers have a shell-colored title panel, lighter than the artwork panel. Phone article titles use 28 pt Garamond, tightened tracking and an 8 pt gap before topics; wide titles use 32 pt. The header scrolls with the prose; the native toolbar contains navigation, actual actions, and the conditional secondary title.

The phone reader's cover is 196 pt tall. Active library cards expose the actual recently opened text when available and a separate 44 pt archive action. Archived libraries expose the inverse action. Recent reading history is scoped to the signed-in account on the device, matching the web's local history behavior.

## Navigation and learning

Use the native `TabView` for 文库 and 账户. Inactive tab symbols are muted outlines; active symbols use sage. Use native Liquid Glass toolbars for back, contents, sharing, and playback. Do not rebuild the tab bar or draw a separator around it. 查词 precedes Copy in its own inline selection-menu group; ebook selections also expose 收藏 there. Keep these actions beside the selected text. The login tray's 取消 is a quiet text action with no shared glass background.

Annotation trays use a pale surface, bold prose headword, Libre Baskerville body, and muted 释义/语源/同源词 labels. Never use the title face for annotation content. Initial loading is centered within a stable area. Saving uses the reference's dark circular bookmark action. Phone sheets adapt to measured content without surplus detent height. The solid action has equal 24 pt left and bottom insets measured from the sheet edge; subtract the bottom safe area from the height detent rather than adding it again. Leave their corner radius to iOS so the sheet follows the screen geometry. Long definitions scroll; iPad popovers anchor to the selected occurrence. Pre-annotated article words use a brighter sage-yellow highlighter stroke behind 40% of each line's lower area, without a rectangular word background. Highlights retain selection and lookup behavior.

## Ebooks and Mac

EPUB uses the same bundled epub.js version as the web, preserving CFI navigation and reading positions. PDF uses PDFKit. Authorized book descriptors, user-private bookmarks, and reading-position sync use the existing database tables. Keep article source ranges separate from ebook selection context. Preserve quotas, completed-definition receipts, and library access checks. Do not treat an ebook's bookmark-only `content` as its complete text.

Ebooks open without chrome. A center tap toggles the shared edge controls; horizontal swipes turn EPUB pages with an interactive curved paper transition; Reduce Motion changes pages directly. The left-edge return gesture takes priority over page turning. PDFs scroll continuously vertically. Controls overlay reserved margins, so revealing them does not reflow the book. Contents and bookmarks live in a paper tray anchored to the contents button on iPad, adapting to a native sheet on phone. Reading settings use an “Aa” trigger and a native paper form, with neutral ink actions. Reserve glass for the navigation cluster; the reading-position label is plain muted text. Short contents lists size to their entries; long lists scroll. Keep the full paper picker visible in the settings popover. EPUB accessibility position includes the chapter as well as its page; PDF announces page X of Y rather than a percentage. EPUB prose defaults to 18 pt on phone, 20 pt on wide layouts, with 1.6 leading and a maximum 760 pt measure, 24 pt minimum outer margins. Override dense publisher paragraph typography while preserving emphasis, poetry, images, tables, and ruby. Reading options adjust size, leading, and paper appearance without changing CFI position. PDFs preserve their typeset page in continuous vertical flow and offer fit-page/fit-width, a page slider, and the same contextual learning menu. Capture selection context and location before the system dismisses its menu.

Mac Catalyst shares the native implementation. Keyboard navigation, window resizing, selection, and app lifecycle require Mac verification beyond compilation. Browser importing, DRM-protected books, signing, and production delivery remain separate work.

## Review gate

Inspect the signed-in web when a layout is uncertain. Verify real long titles, narrow phone widths, iPad portrait/landscape, dark appearance, and accessibility text sizes. Check supported actions and unavailable states, then capture screenshots. Database mutation tests require explicit authorization; fixtures verify ebook rendering without changing the test account.
