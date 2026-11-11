# Leximory iOS: design-language audit and redesign specification

6 November 2026 · Design draft, no application code changed

Open the [interactive visual companion](design-studies.html) for four focused layout studies, Light/Dark variants, and the ten captured screenshots. These studies illustrate component relationships; the six specifications below define the complete screen behavior.

## Scope correction

The standalone vocabulary collection and Account activity heatmap are retired, unreachable product surfaces. Findings F14 and F17–F20 and their restoration/redesign proposals are withdrawn. Preserve the active saved-definition tray in reading/review. The original walkthrough below includes legacy fixture surfaces and must not be treated as proof of production reachability.

## Verdict

Leximory should feel like a quiet multilingual reading room inside a native iOS workspace. Its distinctive qualities are already present: Chinese display serif, language-aware literary faces, newspaper covers, watercolor landscapes, cats, and restrained sage learning accents. The redesign should make their roles predictable rather than replace them with a new visual style.

The largest remaining inconsistencies concern typography scaling, sheet capacity, action feedback, vocabulary presentation, and differences between the primary workspace and standalone browser flows. Fix these before changing artwork, adding navigation destinations, or introducing more cards.

## Evidence and limits

Two sources are deliberately separated:

- **Current source:** workspace based on `ac1c624d18a70b0f8d74b35f0eb823ee17a2111f`, including pre-existing edits in AccountView.swift, DESIGN.md and Shared/LeximoryStyle.swift. Findings below describe those working files unless explicitly marked otherwise.
- **Installed build:** ten screenshots captured and opened during this session on the separate Leximory Dialog Audit iPhone simulator, iOS 27. The binary demonstrably predates the workspace: its Account slogan, reset captions and review lawn differ from current source. Screenshots establish composition and historical drift; they cannot prove a current-source regression. No new binary was installed.

The 83-file Swift inventory covers App, Shared and Widgets, with counts of UI, presentation, font and accessibility sites. Counts are an inventory, not proof that every execution path was tested. Source inspection focused on screen composition, typography, controls, presentation and state handling. Generated/vendor JavaScript and backend logic were not exhaustively reviewed.

This is a broad source-backed design review with a ten-state simulator walkthrough, **not an exhaustive live audit of every state**. Paid-account operations, purchases, real imports, account deletion, production mutations, PDF handwriting, a real Japanese book, iPad/Catalyst layouts, VoiceOver interaction, and the complete accessibility matrix remain unverified. Fixtures isolated the screenshot walkthrough from real data. The simulator was relaunched without fixture arguments afterward; normal Home was verified. Existing real account data was preserved.

## Walkthrough and coverage

| Step | Surface | Evidence / health |
| --- | --- | --- |
| 01 | Normal Home | [Screenshot](screenshots/01-home.png). Strong identity and clear four-card hierarchy; retain. |
| 02 | Wallpaper sheet | [Screenshot](screenshots/02-wallpaper.png). Best ordinary-sheet reference: native shell, direct preview, quiet controls. |
| 03 | My Bookmarks, fixture folders | [Screenshot](screenshots/03-bookmarks.png). Clear grouped structure; title hierarchy and small content text need current-build review. |
| 04 | Article | [Screenshot](screenshots/04-article.png). Strong editorial reading surface; header/prose insets differ. |
| 05 | Account, fixture | [Screenshot](screenshots/05-account-installed-build.png). Older slogan and quota layout; current source already addresses parts of this. |
| 06 | Membership, fixture | [Screenshot](screenshots/06-membership-installed-build.png). Restrained artwork and selection; current source adds price to Subscribe. No transaction attempted. |
| 07 | Review timeline, fixture | [Screenshot](screenshots/07-review-timeline.png). Compact word history; old eyebrow already removed in source. Touch sizing remains a source issue. |
| 08 | Review lawn, fixture | [Screenshot](screenshots/08-review-lawn-installed-build.png). Old cutout lawn and thresholds; current source/spec already replaces these. |
| 09 | Review exercise, fixture | [Screenshot](screenshots/09-review-exercise-installed-build.png). Older prompt styling; evaluate the current tray/keyboard composition after rebuilding. |
| 10 | EPUB, fixture | [Screenshot](screenshots/10-epub.png). Quiet paper and persistent workspace bar; visible page position lacks chapter context. |
| 11 | Web, address search, browser recovery | Source: BrowserHomeView, BrowserWorkspaceView, TextBrowserScreen. No live webpage or failure capture; external webpage styling is not Leximory UI. |
| 12 | Article/EPUB/PDF selection, annotations, vocabulary edit | Source: ReaderScreen, ReadingTextView, EbookControls, VocabularyEditor. No selection gesture or streaming capture. |
| 13 | EPUB/PDF contents, bookmarks, options, outline and handwriting | Source: EbookScreen, PDFOutlineControls, PDFNotesModel. PDF and Japanese rendering not visually verified. |
| 14 | Web/ebook import, editing, folder selection | Source: BrowserImportSheet, TextManagementSheet, ArticleEditor, BrowserFoldersView. No real import submitted. |
| 15 | Saved vocabulary | Standalone collection retired and removed. CorpusWordTray remains in active review/reading flows. |
| 16 | Onboarding, sign-in, register, email confirmation, password recovery, deletion | Source: OnboardingView, OptionalAccountView, AccountDeletionView. No authentication or deletion action attempted. |
| 17 | Privacy and subscription management | Source: MembershipView and OptionalAccountView. No StoreKit/account state verification. |
| 18 | Audio and widget | Source: PlaybackBar, ArticleAudioButton, Shared/SavedWordsWidgetView, Widgets/SavedWordsWidget. No audio playback or widget-host capture. |
| 19 | Legacy library/gallery/import shell | Source: LiveLibraryView, CatalogViews, ContentImportView. Not the normal AccountRoot entry; treat separately from active workspace defects. |

## Unified language

### Three visual contexts, one grammar

1. **Navigation and ordinary tasks:** native semantic backgrounds, primary/secondary labels, neutral controls and system sheet geometry. Grouped account/bookmark rows belong here. Liquid Glass belongs to the floating functional layer, not every content card.
2. **Reading and learning:** preserve paper, language-aware prose, understated highlights and task-specific annotation trays. Editorial rhythm matters more than decoration. Reading content continues under floating controls, with sufficient scroll clearance to reveal its last line.
3. **Identity and artwork:** preserve Home's exact four labels, original gradients and icons, watercolor landscapes, membership illustration, cover washes and cats. These are intentional exceptions to neutral UI. Do not turn every screen into a meadow or every surface into glass.

Apple's [Materials guidance](https://developer.apple.com/design/human-interface-guidelines/materials) distinguishes functional Liquid Glass from content surfaces. Apply that separation while preserving Leximory's documented Home exceptions. Native components should provide material behavior wherever practical.

### Typography contract

| Role | Contract |
| --- | --- |
| Fixed Chinese page/display copy | Existing 吉祥宋 `displayFont`, 120% optical correction; never imported/user content. |
| Latin controls / Chinese utility copy | Urbanist / original Chill serif; 17 pt body, 15 pt semibold secondary section headers, 13 pt secondary footers. |
| User/library/article titles | EB Garamond + original language-aware Chinese/Japanese cascade; article 28 pt phone, 32 pt wide. |
| Article/ebook prose | Existing language-specific reading fonts and preferences. No global font replacement. |
| Annotation prose | Static 17/18 pt and dynamic 16/17 pt phone/wide, retaining current body defaults; one scaling owner. Normalize headwords to the documented 20/22 pt role after visual comparison. |
| IPA / code | Source Code Pro, 85% of prose; preserve bracketed annotation phonetics. |
| Address / recents | Existing Garamond cascade with 85% per-character Chinese sizing; preserve IME and native blue selection/caret. |
| Widget | Existing English-only copy, Garamond numbers/titles and Urbanist labels. |

All sizes are defaults, not fixed final pixels. Follow [Apple typography guidance](https://developer.apple.com/design/human-interface-guidelines/typography) and use a single local Dynamic Type scale at each render boundary. Never shrink a major value to make room for incidental metadata.

### Geometry and hierarchy

Keep `LeximoryLayout.pageInset = 20`, reading/library measure 640, gallery 880; preserve EPUB's distinct 560 pt column measure. Use 8/12/16/20/24 spacing roles for label gaps, card gaps, inner cards, page insets and task trays. A radius is a component role: native sheet/system rows; Account cards 24; static trays 32 where already specified; dynamic trays 36; library artwork 46/32. Do not flatten these into one universal radius.

Interactive bounds are at least 44 × 44 pt, while Account rows retain 52 pt minimum. Smaller visible symbols may sit inside larger clear targets. At accessibility sizes prefer wrapping/stacking to squeezing. Apple [accessibility guidance](https://developer.apple.com/design/human-interface-guidelines/accessibility) also calls for contrast checks, larger text, and cues beyond color.

### Action and feedback grammar

- Information/live-applied sheet: top-right close, accessibility label 关闭.
- Draft: 取消 + 创建/保存/导入/应用; commit disabled if invalid or unchanged as appropriate. Nested steps use Back, not a second competing Cancel beside it.
- Regular screen: navigation/history controls remain available. Do not add tabs or account shortcuts to Home.
- Automatic recovery: preserve content and drafts, retry silently. Exhausted first-load failure gets a deliberate page state; cached-content refresh failure belongs beside the refresh action; pagination failure belongs after the last loaded row; mutation failure belongs beside its initiating control.
- Success: changed content/control state and an accessibility announcement where needed. No routine success alert.
- Destruction: native confirmation with clear scope. Required user decisions may interrupt.

Use [Apple sheet guidance](https://developer.apple.com/design/human-interface-guidelines/sheets) for dismissal and progressive disclosure. Keep app-specific paper popovers as documented exceptions.

## Findings and actionable changes

**P1** = address before extending the UI; **P2** = consistency pass; **P3** = verify or retire. **Confirmed** means evident in current source, not runtime-proven. **Risk** means a specific test is still needed.

### Typography and content alignment

**F01 · P1 · Confirmed: annotation prose is scaled twice.** `ReaderScreen.swift`, `DefinitionView.compactBodySize`, `regularBodySize`, and `section`; `AnnotationMarkdownText.swift`, `body`. The parent uses `@ScaledMetric`, then passes that size to a child which multiplies by another scaled metric. CorpusWordTray and review notes pass unscaled base sizes instead. Make AnnotationMarkdownText accept a base size and own scaling; pass raw 16/17/18 values from DefinitionView. Keep headword scaling under its own explicit role. Acceptance: at Large and AX3, the same saved definition has the same body size from article, web, vocabulary and review; body/headword proportion stays intentional.

**F02 · P1 · Risk: prose helper ignores local trait overrides.** `Shared/LeximoryStyle.swift`, `prose` calls `UIFontMetrics.scaledFont` without a supplied trait collection, whereas interface/display modifiers use local `@ScaledMetric`. Resolve custom prose using the SwiftUI environment at the rendering boundary. Acceptance: a locally overridden Dynamic Type preview and a device-wide size change produce matching prose sizes, without double scaling UIKit text.

**F03 · P2 · Confirmed: headword roles drift.** `ReaderScreen.swift` renders dynamic/static at 20/24; `CorpusWordTray.swift` uses 24; DESIGN.md specifies 20/22 phone/wide. Choose the documented hierarchy, compare on real long French and Japanese words, then apply a single headword role across tray hosts. Keep bold and wrapping; do not use the Chinese display face for headwords.

**F04 · P2 · Confirmed: article header and body start on different insets.** `ArticleReadingHeader.swift` compact title group uses 24 pt while reading/page convention is 20. Screenshot 04 shows this stagger. Align title, topics and audio with prose at 20; keep artwork edge-to-edge. Wide split headers retain their deliberate internal layout. Acceptance: title and first prose line share a leading guide on phone.

**F05 · P2 · Confirmed: fixed empty-state headings use the content-title API.** `LeximoryTheme.swift`, `LeximoryUnavailableView` applies `editorialFont(24)` to all headings. Add a fixed-UI-heading path using displayFont; retain editorial headings for user domains/content. Acceptance: 还没有书签 and article titles use their proper distinct faces.

**F06 · P2 · Confirmed: saved-definition section rhythm differs.** `CorpusWordTray.section` uses a 5 pt label gap; `DefinitionView.section` uses 2. Use one annotation section component with a 2 pt label/content gap and shared body/label roles. Preserve static 24 and dynamic 20 pt outer insets. Acceptance: opening one saved definition from review or a reader has matching label rhythm.

### Presentation, actions and feedback

**F07 · P1 · Confirmed: reading options cannot expand.** `EbookScreen.swift`, `readingSettings` specifies only `.medium`. Add `.large`, choose large initially for accessibility sizes/compact height, and let content scroll. Preserve paper rather than applying ordinary-sheet styling. Acceptance: theme, size, leading, progress and PDF zoom remain reachable at AX5 landscape without clipped controls.

**F08 · P1 · Confirmed: Account interrupts routine changes.** `AccountView.swift` presents notice and failure alerts; avatar update sets notice to 头像已更新. Show the updated avatar immediately and announce success. Keep actionable mutation failures beside the photo/edit row, preserve retry and entered values; keep sign-out/deletion confirmations. Email verification should become a clear in-sheet confirmation state with the destination email.

**F09 · P1 · Confirmed: workspace failures share a generic modal.** `BrowserWorkspaceView.swift`, `workspace.error` alert and pending-link/file catch paths. Separate file-picker validation, resource-open failure and mutation feedback. Invalid file selection returns to the file action with a local explanation; failed navigation gets a resource-specific state with retry while history remains usable. Do not replace automatic retries with visible messages.

**F10 · P2 · Confirmed: bookmark refresh feedback becomes a normal list section.** `BrowserFoldersView.swift`, `refreshFailed` adds a generic section after folders. Keep cached rows, scope a final failed refresh to a compact refresh affordance; folder-specific failures remain within that folder. Suppress feedback during automatic recovery. Acceptance: no generic error card becomes part of a healthy folder list while recovery is active.

**F11 · P2 · Confirmed: folder selection has two competing row actions.** `BrowserFolderPicker.row` nests a small 选择 button inside a DisclosureGroup label. Use a full-width selection row with selected checkmark and a separate, labeled expansion control for contents. Expansion must not choose a folder; choosing must not expand it. Preserve archived folders/new-folder capability. Acceptance: touch, VoiceOver and keyboard have two predictable actions, both with 44 pt targets.

**F12 · P2 · Confirmed: privacy is duplicated and presented differently.** `MembershipPrivacyView` has shared close styling; `AccountEntryPrivacyView` uses a pushed screen and different copy/link affordance. Keep contextual navigation but render one shared privacy content model with account, AI processing and payment sections as applicable. Use underlined primary support links and external arrows. Membership privacy should preferably push within its existing NavigationStack instead of adding another sheet. Preserve accurate contextual disclosures; this is not a proposal to remove consent.

**F13 · P2 · Risk: nested sheets disorient membership users.** MembershipView presents privacy from a membership sheet; Account opens plan selection as a sheet. Push privacy inside the membership stack and keep one obvious way back. Avoid stacked close buttons and preserve selected plan on return. This is a navigation refinement, not a reason to alter StoreKit management sheets.

### Account and learning

**F14 · Withdrawn: retired surface.** Remove the obsolete code and routes; do not restore or redesign this screen.

**F15 · P1 · Risk: quota captions force metric shrinkage.** `AccountQuotaCard` puts usage and `.fixedSize()` reset caption on one HStack; usage may shrink to 65%. At narrow widths/long captions, two cards can lose the 34 pt metric hierarchy. Test 320/375 pt and six-digit totals. Use ViewThatFits: the prescribed baseline row when it fits, a caption below when it does not. This responsive exception should be documented before implementation. Keep two cards side by side except accessibility sizes.

**F16 · P1 · Confirmed: review timeline word targets are underspecified.** `ReviewTimelineView.wordPill` has only a 36 pt minimum; 14 pt historical words with vertical padding do not guarantee 44 pt. Keep compact visible pills but enforce 44 pt minimum interactive bounds without overlapping neighbours; increase row spacing where needed. Acceptance: Accessibility Inspector reports no undersized word control, with unchanged word wrapping/order.

**F17 · Withdrawn: retired surface.** Remove the obsolete code and routes; do not restore or redesign this screen.

**F18 · Withdrawn: retired surface.** Remove the obsolete code and routes; do not restore or redesign this screen.

**F19 · Withdrawn: retired surface.** Remove the obsolete code and routes; do not restore or redesign this screen.

**F20 · Withdrawn: retired surface.** Remove the obsolete code and routes; do not restore or redesign this screen.

**F21 · P2 · Confirmed: EPUB position text omits chapter identity.** `EbookScreen.pageLabel` displays numeric fractions, although its accessibility value sometimes includes chapter. Provide a compact chapter + page role for EPUB, and 第 X 页，共 Y 页 for PDF. Truncate chapter content before shrinking page numerals. Keep 15 pt utility type and top control placement. Screenshot 10 illustrates the installed numeric-only treatment.

**F22 · P2 · Confirmed: review composer scaling uses different text styles.** `ReviewExerciseView` scales translation input from `.caption` while its placeholder uses body-scaled prose(16); daily writing also uses prose(16). Scale all learning input/placeholder text relative to `.body`, preserving language-specific faces and two-line minimum. Acceptance: placeholder and typed text match at every Dynamic Type size.

### Active fallback paths and legacy UI

**F23 · P2 · Confirmed in standalone browser: settings use 完成 for a draft.** `BrowserPreferencesView` edits local choice/remember, saves on 完成, and lacks leximorySheetStyle. Use 取消 / 保存 or 应用, disable unchanged commit, and apply the shared ordinary sheet treatment. Do not add this older settings entry to the primary workspace.

**F24 · P2 · Confirmed in standalone browser: a second bookmark picker bypasses the shared folder language.** `BrowserBookmarkSheet` has its own library-loading/error UI, 选择文库 wording, and no shared sheet style. Reuse the primary folder selector/import contract where this standalone browser remains reachable. Preserve actual bookmark-only semantics; do not force extraction or AI annotation.

**F25 · P3 · Confirmed in legacy library shell: import has a separate visual and action language.** `ContentImportView` uses shell/paper fields, 24 pt insets, 48 pt capsules and 保存/生成/导入 combinations rather than the primary native Form review. `LiveLibraryView` mounts it; AccountRoot does not mount LiveLibraryView. First establish runtime reachability, then remove unused presentation code or migrate actual callers to the shared import review. Do not redesign a dead route or reintroduce library tabs.

**F26 · P3 · Confirmed structural risk: untyped fixed display strings.** Home correctly uses a closed fixed-label enum; `displayFont` itself accepts arbitrary Text everywhere and UIKit navigation appearance globally applies displayUI. Audit each dynamic navigation title and restrict display treatment to fixed copy. No observed Japanese glyph failure is claimed. Acceptance: user names, imported titles and Japanese folders never receive 吉祥宋.

**F27 · P3 · Risk: default sheet style promises more than it implements.** `LeximorySheetStyle` only sets font, tint and grabber. It does not enforce a native background or distinguish information/draft behavior. Define small presentation contracts, not a giant modifier: ordinary native Form, live preview with Close, draft editor with commit, and reader paper tray. Audit call sites; avoid overriding feature artwork or reader styles.

**F28 · P3 · Installed-build observation, current-source recheck required:** the EPUB accessibility snapshot exposed retained bookmark rows and multiple focused web nodes. Current `retainedResources` already hides inactive resources. Recheck on a new authorized build before changing this code. Acceptance: VoiceOver and Voice Control expose only active content and functional chrome.

## Detailed redesign drafts

### A. Account: a quiet personal reading record

Composition: native large title → profile header → full-width actual-plan artwork card → two quota gauges → English preferences → account management → destructive group → cost reference. Keep a 640 pt measure, 20 pt outer inset, 12 pt gaps, 24 pt card corners, 16 pt inner inset.

The plan name is the hero: 初学者 at 30 pt compact, larger only when it fits. Keep the exact cats-and-book artwork and Home day/night meadow, horizon anchored low. One full-card button; its glass CTA label is not a nested button. At large text sizes remove illustration first. Keep unusual billing/cancellation information; omit routine status prose.

Use 17 pt primary regular headings consistently, across active groups. Quota used values remain visually prominent. Profile edit rows use native labeled-content alignment and at least 52 pt height. Show avatar/save feedback at its row and preserve all other controls while an operation runs.

States: cached data displays immediately; initial loading uses a small native indicator in the reserved content area; no-account data uses a designed retry page; offline editing buttons remain present and disabled. Sign-out/deletion remain explicitly confirmed. No new account badge on Home.

Files: AccountView, AccountActivityCalendar, Shared/LeximoryStyle. Dependencies: F08, F14, F15. Acceptance: free/paid/billing-retry, long username, dark, narrow and AX variants; no retired activity heatmap returns.

### B. Bookmarks and folder choice: native organization, literary content

Keep 我的书签 as the fixed display heading. Folder names use content typography, language labels secondary 13 pt, and resources use readable Garamond/serif titles. Maintain native grouped surfaces; avoid inserting another card within each folder. Preserve archive grouping and the existing workspace history.

The folder picker is a decision surface: each row selects the folder, with a visible selected checkmark. An independent expand control reveals examples; label it 展开文件夹内容. New Folder is a native action and returns to the selection with the new folder selected. A nested folder editor should use the existing stack when practical.

Resource titles wrap at large text sizes rather than always stopping at two lines. Topics remain secondary and optional. Retry appears only for the affected folder/page after automatic recovery. On iPad keep the 640 pt measure in its own window; do not add a sidebar or tab navigation without a separate product decision.

Files: BrowserFoldersView, BrowserImportSheet. Dependencies: F10, F11. Acceptance: empty/cached/denied folders, long Japanese names, archived folder selection, creation failure, VoiceOver expansion and selection.

### C. Definition: one editorial object in every host

Treat the definition as a shared content object with host-specific framing. Its order is headword → 释义 → optional 语源 → optional 同源词 → optional ephemeral 参考 → actions. Labels are muted interface text, content is language-aware prose, phonetics use bracketed Source Code Pro. Never display an empty optional section.

Static: anchored popover on iPad or fitted phone tray, 400 pt measure, 24 pt inset. Dynamic: top-anchored content-sized card, 36 pt corners, 20 pt inset, capped at 78% of available height; overflowing text scrolls inside. Keep the exact anchored selection geometry. Do not convert these into ordinary settings sheets.

Loading shows only 正在理解语境 and a neutral spinner. Reveal the headword when meaningful prose exists. Preserve partial readable text during automatic recovery. Reveal save/edit actions after validated completion, retain confirmed-save state and original action placement below prose. Context determines editing permission; saved-word external dictionary links remain supported where already specified. No destination selector returns to the tray.

Use raw base sizes plus one local scale. The same definition should look recognizably identical from reading, saved vocabulary and review. Preserve real italics, bold headwords, ruby, wrapped highlights and all save authorization/quotas.

Files: ReaderScreen, AnnotationMarkdownText, VocabularyLibraryView, VocabularyEditor. Dependencies: F01–F03, F06. Acceptance: loading/streaming/partial failure/ready/saving/saved/edit failure; long headwords; Chinese/Japanese ruby; AX1/AX5; reader offset unchanged.

### D. Reading controls: paper below, functional glass above

Article: edge-to-edge newspaper cover, wrapping content title aligned to the 20 pt prose inset, topics and visible full-article audio action beneath it. No opaque bottom strip. Audio remains at most 420 pt wide, 12 pt internal inset, with a real 44 pt slider target and close/play controls. Keep last-line scroll clearance.

EPUB/PDF: preserve top controls, center-tap reveal, workspace address bar, and the original theme swatches. Reading options open fitted/medium when short but expand to large; preserve paper and reader context. EPUB shows chapter + page; PDF uses an explicit page count. Contents rows navigate; AI generation, undo and redo live together in the header with native controls. Never turn these into decorative list rows.

Files: ArticleReadingHeader, EbookScreen, PDFOutlineControls, PlaybackBar. Dependencies: F04, F07, F21. Acceptance: rotation preserves CFI/PDF position, theme changes do not repaginate unexpectedly, options accessible at AX5, bookmarks retained, handwriting colors preserved.

### E. Review: a garden for activity, a page for language

Timeline keeps the documented 720 pt measure and 24 pt inset as an intentional feature exception. Fixed heading, unboxed historical days, gentle Today surface, wrapping word pills, and per-language progress remain. Keep the web's review palette; enforce 44 pt interaction bounds independently of visual pill height. Use local calendar dates and keep progress accessible beyond its visual segments.

The current source already moves the lawn to full-bleed ReviewMeadow artwork and removes the redundant language/progress header. Preserve that design. Do not recreate the older screenshot's cutout lawn. Exercise overlays use a pale paper surface with a quiet 1 pt frame, fixed Chinese display heading, prose prompt and a compact sage composer. Input and placeholder share a body-relative font scale.

Keyboard motion changes overlays only. The scenery, task positions and cats keep their geometry. At accessibility sizes use the documented linear task arrangement rather than reducing text. Evaluation highlights retain praise/correction semantics and details; show text/icons as needed when color differentiation is unavailable. No streak reminders, threshold ornaments or extra success cards.

Files: ReviewTimelineView, ReviewSessionView, ReviewExerciseView. Dependencies: F16, F22. Acceptance: switching exercises retains drafts; keyboard, IME, failed submission, returning pending evaluation, Reduce Motion and large text; no answer disappears during polling.

### F. Import and account entry: deliberate native tasks

Use BrowserImportSheet as the canonical import: one native Form, explicit save mode, editable title, shared folder choice, website rule toggle, inline visual full-text editor and one commit action. Keep automatic metadata subtle and cancellable per field; do not block valid submission on suggestions. Errors sit by the affected field/action, preserving the draft and operation identity. File limits appear only when selection needs correction, not as a permanent storage dashboard.

Account entry keeps its contextual word/quote or clear benefit, fields and single primary action, with the original AccountMeadow illustration lower down. All ordinary fields/controls use the utility typography; selected text and carets remain native blue. Confirmation and recovery states name the email and next action. Share privacy content with membership while keeping contextual sections. No credentials, destructive actions or purchases are needed to validate the visual draft.

Files: BrowserImportSheet, BrowserFoldersView, OptionalAccountView, MembershipView. Dependencies: F09, F11–F13, F23–F25. Acceptance: cancel versus commit, title autofill races, nested back navigation, accessible keyboard flow, errors with drafts retained.

## Remaining surfaces: preserve and finish deliberately

- **Home and wallpaper:** retain the exact four-card compositions, local wallpaper sampling, original day/night assets and pin/recents treatment. No confirmed default-size visual defect was found in screenshots 01–02. Verify full fixed card labels and compact address matches at AX sizes; do not enlarge the normal 304 pt grid as a cosmetic change.
- **Web recovery and ad blocking:** the current BrowserLoadFailureView and BrowserAdBlockingSettings already follow much of the desired native language. Retain domain-led recovery, Reload/Safari actions, draft switches and explicit Apply. Check keyboard/large-text reachability and quiet automatic recovery before proposing cosmetic changes. External page typography must stay under the website's control.
- **Onboarding:** retain the original introduction, real italic AI emphasis and cat/lawn composition. The prose sizes are already backed by scaled metrics; the decorative lawn is intentionally fixed and accessibility-hidden. Do not misreport those fixed artwork labels as a Dynamic Type defect. Make the start action, body copy and supported orientation the verification focus.
- **Registration, recovery and deletion:** retain contextual entry benefits and the existing native field behavior. Reuse typography, support-link affordances and privacy content; avoid flattening different account states into one generic form. Deletion needs a clear consequence description, separate subscription-management guidance, explicit destructive confirmation, persistent pending state, and local retry when unfinished. Never disguise deletion as an ordinary Save action.
- **Membership:** preserve the existing cats/book illustration, localized StoreKit prices, selected-state checkmark, clear renewal copy, restore and management behavior. The current source already includes the selected price in Subscribe; screenshot 06 does not. Verify long localized prices and billing states; do not change purchase or delivery authorization as part of design work.
- **PDF outlines, notes and handwriting:** preserve system reading controls, source-page geometry, native zoom rows, existing usable outline during generation, session undo/redo, and failure feedback beside the generation action. No additional decorative AI badge, progress dashboard or second retry control is proposed. A real PDF/Pencil pass remains necessary.
- **Audio:** preserve the compact functional glass bar, original title-free layout, elapsed/total timing and seek-on-release. Its UIKit slider explicitly owns a 44 pt touch region and accessible value; do not flag small timestamp type alone as a broken interaction.
- **Widget:** preserve its English copy and mesh artwork, real font roles, white today metric and cumulative area composition. Fixed geometry is a widget-host constraint, not automatically a Dynamic Type violation. Verify small/medium, tinted, Light/Dark, Shanghai midnight and cold-launch tap behavior in WidgetKit. No widget defect was established from a host screenshot in this session.

## Implementation order and review gates

1. **Typography and interaction correctness:** F01, F02, F07, F16, F22. Verify equal definition sizes, readable options and all hit targets before visual polish.
2. **Restore coherent Account/vocabulary states:** F08, F14, F15, F17–F20. Preserve pre-existing Account edits and exact artwork/calendar colors.
3. **Shared object consistency:** F03–F06, F10–F13, F21. Share definition content, folder selection and privacy presentation; avoid a universal card wrapper.
4. **Consolidate actual callers:** F23–F27. Establish standalone/legacy reachability, migrate needed flows, then remove redundant presentation code.
5. **New-build visual review:** recheck F28 and the installed-build differences. Build/installation is a separate step; no source issue should be accepted as fixed solely from these older screenshots.

For each slice, capture the same task on narrow phone, normal phone and iPad split view; Light/Dark; Large/AX3/AX5; Reduce Motion/Transparency; Increase Contrast; keyboard up/down; long Latin/Chinese/Japanese titles. Use contrast measurements on rendered text/material combinations, not guessed hex values. VoiceOver must read meaningful labels, selection state and local failure without traversing hidden screens. Record omissions rather than claiming accessibility compliance.

Success means the same kind of text, control, task and state behaves consistently, while Home, paper reading and native management retain their distinct purposes.

## Source map

Line numbers refer to the audited working tree, not the installed binary.

| Source | Anchor |
| --- | --- |
| [App/Reader/ReaderScreen.swift](../../apps/leximory-ios/App/Reader/ReaderScreen.swift#L275) | Line 275: `@ScaledMetric(relativeTo: .body) private var compactBodySize` |
| [App/Reader/AnnotationMarkdownText.swift](../../apps/leximory-ios/App/Reader/AnnotationMarkdownText.swift#L4) | Line 4: `struct AnnotationMarkdownText` |
| [Shared/LeximoryStyle.swift](../../apps/leximory-ios/Shared/LeximoryStyle.swift#L117) | Line 117: `static func prose(` |
| [App/Reader/ArticleReadingHeader.swift](../../apps/leximory-ios/App/Reader/ArticleReadingHeader.swift#L25) | Line 25: `titleAndTopics.padding(.horizontal, 24)` |
| [App/LeximoryTheme.swift](../../apps/leximory-ios/App/LeximoryTheme.swift#L3) | Line 3: `struct LeximoryUnavailableView` |
| [App/Reader/EbookScreen.swift](../../apps/leximory-ios/App/Reader/EbookScreen.swift#L451) | Line 451: `private var readingSettings` |
| [App/AccountView.swift](../../apps/leximory-ios/App/AccountView.swift#L107) | Line 107: `.alert("账号"` |
| [App/AccountView.swift](../../apps/leximory-ios/App/AccountView.swift#L166) | Line 166: `private func stats` |
| [App/AccountView.swift](../../apps/leximory-ios/App/AccountView.swift#L422) | Line 422: `private struct AccountQuotaCard` |
| [App/Browser/BrowserWorkspaceView.swift](../../apps/leximory-ios/App/Browser/BrowserWorkspaceView.swift#L193) | Line 193: `.alert("暂时无法完成"` |
| [App/Browser/BrowserFoldersView.swift](../../apps/leximory-ios/App/Browser/BrowserFoldersView.swift#L48) | Line 48: `if refreshFailed` |
| [App/Browser/BrowserFoldersView.swift](../../apps/leximory-ios/App/Browser/BrowserFoldersView.swift#L170) | Line 170: `struct BrowserFolderPicker` |
| [App/Review/ReviewTimelineView.swift](../../apps/leximory-ios/App/Review/ReviewTimelineView.swift#L129) | Line 129: `private func wordPill` |
| [App/Review/ReviewExerciseView.swift](../../apps/leximory-ios/App/Review/ReviewExerciseView.swift#L14) | Line 14: `private var translationFontSize` |
| [App/Browser/BrowserPreferencesView.swift](../../apps/leximory-ios/App/Browser/BrowserPreferencesView.swift#L4) | Line 4: `struct BrowserPreferencesView` |
| [App/ContentImportView.swift](../../apps/leximory-ios/App/ContentImportView.swift#L5) | Line 5: `struct ContentImportView` |
| [App/MembershipView.swift](../../apps/leximory-ios/App/MembershipView.swift#L44) | Line 44: `.sheet(isPresented: $showsPrivacy)` |
| [App/OptionalAccountView.swift](../../apps/leximory-ios/App/OptionalAccountView.swift#L408) | Line 408: `private struct AccountEntryPrivacyView` |
| [App/Browser/BrowserWorkspaceView.swift](../../apps/leximory-ios/App/Browser/BrowserWorkspaceView.swift#L359) | Line 359: `private var retainedResources` |
