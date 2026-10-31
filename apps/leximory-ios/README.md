# Leximory on Apple platforms

## Save a word with Shortcuts

In Apple's Shortcuts app, open Leximory and choose 保存词汇. Run it to enter a word. Jev identifies its supported language, Leximory generates the definition, and the word is saved to that language's personal vocabulary warehouse. The action reports progress to Shortcuts; iOS controls whether a running indicator appears. The result displays the annotation with Markdown formatting, including available etymology and cognates. The snippet uses system fonts for all languages and leaves its background to iOS. The annotation comes back in the save response without a second API request. The action also returns Markdown text for subsequent shortcut actions. You can pass text into 词语 from another action.

Sign in to Leximory first. The shortcut runs without opening the app and requires an unlocked device and an internet connection. Existing AI quotas apply. Unresolved languages and failed lookups do not save a word. This requires the mobile API containing `/shortcuts/words` to be deployed alongside the app.

Only the mobile Shortcuts endpoint defers its library lookup and vocabulary save with Next.js `after()`. It returns the generated annotation first, retries transient persistence failures up to three times with the same mutation identity, and records completion after saving. Other vocabulary save endpoints still wait for persistence before responding.

The web app defines copy, colors, typography and product actions. Use native navigation, selection menus, sheets and popovers. Keep implementation details out of the interface. App-authored Chinese uses Chinese punctuation; imported text keeps its original punctuation.

## Appearance

Ordinary app UI uses Apple's semantic colors: system backgrounds, grouped backgrounds and rows, primary/secondary labels, separators, and standard blue actions. This includes My Bookmarks, account settings, forms and sheets. Colors follow light/dark appearance and accessibility contrast. Reserve custom colors for reading themes, highlights, covers, membership artwork and Home cards. Preserve the original paper, shell, cover and border tokens for artwork and reading content. Apply native backgrounds explicitly to ordinary UI screens such as My Bookmarks and Account; never neutralize shared artwork tokens to change a settings screen.

Covers retain the web's newspaper rules, artwork and identity-derived paper wash. Draw rules above the wash. Use the bundled monochrome Noto Emoji for cover artwork; prose keeps native emoji.

## Typography and layout

Chinese UI uses the original bundled ChillDuanHeiSong serif, with explicit Regular/Bold faces, regardless of device language. Latin UI keeps Urbanist. Garamond pairs with Chill for library names, text titles, topics, browser labels and other user/imported content; known Japanese content uses the bundled Japanese serif and other scripts keep native fallbacks. Article body fonts are unchanged.

Reserve 欣意吉祥宋 for fixed Chinese UI display copy: the four Home cards, app page headings and fixed promotional slogans. Its separate `displayFont`/`displayUI` API applies the 120% optical correction. Never use that API or font in library/text titles, user names, imported headings, search results, recents or any text that may contain Japanese or other languages. Home card titles use a closed enum of fixed UI strings. Ordinary `editorialFont` and `interfaceFont` never include 吉祥宋 in their cascades. Browser address labels, recents and autocomplete retain the original per-character Chinese sizing: Han characters and Chinese/full-width punctuation render at 85% of the Garamond size; Latin, kana and emoji keep the requested size. This is separate from the 120% correction for fixed 吉祥宋 display labels. The address input retains Garamond with the original Chinese/Japanese serif cascade, matching its display typography; do not apply the Urbanist interface font to the input.

| Role                      | Face                           | Default                                              |
| ------------------------- | ------------------------------ | ---------------------------------------------------- |
| Library eyebrow           | Urbanist                        | 12 pt, 1.2 tracking                                  |
| 我的文库                  | 欣意吉祥宋          | 30 pt                                                |
| Library/text titles       | EB Garamond with original Chill serif cascade   | 20–36 pt by role                                     |
| English/French prose      | Libre Baskerville              | 18 pt phone, 20 pt wide                              |
| Chinese prose             | ChillDuanHeiSong               | Bundled Regular and Bold OTF; choose Bold explicitly |
| Japanese prose            | ChillDuanHeiSongProJP          | Bundled Regular OTF, with ruby                       |
| Interface text            | Urbanist with original Chill serif cascade | 12–17 pt                                             |
| Chinese navigation/topics | Original bundled serif          | 12–13 pt topics                                      |
| IPA/code                  | Source Code Pro                | 85% of prose                                         |

Use real prose italics. Scale with Dynamic Type; titles wrap and containers grow. Keep Urbanist for Latin controls, Garamond for Latin content titles, and the original Chinese/Japanese serif for ordinary text. Fixed Chinese display labels opt into 吉祥宋 separately. Keep native label sizes, semantic colors, spacing and dialog structure. IPA and code retain their specialized faces.

Interface rows use 17 pt body text. Group headers use 15 pt semibold secondary text; footers use 13 pt secondary text. Keep these roles explicit so a container body font cannot override the hierarchy. Interface typography scales in the local Dynamic Type environment. Headings, including empty-state headings such as 选择文库, use primary color. Supporting descriptions, metadata, and library language labels use secondary color. Preserve authored bold prose and dictionary headwords.

`LeximoryLayout` owns measurements: 20 pt page inset, 640 pt article/library measure and 880 pt gallery measure. Library cards use 46 pt outer and 32 pt inner corners. Phones use compact text rows with newspaper thumbnails. Wide galleries show a featured cover and up to five supporting entries in landscape or three in portrait. Archived libraries are compact chips.

Article covers and wrapping titles scroll with the prose. Phone titles use 28 pt Garamond, wide titles 32 pt. A 22 pt toolbar title appears after the full title scrolls away. Article paper continues through the bottom safe area.

## Navigation and account state

Browser navigation uses a Safari-compatible identity and mobile content on iPhone, desktop content on iPad and Mac. Keywords use the selected search engine, defaulting to Bing; URLs open directly. Preserve webpage cookies and verification frames. Load failures use a Liquid Glass surface above the page.

网页选项 offers 清除浏览数据 with destructive confirmation. Clear all browser history, remembered pages, cookies, and website storage, leaving an empty browser. Preserve Leximory account data, bookmarks, vocabulary, and website library choices.

Vocabulary saves use the saved resource’s folder, then a configured website folder, then the respective language warehouse. Never resolve language when authorized resource or folder metadata supplies it. Do not trust webpage language declarations or Defuddle language metadata. Remove the destination selector from the definition tray. New website navigation evaluates its own rules. The article import switch 本网站总是存于此文件夹 also governs vocabulary routing and future import preselection; future imports still show review.

The browser fills its safe areas with the webpage’s theme color, falling back to WebKit’s page background. Track color changes without shifting the webpage or controls.

iPhone and iPad use one browser workspace with no navigation tabs. Fresh launches show Home without opening a URL; returning to an existing session preserves the current resource. Back and Forward share a sequential history across Home, My Bookmarks, websites, articles, and ebooks. Folder expansion, dialogs, and page turns do not create history entries. Restore destination state on return and replace the forward branch after a new visit.

Keep a compact translucent bottom bar with resource identity, Back, Forward, Home, and More. Hide unavailable Back/Forward actions and hide Home while already on Home. Keep this bar outside the content navigation container so resource views cannot cover it. Websites have a separate magic-colored save button. Native WebKit gestures work within webpages; screen-edge and address-bar gestures cross resource boundaries without stealing ebook page turns. Keep reading content through the bottom edge and accommodate audio and ebook controls above the bar. Keep EPUB/PDF contents, bookmark, settings, and pagination controls at the top and bottom of the reader; omit their redundant return button inside the browser workspace. Article audio belongs at the top too. Articles and ebooks do not offer sharing controls. More contains annotation activity and current-resource actions, not destination shortcuts. System sheets may cover the bar.

Home restores the original four cards, including the phone grid, iPad overlap and tilt, original card palette and compact address-editing actions. Account is available from More’s app-wide section. Tightly spaced pins remain in the shared glass group below, followed by recent rows with domains or folder names and no heading. Keep the supplied day/night wallpapers, Urbanist English interface type and existing reading fonts. Wallpaper blur uses local coordinates so scaled previews stay aligned. See DESIGN.md for details.

My Bookmarks is capped at the 640 pt article measure. Resource icons use the text’s saved emoji in the bundled monochrome face, with a resource symbol only when no emoji is available. My Bookmarks uses native grouped rows with inline expandable folders and indented resources. Folder and library names use 17 pt editorial type; child resource titles use 16 pt editorial type, with smaller muted metadata. Keep recent reading, archive categorization, native context menus, and folder creation/renaming. App-authored UI calls libraries 文件夹. Keep folders language-specific, with outlined folder icons and muted, spatially separated metadata. Use native DisclosureGroup appearance and default accordion animation. Do not use dot separators as a substitute for hierarchy. Account is available from More and is omitted while the current destination is Account.

Scope cached content and recent reading to the account and library. On a library switch, show that library's cache or loading scene immediately. Superseded requests cannot replace it. Show cached content before refreshing; see [offline storage](../../docs/native-ios/offline-sync.md).

Handle downloading, caching, synchronization and recovery automatically. Preserve editing actions and disable them when unavailable. Failures with automatic recovery must not notify the user. Keep cached content and drafts while retrying in the background. Notify only when the user must act or their requested action remains unresolved after recovery is exhausted. Feedback must belong to the affected control or a deliberately designed page state, never unexplained error labels inserted into normal content. Reserve modal alerts for decisions that require an interruption. Treat first-load, cached, pagination, and mutation failures separately.

Use the lawn and cat together for spacious loading scenes, at 80% width up to 560 pt and constrained by height. Compact loading states use standard spinners. Respect Reduce Motion and inactive scenes.

## Reading and learning

Selection menus put 猫忆查 and ebook 🖍️荧光笔 first, preserve only native Define and Copy, and offer 搜索 for the selected text. 搜索 uses the chosen search engine inside the Leximory browser and participates in workspace history; never open Safari for this action. Remove 查找所选内容, 翻译, 搜索网页, sharing, replacement, find, Select All, and other unrequested system actions. Remove Apple's lookup menu container entirely and retain the original native Define action in a Leximory-owned menu; retaining the system lookup identifier allows Search Web to return after menu construction. Keep actions beside the selection with native icons. Capture ebook context and location before dismissal.

Static annotations highlight on touch-down and open on touch-up, anchored to the selected line. Use a fitted popover on iPad and tray on phone, with a comfortable 400 pt measure and 24 pt insets. Keep actions below the definition. Article highlights are short sage-yellow strokes behind the lower glyph area, separately fitted to each line.

Dynamic definitions overlay the reader in a top-anchored card. Content determines height, capped at 78% of the viewport. Use 36 pt corners and the web's drawer easing. Drag upward or tap outside to dismiss; downward dragging resists. Streaming must preserve the reading viewport and offset.

Annotation content uses prose typography, bold headwords and muted 释义/语源/同源词 labels. Defaults are 16 pt phone/17 pt iPad body and 20/22 pt headwords. Keep bookmark, editing and dictionary actions. Dictionary links open inside the Leximory browser and return through workspace history. UIKit-hosted annotation popovers receive the workspace explicitly; standalone annotations present the internal browser. Saved definitions reopen for editing with the canonical 词条、释义、语源、同源词 fields.

Dynamic lookup opens the tray immediately with a spinner and 正在理解语境; language resolution stays inside the same loading state. The spinner and its label both use semantic secondary-label color in light and dark appearance. Spinner labels omit ellipses. The shared save control morphs through saving, a brief disabled checkmark confirmation at full contrast, and editing. Keep the ink circle and paper icon fully colored even when disabled; symbols crossfade in place over 180 ms without vertical travel, rotation or a success scale flourish. Reduce Motion changes symbols immediately. Dynamic annotations stream 释义、语源 and 同源词 in order, retaining visible content during background recovery until the replacement completes. Supported devices provide light typing ticks on visible text growth, at most once every 70 ms, and a quieter lookup-completion tap, and confirmation on successful vocabulary or ebook-highlight saves. Background recovery and replayed text produce no haptics. Browser destinations align with the prose in muted text, without a destination selector. Omit implementation explanations and empty website-setting sections.

Audio playback uses a compact glass capsule, at most 420 pt wide, with playback, title, elapsed time, scrubbing and dismissal. Allow scrolling past the last prose line beneath it. Seek on scrub release.

## Ebooks

EPUB currently uses bundled epub.js; PDF uses PDFKit. EPUB reading options offer 白纸、灰纸、暖纸、米纸 as diagonally split circular previews of their light and dark variants. Theme names are for VoiceOver only; omit visible captions and automatic-switch explanations. Remember the selected theme and follow system appearance; color changes preserve pagination. Preserve CFI positions, private bookmarks, selection context, authorization and quotas. Ebook bookmark content is not the complete book text.

A center tap toggles controls without reflow. Running titles are centered and fade when controls appear. Use separate circular glass buttons for back, contents, bookmarks and settings, with 44 pt touch targets. Displayed address labels use 18 pt editorial type; page labels use 15 pt interface text. EPUB labels include chapter and page; PDF labels give page X of Y.

Empty outer gutter taps turn one page in reading order without animation. Swipes use flat, interruptible slides that track the finger and ease into completion or cancellation. Forward turns move the current page away; backward turns bring the previous page over it. The underneath page moves a short distance with proportional shading. Visible text stays stable throughout motion. Preserve the left-edge back gesture and Reduce Motion.

Horizontal EPUB prose defaults to 18 pt phone/20 pt wide with 1.6 leading, a 560 pt maximum column measure and at least 44 pt outer gutters. Use two columns only in landscape windows at least 760 pt wide. Japanese always uses one spread, vertical pagination, bundled Japanese serif, ruby, publisher indentation and paragraph spacing. Its separately remembered defaults are 24 pt and 1.7 leading. Preserve emphasis, poetry, images and tables. Resizing and reading settings retain reading position. Selection excludes ruby pronunciation and stays within its paragraph or line.

PDFs scroll vertically and offer fit-page/fit-width. Reserve 24 pt below EPUB and 36 pt below PDF, with 8 pt beneath page labels. Contents, bookmarks and settings use paper popovers on iPad and fitted sheets on phone. Short lists fit their content; long lists scroll. Dismiss outside or with the system gesture.

Bookmarks use spaced quote cards with chapter names or PDF page numbers. Show and highlight saves immediately, then reconcile the result. Failed saves remove the pending bookmark and announce a brief error. Reading-position sync failures stay silent.

## Importing and vocabulary

Remove the corpus entrypoint and destination shortcuts from More. Saved definitions remain accessible through reading and annotation controls. Website import runs bundled Defuddle in an isolated world inside the loaded page. The native review offers 导入并预注释全文 by default, or 存为链接书签; both show an editable title, folder selection, and 本网站总是存于此文件夹. Full-text mode adds a native block-aware Markdown preview and a focused 编辑全文 screen. Apply the web’s Markdown-link regex before parsing, preserve visible labels, and omit all link/image URL attributes from rendered runs. Parse complete source before showing the first complete blocks; 展开全文 reveals the rest. Preserve paragraphs, heading levels, nested lists, quotes, code, and table cells with Leximory faces. Preview H1–H6 use 24, 22, 20, 19, 18, and 17 pt respectively, scaling with the 17 pt body through Dynamic Type. Images display their captions without remote fetching. Use the shared native folder selector and one primary action. Full-text import opens the article immediately while annotations prepare.

Ebook import starts with the native EPUB/PDF picker, then a folder-selection sheet with the filename and optional title edit, then opens the reader. Preserve the 4.5 MB limit. Cancellation creates nothing; failures retain selection. Prevent resubmission when a mutation result cannot be confirmed.

Track article annotation activity across destinations and foreground sessions. More shows a small dot for pending work and a numbered badge for newly ready articles not yet opened. Opening the menu does not acknowledge completion. Opening the article does. Reveal newly completed highlights across the visible text without changing reading position; respect Reduce Motion.

已存词汇 is a collection screen with Chinese date groups and centered word chips: two columns on phone, three or four on iPad. Words open fitted definitions with an explicit edit action. Shared-library words and welcome annotations remain read-only. Native omits lottery and story controls.

## Verification

Check phone and iPad widths, portrait/landscape, dark appearance, long titles and Dynamic Type. Verify selection, bookmarks, real horizontal and Japanese books, and supported offline actions. Mac Catalyst also needs keyboard, resizing and lifecycle checks. Fixtures are for automated verification; hand off the real app in normal account mode. Database mutations and device installation require authorization.

### Mac Catalyst sign-in

Build Catalyst with an Apple development team and automatic provisioning enabled. `LeximoryMac.entitlements` gives the Mac app its own Keychain access group. A development signature without this entitlement cannot save the Supabase session, so successful password authentication is followed by the generic 登录未成功 message. Do not use an unsigned Catalyst build to verify real-account sign-in.

After generating the project, select your development team in Xcode, or pass `DEVELOPMENT_TEAM=<your-team-id>` and `-allowProvisioningUpdates` to `xcodebuild`. When using the current SDK on macOS 26, also pass `MACOSX_DEPLOYMENT_TARGET=26.0`. Run the focused `LeximoryTests/AccountSessionTests` test on the Mac Catalyst destination to verify saving and reopening a dummy Keychain value without accessing an account.

## Account

账号 preserves the web settings page's profile header, subscription, AI 词点额度 and AI 语点额度, monthly vocabulary calendar, English accent, passkey, profile edits and learning-progress sharing. Display only the integer part of used quotas; keep fractional usage in the API and quota accounting. Use the Shanghai calendar for activity.

Use native navigation, segmented preferences, a photo picker, edit sheets, sharing and destructive confirmations. Plan comparison opens in a native sheet and checkout uses the existing billing service. Account summaries are cached within the account's reading store; editing stays visible and is disabled offline. Passkeys are fetched on demand and never written to the reading cache.

The 账号 tab replicates web settings through authenticated mobile account endpoints. It includes quotas, activity, accent preferences, passkey controls, profile editing, avatar selection and learning-progress sharing. `--account-fixtures` previews this screen without live data; account mutations are disabled in this preview. `AccountUITests` checks summary values, native upgrade and edit sheets, and sign-out confirmation, then relaunches the app in normal account mode.

## Editing and removal

Open an article or ebook, then choose 更多 → 编辑. The edit sheet contains title, individually editable tags, cover emoji, article editing, and text deletion. Existing ebooks also offer file replacement; articles never offer ebook attachment. Save failures appear beside Save with retry or reload, and file/deletion failures stay with their affected controls. Article editing uses the web's Tiptap and Markdown conversion in a local, nonpersistent WebKit editor, with a compact formatting toolbar. It preserves Leximory annotations, audio sections, and small caps. Tables, images, and raw HTML remain intact as inert visual blocks while surrounding prose is edited. Scripts, network requests, links, and remote images cannot run in the editor. The import review uses the same visual editor.

In the review timeline, open a word and choose 删除词汇. Deletion requires confirmation and respects protected welcome words. Offline editing controls remain visible and disabled. Confirmed changes update the account cache and remove stale entries from browser history, recent reading, home pins, and review counts. Ebook file changes reset positions while preserving excerpt text.

The new management API must be deployed with the app. It authenticates bearer tokens, requires folder ownership, rejects bookmark resources and shadow content folders, checks edit revisions and file limits/signatures, and serializes native text mutations. File changes retain the old bytes for rollback if storage cleanup or metadata publication fails. No schema migration is needed. Rebuild the editor bundle after changing the web serializer or editor dependencies with `node apps/leximory-ios/scripts/bundle-editor.mjs`; `--check` verifies it is current.

## Browser ad blocking

More → 广告拦截 opens the shared browser settings sheet. Blocking starts enabled, and website exceptions match the displayed hostname exactly. Changes stay in the sheet until confirmation. Applying a change to the current page explicitly offers a reload; form results apply it on a later navigation. Clearing browsing data removes exceptions and preserves the global switch. Ebook, editor, and authentication web views are unaffected.

The app bundles native WebKit rules converted from pinned EasyList and EasyPrivacy snapshots. No runtime rule download or executable filter engine is included. Filter attribution and the CC BY-SA 3.0 license are in `App/Resources/Browser/AdBlocking/`.

Check source and artifact hashes offline with `python3 apps/leximory-ios/scripts/prepare-browser-ad-rules.py --check`. To reproduce conversion, build `ConverterTool` from SafariConverterLib commit `7a2e93f0afa70479cc59985f332025236c3f0c39` using its committed package resolution, then pass `--check --converter /absolute/path/to/ConverterTool`. The release's standalone binary omits its PublicSuffixList resource, so use the source-built executable with its adjacent resource bundle. `--refresh --converter ...` explicitly downloads new source snapshots and regenerates the bundle; review the manifest, licenses, and native tests before shipping changed rules.

## Home Screen widgets

Generate the project with `scripts/generate-project.sh`; the app embeds the `LeximoryWidgets` extension. Both targets use the `group.com.leximory.reader` App Group. For device builds, enable that group for both app identifiers under the selected development team. The extension includes its own bundled fonts and licenses.

Add Leximory → Saved words from the iOS widget gallery. Widget interface copy is English. EB Garamond and Urbanist match the native app. The widget uses the supplied light and dark mesh image assets. The square Saved words widget shows today's count; the medium widget groups the 30-day total and its caption on paper, with today's count and a white area chart on the colored field. Numeric transitions respect Reduce Motion. The Shanghai calendar day and 30-day window advance at midnight. Open the app while signed in to populate it. Counts refresh on foreground, reconnection and confirmed vocabulary changes. Widgets retain cached data without storing account credentials. Tapping Saved words opens Home.

`SavedWordsWidgetTests` covers calendar boundaries, midnight rollover and account isolation. `AnnotationPhoneticsTests` covers bracketed phonetics and ruby offsets. `SavedWordsWidgetRenderingTests` exports the production components in light, dark, narrow and larger-text layouts as test attachments.
