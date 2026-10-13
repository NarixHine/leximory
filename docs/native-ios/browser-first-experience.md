# Leximory: a browser for language learning

Agreed product brief, 2026-10-13. Implemented locally in the native app and mobile API. See [verification and deployment notes](browser-first-verification.md).

## Product structure

Use one sequential browsing history for websites, saved links, articles, ebooks, Home, and My Bookmarks. Remove the current app navigation tabs. Preserve existing authorization, quotas, reading positions, editing, automatic caching, and archive behavior.

App-authored UI calls libraries 文件夹. My Bookmarks is the collection of saved resources; it is distinct from existing word and ebook-passage bookmarks. Keep that implementation distinction out of UI.

A fresh launch opens Home without loading a webpage. Returning to an existing session preserves the current resource. Home is one tap away and can offer a quiet 继续阅读 shortcut without automatically opening it. Account is available through a recognizable profile button on Home and through More elsewhere.

## Home

Show the logo and Leximory at the top. Three rounded cards have staggered tilts, icons, rainbow-themed backgrounds, and bold borders in related colors:

- 浏览网页 opens the address composer with an explicit 粘贴并打开 action. Ordinary text does not automatically become a clipboard URL.
- 我的书签 opens saved resources grouped in expandable folders.
- 打开电子书 opens the native EPUB/PDF file picker.

When address input and the keyboard appear, the cards fold and morph into compact, labeled actions in the remaining space. They stay fully colored, legible, interactive, and above the iOS overlay background. Preserve comfortable tap targets; use a simpler arrangement for large text and short viewports. Reduce Motion preserves all actions without folding movement.

## History and persistent controls

Back and Forward navigate the same history across resource types. Opening a new destination after going Back replaces the forward branch. Restore scroll position, book position, and folder expansion on return.

Destinations create history entries. Folder expansion, dialogs, scrolling, and ebook page turns do not. Preserve meaningful webpage history without introducing a second, conflicting navigation model.

Use native WebKit history gestures where applicable. Screen-edge gestures and horizontal gestures on the bottom bar navigate resource history. Content-area gestures retain ebook page turning, PDF interaction, and website behavior.

Keep a compact floating bottom bar on iPhone and iPad with Back, Forward, resource identity, and More. Websites additionally expose a separate magic-colored save button. Non-web resources display an appropriate icon and readable title, never a fabricated URL.

Tapping the resource capsule opens the address composer. Keep the current resource until submission; cancelling preserves it. Home remains one tap away. Integrate reading actions into contextual menus and temporary controls instead of stacking permanent toolbars. Coordinate article playback and ebook pagination with the bar. Reading content continues behind translucent controls to the bottom edge. System sheets and file pickers can temporarily cover the bar.

## My Bookmarks and folder selection

Use native iOS list, disclosure, context-menu, sheet, and form conventions, with a small recent-reading section above folders. Tap a folder to expand its indented resources inline. Show articles, saved links, and ebooks together with distinguishing icons.

Folders retain one language each. Use muted secondary text for language and metadata; use · between compact metadata items. Preserve cached-first presentation, per-folder isolation, and existing archive categorization. Archived folders appear in a collapsed section. Search finds resources inside collapsed folders.

Keep existing management actions, including rename and archive, in native context menus. Offer 新建文件夹 in My Bookmarks and import selection. Its small form asks for name and language, then returns to the previous task with the new folder selected. Import destinations must be writable folders; vocabulary warehouses are not content-import destinations.

Remove the corpus entrypoint. Keep a quiet 已存词汇 entry in More and retain vocabulary editing through definitions and annotations. No save-destination selector appears in the dynamic definition tray.

## Vocabulary and website preferences

Never resolve language when authorized resource or folder metadata already establishes it. Use Jev only when language is genuinely unknown. Do not trust webpage language declarations or Defuddle language metadata for routing or folder suggestions. Preserve the existing language-warehouse behavior.

Vocabulary destination precedence:

1. A saved resource uses its folder, subject to existing ownership and authorization behavior.
2. An unsaved webpage uses its configured website folder.
3. Otherwise, save to the user's vocabulary warehouse for the resolved language.

A new website navigation evaluates the destination's own identity and preference; it must not inherit an unrelated saved link's folder. Preserve existing normalized-domain matching, including distinct subdomains.

The import switch 本网站总是存于此文件夹 governs both future import preselection and vocabulary destination. It is off until explicitly enabled. Future imports still show their dialog; the preference does not import pages automatically.

If an independently known language conflicts with a website preference, vocabulary uses the appropriate language warehouse. For article imports, present a detected language mismatch and offer another folder rather than silently changing the destination. Do not run language resolution merely to manufacture a mismatch check when language is already established.

## Article import

The website save action runs Kepano's Defuddle inside the loaded webpage and extracts title and main content. Review uses native controls with two choices:

- 导入并预注释全文, selected by default.
- 存为链接书签.

Show an editable title, folder row, and 本网站总是存于此文件夹 switch. Full-text mode also shows a short, safely rendered Markdown preview and 编辑全文, which opens a focused editor. Link-only mode hides the content section. Folder selection reuses the expandable native selector. Keep one final primary action.

Full-text import opens the saved article immediately, readable while annotations are prepared. Updates preserve text position. Link-only import saves the link through the existing bookmark behavior.

## Annotation activity

More exposes pending, ready, and failed article annotation work across the app. A small dot indicates pending work. A numbered badge counts newly ready articles the learner has not opened. Opening More does not acknowledge them; opening the corresponding article does. Failures remain visible with a retry action.

When the current article completes, reveal highlights in a brief staggered sweep across visible text, with a small completion flourish near the bar. Do not shift text or scroll position. Other annotations become available immediately without replaying the animation during scrolling. Reduce Motion reveals highlights together without movement. Completion elsewhere updates the badge without navigating away.

## Ebook import

Native file picker → folder-selection sheet → reader.

The sheet shows the selected filename, an optional title-edit action, expandable folders, and one primary 打开 button after selection. No separate confirmation dialog is needed. Cancelling before submission creates nothing; failed import preserves selection for retry.

Preserve the current 4.5 MB import limit for this redesign and explain an oversized-file failure clearly. Increasing upload capacity is separate scope.

## Visual direction and verification

Playful color and motion concentrate on Home, the website save action, and completion feedback. Library lists and reading controls use restrained native conventions. Use muted labels for hierarchy rather than decorating secondary information. Preserve legibility in dark appearance and with Dynamic Type.

Implementation must reconcile superseded navigation rules in the native DESIGN.md, preserve real account data, and avoid database schema changes. Verify unified history and gesture arbitration, normal-account startup, phone and iPad layouts, keyboard transitions, native sheet dismissal, cached folder behavior, import cancellation and retry, vocabulary routing, and annotation completion while both viewing and leaving an article. Test real EPUB/PDF reading, including Japanese page direction, plus Reduce Motion and large text.
