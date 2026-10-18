# iOS sheet and dialog audit

Date: 2026-10-18. Status: proposal awaiting human approval.

This is a source review of the current working tree. No simulator, build, app launch, account action, or database operation was performed. No app code or design rules were changed. Native system defaults described below are inferred from the presentation code; their rendered appearance has not been checked.

The working tree already contains account, Home, design-document and membership changes. Those are included as they currently stand. Membership is an untracked implementation, so its entries describe work in progress. The pre-existing `dialog-audit-2026-10-18/01-sign-out.png` was left untouched and was not used as evidence.

## Recommendation

Use the wallpaper editor's direct manipulation and preview as the model for immediate preferences, the ebook controls' explicit paper and ink as the visual model, and the browser import/account editors' Cancel plus an action verb as the model for changes that require submission.

There should be one visual language with different behavior for different tasks. A setting that has already taken effect needs a way to close. An unsaved edit needs Save. A destructive choice needs a consequence and a specific destructive action. Reading annotations and review exercises should retain their specialized placement.

This follows [DESIGN.md](../../apps/leximory-ios/DESIGN.md): paper content, neutral interface labels, bundled interface typography, native presentation, and feedback beside the affected control. The [theme](../../apps/leximory-ios/App/LeximoryTheme.swift) already supplies the necessary colors and fonts.

## Current inventory

All app Swift files were searched for sheet, popover, alert, confirmation-dialog, full-screen-cover, toolbar action, file-picker and custom overlay implementations. No SwiftUI full-screen-cover presentation was found. Repeated callers of the same component are grouped below.

### Settings, editors and information sheets

| Existing presentation and source | Background and text | Confirmation and dismissal today |
| --- | --- | --- |
| [主页壁纸](../../apps/leximory-ios/App/Browser/HomeWallpaperEditor.swift), presented by `BrowserWorkspaceView` | Native sheet background is implicit. Scroll layout, 24 pt inset, 400 pt content measure, inline title, 17 pt interface text. Live Home preview has 32 pt corners. Photo action is sage and filled; reset/solid actions are neutral. | Photo selection, Restore Default and Solid Color persist immediately. Top-right 完成 only dismisses. No explicit detents or grabber. Interactive dismissal and 完成 are disabled while importing. Errors sit below the photo action. |
| [广告拦截](../../apps/leximory-ios/App/Browser/BrowserAdBlockingSettings.swift), from workspace and standalone browser | Native Form with implicit grouped background, inline title, 17 pt interface text. Explicit `.form` presentation sizing. 网站例外 pushes a child list. | Changes are a local draft. 取消 discards; 完成 commits, or 应用并重新载入 commits and reloads the applicable current GET page. No change simply dismisses. Swipe dismissal is blocked while applying; Cancel remains available and cancels the task. Footer explains reload consequences. |
| [网页、链接、电子书和 PDF 导入](../../apps/leximory-ios/App/Browser/BrowserImportSheet.swift) | Native Form, inline title, 17 pt interface type, neutral tint. Custom 13 pt primary-colored section headings. Full-text preview uses prose typography. Large detent and visible grabber. | 取消 and 导入/保存 as appropriate to the mode. Folder selection and 编辑全文 push child screens. Submission shows a spinner, blocks repeated submission and dismissal, and preserves errors. An uncertain result disables resubmission. |
| [选择文件夹](../../apps/leximory-ios/App/Browser/BrowserFoldersView.swift), child of import | Native List, inline title, 17 pt interface text. Expandable folders, selected state and resource previews. | 选择 updates the parent draft and returns. Native Back returns without submitting the import. 新建文件夹 opens another sheet. No nominal Finish button. |
| [新建文件夹 / 重新命名](../../apps/leximory-ios/App/Browser/BrowserFoldersView.swift) | Native Form, 17 pt interface type, neutral tint; medium-only sheet. | 取消 plus 完成. 完成 creates or renames remotely, so it is a real submission. Spinner, disabled actions and blocked swipe while busy. |
| [主页快捷方式](../../apps/leximory-ios/App/Browser/BrowserHomeView.swift), `BrowserPinEditor` | Native Form, inline title, 17 pt interface type. Primary-colored section headers. A computed fixed-height detent, with no large fallback. | 取消 discards title/address changes; 保存 commits the pin locally and dismisses. No explicit busy state is needed for the synchronous save callback. |
| [文章 / 电子书编辑](../../apps/leximory-ios/App/Browser/TextManagementSheet.swift) | Native Form, inline title, 17 pt interface text, neutral tint; default sheet size. Loading scene and first-load retry scene replace the form when needed. | 取消 and 保存 commit metadata/content. Child 编辑全文 hides those parent actions. Swipe is blocked while busy or inside a child screen. File replacement, reload-discard and deletion have separate confirmations. Save conflict feedback is a top inset; deletion and file errors use local footers. |
| [编辑全文](../../apps/leximory-ios/App/Browser/ArticleEditor.swift), child of import or text management | Explicit paper background, neutral controls, inline title. Formatting strip above a WebKit editor with language-specific prose type. | 完成 reads Markdown from the editor, writes it to the parent draft and returns. Native Back is hidden; 返回 appears only after an editor load failure. This 完成 is functional, although it does not save the parent article remotely. |
| [用户名 / 邮箱 / 密码](../../apps/leximory-ios/App/AccountView.swift), `AccountEditor` | Native Form, inline title, 17 pt interface text; medium and large detents. Error is a red row in a separate section. | 取消 and 保存. Swipe and actions are blocked during save. Email success opens a second alert, 请确认新邮箱, whose 好 closes the editor. Other successful saves close directly. |
| [会员方案 / 我的会员](../../apps/leximory-ios/App/MembershipView.swift), work in progress | Explicit paper and ink; 16 pt interface text, custom plan content and artwork. Large detent with custom 560 × 820 proposal for larger windows. | Top-right 完成 only dismisses. Purchase, restoration and subscription management are distinct actions. Interactive dismissal is blocked while the store is busy, but the toolbar 完成 has no matching disabled condition. A success scene has 继续阅读. |
| [隐私说明](../../apps/leximory-ios/App/MembershipView.swift), work in progress, nested sheet | Paper scroll view, 24 pt inset, 16 pt body and 18 pt section headings, inline title. | 完成 only dismisses. Contact link is a separate action. Sheet size/grabber are implicit. |
| [登录](../../apps/leximory-ios/App/OnboardingView.swift), first-launch welcome sheet | Large detent, visible grabber, inline title. Child [SignInView](../../apps/leximory-ios/App/AppRootView.swift) uses 28 pt insets, shell-backed credential fields and a filled ink login capsule. Interface body 17 pt with a 24 pt heading. | Top-left 取消 is muted and deliberately has no native shared toolbar background. 登录 is the real action in the content. Returning/expired sessions use the same sign-in content as a page, not a sheet. |
| [文章注释队列](../../apps/leximory-ios/App/Browser/BrowserWorkspaceView.swift), `BrowserAnnotationSheet` | Native List and implicit background, medium/large detents, neutral tint. Rows reuse resource typography, with spinner, checkmark or Retry. | 完成 only dismisses. Opening an article also closes the sheet. No explicit grabber. |

### Reading trays and contextual dialogs

| Existing presentation and source | Background and text | Confirmation and dismissal today |
| --- | --- | --- |
| [电子书目录](../../apps/leximory-ios/App/Reader/EbookScreen.swift) | Explicit paper, plain List, ink chapter labels, inline title. iPad popover with 360 pt minimum width; phone sheet with medium/large detents. | Chapter selection navigates and closes. Outside/system dismissal. No Finish. Its ideal height follows chapter count, but the phone detents remain medium/large. |
| [荧光笔摘录](../../apps/leximory-ios/App/Reader/EbookScreen.swift) | Paper scroll view, spaced quote cards, inline title; iPad popover with 400 pt minimum width, phone medium/large sheet. Prose stays language-specific. | Selecting a navigable quote jumps and closes. Outside/system dismissal. No Finish. Empty state uses the shared unavailable view. |
| [阅读选项](../../apps/leximory-ios/App/Reader/EbookScreen.swift) | Paper and ink, 24 pt inset, 17 pt interface type. Theme swatches, font/leading sliders or full-width PDF zoom rows. iPad popover; phone medium-only sheet with visible grabber. | EPUB preferences apply immediately. PDF zoom actions apply and close. No Finish. |
| [手写笔记 problems](../../apps/leximory-ios/App/Reader/PDFNotesModel.swift), `PDFNotesProblems` | Native List, implicit background, inline title, 16 pt interface type. Minimum width 320, ideal height 440, medium/large detents. Presents from the pencil button as a popover without an explicit phone adaptation. | 完成 only dismisses. Retry and version-selection actions actually act. A conflict shows both drawing previews and explicit choices. |
| [Static annotation definition](../../apps/leximory-ios/App/Reader/ReaderScreen.swift) and [iPad presenter](../../apps/leximory-ios/App/Reader/ReadingTextView.swift) | Annotation background `#FAFAFA` light / `#18181B` dark, 24 pt inset, bold prose headword and prose definition. Phone content-height detent capped at 560 plus large; iPad 400 pt anchored popover. iPad explicitly matches the popover arrow/background. | Dismiss with outside tap/system gesture or accessibility escape. Save/Edit/Dictionary remain below the definition. Editing happens within the same tray. No Finish. |
| [Dynamic 猫忆查](../../apps/leximory-ios/App/Reader/ReaderScreen.swift), `DefinitionTopTray` | Custom top-anchored glass card, 36 pt corners, shadow, maximum 512 pt width and 78% available height. 20 pt side inset and smaller dynamic headword/body than static definitions. No opaque annotation background in this mode. | Outside tap, upward drag or accessibility escape dismisses. Downward drag resists. Save morphs through saving/checkmark/edit states; no general confirmation toolbar. |
| [已存词汇 detail](../../apps/leximory-ios/App/VocabularyLibraryView.swift), reused by [review timeline](../../apps/leximory-ios/App/Review/ReviewTimelineView.swift) | Shell background, 24 pt inset, 24 pt bold prose headword. 400 pt iPad popover with 32 pt corners; phone fitted-height sheet capped at 720 plus large, visible grabber. | Edit/Delete/Dictionary below content. Delete has a destructive confirmation and blocks dismissal while running. No Finish. |
| [词汇编辑](../../apps/leximory-ios/App/Reader/VocabularyEditor.swift), embedded in both definition views | Prose inputs on paper-backed 16 pt rounded fields, 15 pt interface labels. Inherits its parent's annotation, glass or shell background. | Bottom icon actions: checkmark for 保存修改 and xmark for 取消. Checkmark submits and returns to reading state while persistence proceeds. This is a real save, not general dismissal. |
| [复习翻译 / 每日练笔](../../apps/leximory-ios/App/Review/ReviewExerciseView.swift) and [lawn container](../../apps/leximory-ios/App/Review/ReviewSessionView.swift) | Custom overlay, pale shell at 96% opacity, 32 pt corners and thick muted frame; separate monospace composer with thin frame. Prose prompts and answers, with specialized review type. | Submit arrow evaluates; Return submits translations. Empty lawn or the workspace Back control closes the tray. Drafts live in the model. No extra Cancel or Finish. This is deliberately not a sheet. |
| [复习润色 / 表达说明](../../apps/leximory-ios/App/Review/ReviewAnnotatedAnswer.swift) | Native anchored popover retained on phone; implicit background. 24 pt inset, 14 pt secondary label, 20 pt original prose and 17 pt explanation. Ideal width 320, max 360. | Outside dismissal. No action toolbar or Finish. |
| [网页/PDF 保存失败](../../apps/leximory-ios/App/Browser/BrowserWorkspaceView.swift), attached to save control | Native popover retained on phone; implicit background. 20 pt inset, max width 320, 15 pt interface text. | Retry when recoverable; outside dismissal. No Finish. |

### Secondary and older paths still in source

The normal signed-in root is `AccountRoot → BrowserWorkspaceView`. `LiveLibraryView` has no caller in the current app source. The standalone `TextBrowserScreen` controls are hidden when embedded in the workspace. These variants should be recorded but should not set the standard for the main app.

| Presentation | Current representation and behavior |
| --- | --- |
| [词汇收藏设置](../../apps/leximory-ios/App/Browser/BrowserPreferencesView.swift) | Native Form with implicit background and inherited interface type; no explicit sizing, detents or grabber. Cancel plus 完成, which saves destination preferences. However, swipe-deleting an existing website rule commits immediately, even if Cancel is later pressed. No interactive-dismiss guard. |
| [存为书签](../../apps/leximory-ios/App/Browser/BrowserPreferencesView.swift), `BrowserBookmarkSheet` | Native List, implicit background and sizing, inline title. Cancel only; selecting a folder saves immediately and closes. Busy blocks Cancel/swipe. Metadata uses 13 pt interface type. |
| [创建文章](../../apps/leximory-ios/App/ContentImportView.swift), via `RemoteTextGallery` | Shell background, paper input boxes, 24 pt inset and 580 pt measure; 18 pt prose inputs. Large-only sheet. Muted plain Cancel with toolbar background hidden. Content contains several different action styles: secondary bookmark capsule, muted Save text and filled ink Generate/Import capsule. Busy blocks swipe. |
| [Archive/link failure alerts](../../apps/leximory-ios/App/CatalogViews.swift) and [LiveLibraryView](../../apps/leximory-ios/App/LiveLibraryView.swift) | System alerts with a single 完成 that only acknowledges the error. The old gallery/import flow is reached through these older library components and fixture paths. |

### Alerts, destructive choices and system presentations

| Variant | Existing content and action pattern | Proposed treatment |
| --- | --- | --- |
| [Account sign-out](../../apps/leximory-ios/App/AccountView.swift) | System alert, 退出登录？, destructive 退出登录 plus 取消. | Keep a system confirmation with an explicit action. Add consequence copy only if useful; do not turn it into a styled content sheet. |
| [Account failure and notice](../../apps/leximory-ios/App/AccountView.swift) | System alerts, 操作未完成 or 账号, with 好. Notice includes routine avatar success. | Put field/action errors beside their control; make routine success nonmodal. |
| [Email follow-up](../../apps/leximory-ios/App/AccountView.swift) | Second alert, 请确认新邮箱, explanatory message and 好 that dismisses the editor. | Replace the form after success with a compact confirmation state explaining the next email step. Use 关闭 to leave that state. |
| [Workspace failure](../../apps/leximory-ios/App/Browser/BrowserWorkspaceView.swift) | System 暂时无法完成 alert with 完成. Used by failures including file selection/opening. | Use the affected action's feedback or a deliberate failed-open state with retry. No nominal Finish acknowledgement. |
| [Clear browser data](../../apps/leximory-ios/App/Browser/BrowserWorkspaceView.swift), duplicated in [standalone browser](../../apps/leximory-ios/App/Browser/TextBrowserScreen.swift) | Native confirmation dialog, clear question, destructive 清除浏览数据 plus Cancel, explanation of cookies/site sign-out and preserved bookmarks/words. | Keep the wording and system structure. Attach to the triggering menu/control rather than the outer page where possible. |
| [Replace ebook](../../apps/leximory-ios/App/Browser/TextManagementSheet.swift) | Native destructive 替换 confirmation; reading-position reset and preserved highlights explained. | Keep. |
| [Reload after edit conflict](../../apps/leximory-ios/App/Browser/TextManagementSheet.swift) | Native 舍弃当前修改？ confirmation; destructive 重新载入 and warning that unsaved changes are lost. | Keep. |
| [Delete article / ebook](../../apps/leximory-ios/App/Browser/TextManagementSheet.swift) | Native question, destructive 删除, Cancel, irreversible consequence and preserved vocabulary. | Keep; make the action itself 删除文章 or 删除电子书. |
| [Delete vocabulary](../../apps/leximory-ios/App/VocabularyLibraryView.swift) | Native question, destructive 删除 and Cancel; irreversible consequence. | Keep; use 删除词汇 for the destructive action. |
| Photos, Files, Share, Apple subscription management | `PhotosPicker` in wallpaper/account, `fileImporter` in workspace/edit/import, `ShareLink` in browser/readers/account, `manageSubscriptionsSheet` in membership. | Keep system-owned UI. Unify only Leximory's entry labels and handoff behavior. |
| Menus, selection menus, find, toasts and load feedback | Native More/context/selection menus; native webpage/PDF find. Workspace uses brief glass notices for invalid clipboard links and annotation completion. Browser load failure uses an action-local glass retry panel. | Preserve their distinct purpose. They are not additional sheet templates. The local retry panel is a better failure reference than the global error alert. |

## Proposed shared language

| Concern | Proposed rule |
| --- | --- |
| Background | App-authored settings, edit and information sheets use explicit `paper`: white in light appearance and `#100F0F` in dark. Grouped fields/rows use `shell` and quiet separators. The native sheet container and navigation controls retain native geometry/material behavior. Do not add a full-sheet glass effect. |
| Text | Standard body and control labels use scaled `interface(17)`, Raleway with bundled Chinese serif fallback. Inline sheet titles follow the existing global 17 pt navigation appearance. Supporting text uses secondary color and a suitable scaled footnote size. Imported prose, dictionary headwords, membership display titles and review monospace retain their semantic fonts. |
| Color | General actions and labels use neutral ink/primary. A filled primary content button uses ink with paper text. Retain sage and the established Home palettes for previews/content, rather than making every confirmation green. Destructive actions keep the native destructive treatment. |
| Spacing | Custom sheet content uses 24 pt padding and 16/24 pt spacing. Native Forms/Lists keep native row metrics. Do not force every task into the wallpaper editor's 400 pt content width. |
| Shape | Native sheet corners and popover arrows remain native. Use existing 16 pt field corners and 32 pt preview/card corners where appropriate. Keep the dynamic definition's 36 pt card as an intentional exception. |
| Immediate preferences and information | Top-right native xmark control, accessibility label 关闭. No Cancel and no 完成. A visible grabber on phone and system dismissal also work. Closing preserves settings already applied. Applies to wallpaper, membership browsing, privacy and annotation activity. |
| Draft submission | Top-left 取消, top-right 保存 / 创建 / 导入 / 应用. No duplicate bottom primary action. A purchase or sign-in flow may retain a prominent content action because it has explanatory content and terms. |
| Reader popovers | Outside tap/system gesture remain the dismissal pattern. Do not add toolbar close buttons to the compact definition/contents/settings popovers. Keep accessibility escape and keyboard dismissal available. |
| Height | Short sheets fit content and can grow to large for keyboard/Dynamic Type; long imports, text editing, membership and privacy use large. Information lists may use fitted/medium plus large. Replace fixed-only pin height and medium-only editable forms with an expandable fallback. |
| iPad / larger windows | Content-sized native popovers for reader controls. Centered native form sheets for settings/editing. Preserve membership's larger comparison width. No giant bottom drawers copied from phone. |
| Edits on dismissal | Immediate sheets preserve changes. Draft editors must not silently lose changed work on swipe, Cancel or keyboard dismissal. Dirty cancellation asks whether to discard; intercept swipe while dirty and provide that explicit cancel path. Clean editors close directly. Preserve the draft after failed saves. A child editor returns changes to the parent draft without claiming the remote save is complete. |
| Busy state | Show progress in the affected action and prevent duplicates. If leaving would interrupt a required commit, guard both interactive and explicit dismissal. If work can safely continue, allow close and keep ownership of the task outside the disappearing view. Decide per operation; do not blanket-lock sheets during background recovery. |
| Failure | Keep recoverable work and retry quietly. After recovery is exhausted, put actionable feedback beside Save/Import or in a deliberate failed-load scene. Use alerts/confirmation dialogs for decisions that need interruption. Validation red is reserved for input needing correction; failure copy should not depend on red alone. |
| Accessibility | Scaled type, at least 44 pt action targets, readable wrapping, labeled close icons, selected-state symbols rather than color alone, Reduce Motion/Transparency support and accessible dismissal. No fixed preview or sheet height may hide the only action. |

## Specific button and interaction changes

| Current | Proposed | Reason |
| --- | --- | --- |
| Wallpaper 完成 | Close xmark | Every wallpaper choice has already been saved. |
| Membership 完成 | Close xmark; same busy policy as swipe | Browsing/selection is not a purchase confirmation. The current toolbar can bypass the busy swipe restriction. Keep the distinct 继续阅读 success action. |
| Privacy 完成 | Close xmark | Reading information has no commit step. |
| Annotation queue 完成 | Close xmark | Closing does not complete annotation work. Rename the title to 文章注释 to avoid exposing queue terminology. |
| PDF note problems 完成 | Close xmark | Closing does not resolve outstanding problems. Version choices and retry stay explicit. Make phone sheet adaptation explicit. |
| Folder editor 完成 | 创建 for new folder, 保存 for rename | It performs a real write. |
| Ad blocking 完成 | 应用 when changed, 关闭 when unchanged | Applying can fail and must remain explicit. Keep 应用并重新载入 when relevant and preserve the draft/cancel behavior required by DESIGN.md. When unchanged, avoid showing both Cancel and Close. |
| Article editor 完成 | Retain a commit control, label it 应用; native 返回 discards child edits only after a dirty-discard decision | It must first extract Markdown into the parent draft. Deleting it now would lose changes. Do not label this remote 保存 when the parent still requires Save/Import. |
| Vocabulary preference 完成 on older path | 保存 if the path is retained | It really writes. Stage website-rule deletions with the other changes so Cancel has one consistent meaning. |
| Single-button failure alerts with 完成 | Local retry/error state | Acknowledging failure does not finish the requested action. |
| Routine account success alert | Brief feedback at the affected control | Avatar success should not interrupt with an acknowledgement. |

Additional per-screen adjustments: give wallpaper an explicit paper background and a grabber, keep its preview and side-by-side reset/solid actions, and change its filled photo action to the shared ink treatment. Standardize saved-word and static-definition backgrounds to `annotationSurface`, retaining paper inputs inside them. Keep dynamic glass definitions and framed review exercises as the documented exceptions. Match the review-note/save-error popovers to that quiet contextual palette while keeping their different content widths.

For import failures, move feedback beside the submit action rather than appending an unexplained standalone error section. Preserve uncertain-result safeguards. For account field editing, put validation beside the field. Add a large-height fallback to pin/folder editors, preserve the account editor's existing large detent, and apply the dirty-dismiss policy to all three. The older multi-action ContentImportView should only be aligned if it remains a supported entrypoint; do not expand its role during this work.

## Approval scope and later verification

The recommended approval covers the shared visual rules, the button changes above, local feedback, draft dismissal protection and the named per-screen refinements. It preserves the existing distinction between immediate wallpaper/reader preferences and explicit saves/imports. It includes the current membership work only if that work remains in the branch.

After approval, implementation should start with the shared presentation styles, then the main workspace/account sheets, then reading/contextual dialogs. Update DESIGN.md to record the agreed rules. Keep feature-specific state and commit behavior in the owning views; a shared sheet style must not hide persistence behavior. Do not remove older navigation flows as an incidental cleanup.

No runtime verification is claimed by this audit. After implementation, compile/static verification and focused checks of actual save/dismiss semantics will be needed. Simulation remains outside this request unless separately requested. The current app launch state was not changed.

Human decision requested: approve this proposal, including replacing dismissal-only 完成 buttons with a native close xmark, preserving explicit commits for draft editors, and keeping the reader/review exceptions described above.
