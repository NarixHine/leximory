# Browser ad-blocking implementation plan

Status: implemented on 2026-10-17; remaining verification assigned to the human at their request. See [handoff and checks](browser-ad-blocking-verification.md).

This replaces the earlier banner-image-only proposal and its hosted eligibility policy. It follows the requested configuring UI and the [feasibility assessment](browser-ad-blocking-feasibility.md). Execute the tasks below in order after implementation is authorized. Every task has an observable completion check.

## Fixed product decisions

- Add general ad and tracker blocking to the built-in webpage browser, enabled by default after rules prepare successfully.
- Add one 广告拦截 entry to the existing menus. Configuration lives in one shared native sheet. Add no toolbar controls, badges, counters, protection scores, filter subscriptions, or Basic/Strict modes.
- Store the global preference and website exceptions locally on this installation, like the existing search-engine preference. Do not synchronize them through accounts or the backend.
- Apply changes only after confirmation. Reload the current webpage only when the user explicitly chooses 应用并重新载入. Never automatically replay a form submission.
- Bundle native WebKit JSON rules. Update them with app releases. Add no hosted policy endpoint, timer-based rule expiry, remote executable scripts, or runtime filter downloads in this release.
- Use ordinary declarative filtering on YouTube. Add no YouTube-specific player scripts or ad-free claims. The native YouTube app is outside this feature.
- Keep ebooks, the article editor, authentication web views, saved content, and backend behavior outside this change.

## Settings specification

Place 广告拦截, using the SF Symbol `hand.raised`, beside 搜索引擎 in `BrowserWorkspaceView.more`. It remains available from Home and saved resources. Add the same entry to `TextBrowserScreen`'s webpage options. Both open `BrowserAdBlockingSettings` with the same preference store and a captured optional current-page context.

| Element | Exact behavior |
| --- | --- |
| Sheet title | 广告拦截 |
| First row | 拦截广告, a native switch |
| First footer | 减少网页中的广告与跟踪。 |
| Current-site section | Present only for an HTTP or HTTPS webpage. Header shows its full normalized hostname. The switch reads 在此网站拦截. |
| Global switch off | Keep the current-site switch visible but disabled. Preserve its remembered choice. |
| 网站例外 | Navigation row shown only when saved or draft exceptions exist. The destination lists hostnames alphabetically with a 恢复拦截 action for each. No add-host form or empty-state page. |
| Cancel | 取消 discards all draft edits, including exception removals. Swiping the sheet away does the same. |
| Confirm, unchanged | 完成 closes without compiling, saving, or reloading. |
| Confirm, changed without an affected current webpage | 完成 applies the draft and closes after success. |
| Confirm, changed with an affected current webpage | 应用并重新载入 applies the draft and explicitly reloads that page. Footer reads 更改后将重新载入当前网页，请先保存网页中填写的内容。 |
| Existing POST/form-result page | Confirm with 完成, apply the policy for future navigation, and do not reload. Footer reads 更改将在下次打开网页时生效。 |
| Preparation while confirming | Disable duplicate confirmation and editing; show activity within the confirmation control. Preserve the draft. |
| Unrecoverable apply failure | Keep the sheet and draft open. Show 广告拦截设置未能应用，请重试。 beside confirmation, with 重试. Cancel stays available. |

Use the existing Chinese interface font, native grouped form, primary and secondary label colors, and native switch tint. Use content-sized presentation where space permits and a scrollable full-height sheet for accessibility text sizes. Let native navigation, switches, and dismissal supply motion. Do not add decorative animation.

Capture the document identity when opening settings. If navigation changes while the sheet is open, discard its current-page reload target and use 完成. Recompute whether the draft changes that document's effective blocking, so editing an unrelated exception never reloads it. Track whether the current document came from a form request; if the request method cannot be established, do not reload automatically. Restoring an exception uses the same confirmation flow.

Website exceptions match the exact normalized hostname across HTTP/HTTPS and ports. `example.com`, `www.example.com`, and `m.example.com` remain separate, and the sheet shows which one is affected. Lowercase and normalize internationalized hostnames, remove a terminal DNS dot, and test lookalikes and IPv6. Never infer a registrable domain by taking the final two labels.

## Task 1: Produce a reproducible bundled filter artifact

Files to add under `apps/leximory-ios`:

- `scripts/prepare-browser-ad-rules.py`, a maintainer command with explicit refresh and offline `--check` modes.
- `App/Resources/Browser/AdBlocking/rules-*.json`, the generated WebKit lists.
- `App/Resources/Browser/AdBlocking/manifest.json`, with source URLs, source-content hashes, converter tag and exact commit, target Safari version, generated-file hashes, and conversion exclusions.
- `App/Resources/Browser/AdBlocking/ATTRIBUTION.txt`, with the required credits, license text or bundled license files, and source locations.

Use EasyList and EasyPrivacy as the initial source candidates. Pin source snapshots by hash instead of fetching mutable URLs during ordinary builds. Use AdGuard's `SafariConverterLib` command-line converter as an offline maintainer tool, initially evaluating tag `v4.3.0`; resolve and record its exact commit before generating assets. Do not link the converter or its advanced extension engine into Leximory. The converter distinguishes native JSON from advanced rules, so consume only its native output. Preserve source exception rules and converter rule ordering. [Converter documentation](https://github.com/AdguardTeam/SafariConverterLib), [candidate release](https://github.com/AdguardTeam/SafariConverterLib/releases/tag/v4.3.0).

Review the converter's GPL terms and the source lists' CC BY-SA redistribution requirements before committing artifacts. Include obligations for derived JSON and App Store distribution in that review. The [EasyList license page](https://easylist.to/pages/licence.html) supplies the source attribution and license choices. Do not assume the converter's license determines the generated data's license, or that using a build tool automatically licenses the app under its terms.

Target Safari 26, matching the app's minimum runtime. Retain only output supported by native WebKit. Record excluded scriptlets, extended CSS, HTML filtering, response rewriting, and unsupported rules in the developer manifest. Keep this report out of the configuring UI. Do not add a hand-written desktop filter parser or silently replace the sources with a small guessed domain list.

Keep generated groups within the converter and WebKit limits without discarding ordering-dependent exceptions. Preserve normal top-level navigation and media playback; verify these in the native tests rather than assuming conversion proves compatibility.

**Done when:** offline `--check` reproduces the recorded hashes, all bundled groups compile on the minimum runtime, provenance and license obligations are recorded, and controlled blocked/allowed requests behave correctly. If licensing or native conversion fails, stop this task with the concrete failure. Do not mark an empty artifact as working protection.

## Task 2: Add the preference model and rule compiler

Add `App/Browser/BrowserAdBlocker.swift` and `Tests/BrowserAdBlockerTests.swift`.

Use an app-local `@MainActor` manager with an injectable `UserDefaults` store and rule-store adapter. Keep the saved value small: a schema version, `enabled`, and a set of excluded normalized hosts. Use the key `browser.adBlocking.preferences.v1`. An absent value requests the default enabled policy; a corrupt value uses that same policy with no exceptions. Persist only confirmed settings.

The manager owns loading the manifest, validating hashes, preparing compiled lists, and producing a prepared policy. Key compiled variants by the bundled content hash and canonical exception set. Coalesce identical in-flight preparation. Ignore completion of superseded requests; a late enable must not override a newer disable, Cancel, or browser-data clear.

Add exact top-URL exception rules to every owned list while preserving source-rule ordering. Test that these disable both request blocking and cosmetic rules on the excluded top-level host, including its child frames. Exceptions must not exempt the same advertising request when another top-level website embeds it. Do not use unrestricted suffix matching or a navigation-delegate host check as a substitute.

Install a replacement only after every required list compiles. On failure retain the previous usable prepared policy and committed preference. One silent retry is sufficient for a local preparation failure; only an unresolved user-requested apply gets the sheet's retry state. Removing protection removes only this feature's owned lists, preserving unrelated controller rules.

**Done when:** tests prove canonical host matching, default values, confirmed persistence, Cancel, atomic replacement, duplicate-request coalescing, superseded completion, failed preparation, and preservation of unrelated rules. No failed apply changes the committed preference or leaves a partially installed policy.

## Task 3: Integrate with webpage navigation and browser lifecycle

Modify `App/Browser/TextBrowserModel.swift` and `App/Browser/BrowserWorkspaceModel.swift`.

Inject the manager into `TextBrowserModel`, defaulting to the shared installation manager. Make browser construction and `clearHistory()` use that same manager. Keep `BrowserWebView`, its cookies, website data store, user agent, selection handlers, PDF handling, and workspace history intact.

Prepare the bundled policy before allowing the first external top-level load when protection is enabled. Use the existing asynchronous navigation-policy path so direct `web.load`, restored URLs, in-page links, and popup-to-current-view navigation cannot bypass preparation. Subframes use installed WebKit rules and must not start their own preparation loop. Prewarm local compilation without fetching a network resource.

At each new top-level navigation, install the latest confirmed prepared policy before allowing the request. Native rules must evaluate top-level exceptions across redirects. Preserve the existing workspace back/forward interception. Existing back/forward-cache content may retain the appearance it had when loaded; do not force a reload or discard browser history to change it. Reloaded documents use current settings.

Settings confirmation captures the old committed policy, prepares the draft, checks that the action is still current, installs the complete result, and then commits preferences. Reload only the captured, still-current, reload-safe document when the user chose that action. Other open browser instances adopt the committed policy at their next document navigation; do not mutate their pages halfway through a visit.

If initial preparation ultimately fails, allow ordinary browsing and retain the desired preference for a later retry. Settings must explain that blocking is unavailable rather than claim active protection. Never add a blocker error to normal webpage content.

In `clearBrowsingData`, clear exception records before broadcasting browser recreation. Preserve the global preference, saved resources, account data, and compiled base assets. Invalidate pending work so it cannot restore cleared exceptions. Existing website import-destination preferences stay separate.

**Done when:** first load is filtered; links, redirects, frames, reload, native/workspace history, popup navigation, restored sessions, and browser recreation follow the confirmed policy. Disabling and clearing exceptions remain effective after a late compilation completes. Browsing still works after preparation failure.

## Task 4: Implement the shared settings sheet and menu entries

Add `App/Browser/BrowserAdBlockingSettings.swift` and `UITests/BrowserAdBlockingUITests.swift`. Modify `App/Browser/BrowserWorkspaceView.swift` and `App/Browser/TextBrowserScreen.swift` only to add presentation state and the menu entry.

Implement the settings specification above using a draft copied from committed preferences. Keep exception-list edits in that same draft. The sheet calls the manager's apply operation; views do not parse rules, manage WebKit controllers, or write `UserDefaults` directly.

Use stable accessibility identifiers: `browser-ad-blocking`, `ad-blocking-enabled`, `ad-blocking-site`, `ad-blocking-exceptions`, `ad-blocking-cancel`, and `ad-blocking-confirm`. Give exception restore actions the corresponding hostname in their accessible label.

**Done when:** both entry points show the same sheet and remembered preferences; Home omits the current-site section; no-exception accounts see no exception-management row; cancelled edits make no changes; confirmation reloads only the intended safe document. Verify light/dark appearance, narrow landscape, largest accessibility text, VoiceOver order, and reachable confirmation controls on phone and iPad.

## Task 5: Prove request blocking and compatibility

Add `Tests/Support/BrowserHTTPFixture.swift`, a loopback HTTP server using ephemeral ports, and extend `BrowserAdBlockerTests`. Use independent test preference suites. Exercise actual `WKWebView` requests; hiding an element alone does not prove that its request was blocked.

| Scenario | Required assertion |
| --- | --- |
| First load with protection | Targeted ad resource never reaches the server; ordinary resource and article content do |
| Global off | Both resources reach the server |
| Exact-host exception | Both resources and child-frame resources load on the excluded top-level host |
| Different or lookalike host | The same ad resource remains blocked outside the exception |
| Cosmetic exception | Hidden ad fixture becomes visible after explicitly applying the exception and reloading |
| Redirect into/out of an exception | Final top-level host determines filtering without a transient wrong exception |
| Navigation while preparation is pending | Latest intended URL wins; an old completion cannot start or replay a superseded navigation |
| Cancel or clear during preparation | No old draft or cleared exception is committed or installed |
| Preparation failure | Previous policy remains usable, or first-load browsing proceeds without a blocker-specific page error |
| POST/form-result settings change | No second submission, forced refresh, erased draft, or navigation-history change |
| Independent web views | Ebook, editor, and authentication configurations have no blocker rules |

Re-run existing `TextBrowserTests` and relevant `BrowserWorkspaceTests`, particularly verification frames, cookies, selection context, PDF handling, browsing-data clearing, and workspace history. Add regression assertions only where this change affects the behavior.

Perform dated manual smoke checks on YouTube watch pages and Shorts, signed-in and signed-out playback, seeking, full screen, and playlists. Also check representative reading pages, sign-in, consent, and an advertising-gated page. Record what ads remain and any playback failures. These checks establish observed compatibility, not guaranteed YouTube ad removal or zero breakage.

**Done when:** deterministic request tests and existing browser regressions pass on iOS 26 and the current runtime. Complete phone/iPad UI checks and a Mac Catalyst build. Leave test simulators in normal account mode, remove fixture arguments, and preserve real account data. Physical-device installation remains outside this work unless authorized.

## Task 6: Package and document the release

Regenerate the project using `bash apps/leximory-ios/scripts/generate-project.sh`. Build and test the `Leximory` scheme with XcodeBuildMCP, selecting an available simulator after inspecting session defaults. Run the focused `LeximoryTests/BrowserAdBlockerTests`, `LeximoryTests/TextBrowserTests`, relevant workspace tests, and `LeximoryUITests/BrowserAdBlockingUITests`. Capture the exact destination, runtime, command/tool arguments, and result in `docs/native-ios/browser-ad-blocking-verification.md`.

Update `apps/leximory-ios/DESIGN.md` and `README.md` with the final menu location, local preferences, exception clearing, explicit reload behavior, and limits. Keep the feasibility assessment as the policy record. Include the filter artifact refresh/check procedure and attribution locations for maintainers.

Review notes should describe optional browser-local ad/tracker filtering, public WebKit rules, user-controlled exceptions, and the lack of a guaranteed video-ad-removal feature. Do not promise App Store approval. Do not submit, deploy, or publish as part of implementation unless separately requested.

**Done when:** the generated project contains all source and resource files, the app builds, required tests have recorded results, the UI matches its specification, and the working diff contains no unrelated changes or database/schema work.

## Execution boundaries

The first executable task is producing and compiling the reproducible filter artifact. Complete that check before wiring navigation or building the settings UI. Task 2 follows Task 1; Task 3 follows Task 2; Task 4 follows Task 3; Task 5 verifies the complete behavior; Task 6 finishes the reviewable change.

The implementation is authorized. App Store submission, deployment, and physical-device installation remain separate actions.
