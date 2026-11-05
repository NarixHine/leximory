# Built-in browser ad blocking on iOS

Assessed on 2026-10-17 against the current browser code, installed Apple SDK headers, and the linked public sources. This is the feasibility assessment requested before implementation. No app behavior, database, or Supabase data was changed.

The subsequent [low-risk implementation plan](browser-ad-blocking-plan.md) narrows the scope in response to the requirement for automatic operation and minimal website interference. It supersedes the global toggle, user-managed site exceptions, cosmetic filtering, and broader blocking scope proposed below.

## Decision

Proceed with general ad and tracker blocking inside Leximory's webpage browser using public WebKit content rules. Treat reliable YouTube video-ad removal as a separate product commitment with continuing maintenance and service-policy risk. Do not describe a basic request blocker as an ad-free YouTube feature.

| Scope | Technical feasibility | Distribution assessment | Recommendation |
| --- | --- | --- | --- |
| Common webpage ads and third-party trackers | Good fit for compiled WebKit rules | Public APIs and existing App Store precedent | Implement first |
| Cosmetic removal of known ad containers | Supported, but selectors need maintenance | Same general browser-blocking approach | Include narrowly scoped selectors when verified |
| YouTube video ads | Possible in some configurations; reliable coverage needs more than a domain list | YouTube expressly objects; Apple review outcome is uncertain | Investigate separately before promising support |
| Ads inside the native YouTube app | Outside Leximory's web view | No need to enter system-wide filtering for this task | Out of scope |

Existing browsers matter here. [Brave's current App Store listing](https://apps.apple.com/us/app/brave-browser-search-engine/id1052879175) advertises built-in blocking, including ads before and during videos. This supports feasibility on the platform. It does not verify Brave's current YouTube success rate or guarantee approval of Leximory's implementation.

## What fits the existing app

`apps/leximory-ios/App/Browser/TextBrowserModel.swift` creates a `BrowserWebView`, a `WKWebView` subclass, with a persistent website data store. It currently installs no ad-blocking rules or always-running page scripts. Its isolated JavaScript is invoked for text selection and article extraction. Native ebooks and the article editor have separate web-view configurations.

The appropriate integration is `WKContentRuleListStore` and `WKUserContentController.add(_:)`. Apple's [WKWebView session](https://developer.apple.com/videos/play/wwdc2022/10049/) demonstrates compiling rules and applying them to a web-view configuration, including frame-specific rules. The installed SDK declares the rule-store and controller APIs available since iOS 11, comfortably below this project's iOS 26 target. No Safari extension, default-browser status, VPN, or alternative browser engine is needed for this design.

[WebKit content rules](https://webkit.org/blog/3476/content-blockers-first-look/) evaluate resource URLs and request context. They can block matching requests and hide matching elements using CSS. They do not provide arbitrary response-body rewriting or a general ad-removal engine for video streams. Filter-list text from desktop extensions also needs conversion to WebKit's supported format; unsupported rules cannot silently count as supported coverage.

Safari extensions are a different integration. Leximory must install its own rules in its own content controller rather than assume a user's Safari blocker protects this `WKWebView`.

Keep blocking local to the webpage browser. Do not attach it globally to ebook, article-editor, authentication, or other app-owned web views. Preserve cookies, login, verification frames, selection lookup, imports, and the Safari-compatible user agent.

## Why YouTube is harder

Request blocking works when an ad request can be distinguished from a content request. Blocking all of `youtube.com`, `googlevideo.com`, or shared Google script hosts would break useful playback or other pages. Hiding an ad container alone does not prevent an in-stream ad or remove its playback delay.

AdGuard reports observing [server-side ad insertion on YouTube](https://adguard.com/en/blog/youtube-server-side-ad-insertion.html), where advertisements become part of video delivery. This is evidence of an additional blocking difficulty, not proof that every video, account, or region currently receives the same delivery scheme. A domain-only or DNS-only solution cannot reliably distinguish ads from content delivered through the same endpoint.

A fuller implementation may need maintained, site-specific scriptlets that alter page-side player data or APIs before the player uses them. Such scripts can run through public WebKit APIs, but they depend on YouTube internals and need repeated compatibility testing. A third-party blocker advertising this capability is not evidence that a short script copied into Leximory will work reliably.

AdGuard's [iOS instructions](https://adguard.com/kb/adguard-for-ios/solving-problems/block-youtube-ads/) distinguish Safari's advanced extension protection from sharing a video out of the native YouTube app into AdGuard's player. Those are separate experiences, not a drop-in capability for Leximory's browser.

There is no supported universal interception solution hiding behind `WKURLSchemeHandler`. The installed `WKWebViewConfiguration` header rejects handlers for schemes WebKit already handles, which includes HTTP and HTTPS. Replacing video delivery with scraping, a proxy, or an unofficial player creates a different architecture and additional policy exposure.

The achievable initial claim is reduced ads on supported webpages. Consistent removal of YouTube pre-roll, mid-roll, Shorts ads, or server-inserted ads remains unverified.

## App Store and service rules

Apple's [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) support the following assessment:

- **2.5.1 and 2.5.6.** Use public APIs and the appropriate WebKit framework. The proposed native content-rule design fits these requirements.
- **5.2.2.** Access to third-party services must comply with their terms, and Apple may request authorization. This is the main concern for YouTube-specific functionality.
- **2.3.1 and 2.5.19.** Disclose the feature accurately to users and reviewers. Do not hide site-specific behavior or activate it secretly after review.
- **2.5.2.** Downloaded executable functionality raises review concerns. Prefer bundled, reviewed scripts; treat declarative filter updates separately from remotely supplied code.
- **5.2.3.** Do not add unauthorized video downloading or conversion as part of this feature.

This is a risk assessment, not advance approval from Apple. General browser blocking has precedent. YouTube-specific circumvention has greater uncertainty.

[YouTube Help](https://support.google.com/youtube/answer/14129599?hl=en) explicitly states that blocking its ads violates its terms and may cause video playback to be blocked. Its [terms](https://www.youtube.com/static?template=terms) prohibit interference with the service. This is a service-policy conflict; it does not, by itself, establish that every browser ad blocker is unlawful.

If Leximory later integrates a YouTube API or an API-controlled embedded player, the [YouTube developer policy guide](https://developers.google.com/youtube/terms/developer-policies-guide?hl=en) explicitly prohibits restricting ads that would otherwise play. Do not treat an API integration as a compliant workaround. That API-specific rule should not be presented as proof that merely browsing youtube.com makes Leximory an API client.

Before importing third-party filter lists, converters, or scriptlets, review their exact licenses and required notices. An open-source blocker is not automatically suitable for copying into a proprietary app. Distribution regions and any legal clearance for a YouTube-focused feature remain separate release decisions.

## Proposed first implementation

1. Add a browser-only rule manager and versioned bundled WebKit JSON rules. Use a licensed maintained source or explicitly owned rules; a handful of ad domains should be described as limited coverage.
2. Compile once and reuse a versioned rule list. Install the selected rules before the first page request, including restored pages. Use the existing compiled list while preparing an update; replace it only after successful compilation.
3. Apply rules through the browser's content controller so links, subresources, frames, redirects, reloads, and WebKit history navigation receive the same filtering. A check in the top-level navigation delegate alone is insufficient.
4. Add a remembered global 广告拦截 option and a remembered per-site exception in the existing More menu and standalone webpage options. Let users disable blocking for a broken site and reload deliberately. Scope site exceptions to the top-level host, covering that page's frames without disabling unrelated sites. Treat subdomain inheritance as an explicit rule, not a loose string-suffix match.
5. Preserve those choices when `BrowserWorkspaceModel.clearHistory()` recreates `TextBrowserModel`. Keep account data and existing import-destination rules independent. Per-site exception records are browsing-related data and should be removed by 清除浏览数据; the global preference can remain.
6. Keep transient rule-update failures silent and retain the last working rules. If enabling protection ultimately fails with no usable rules, report that beside the affected control and keep browsing available. Do not silently show protection as enabled when no rules are installed.
7. Keep the first implementation declarative. Do not ship a claim of reliable YouTube video-ad removal, replacement players, anti-detection spoofing, or remote executable script updates as part of it.

Specific integration points are `TextBrowserModel` initialization and navigation, `BrowserWorkspaceModel.clearHistory()`, `BrowserWorkspaceView.more`, and `TextBrowserScreen.controls`. The project uses XcodeGen, with application sources under `App`; new Swift and bundled resource files must be included in the regenerated project.

Suggested review-note wording, after implementation and verification: "Leximory optionally blocks matching advertising and tracking resources in its built-in webpage browser using public WebKit content rules. Users can disable blocking globally or for a website. The feature does not modify other apps or guarantee removal of video advertisements."

## Verification required before shipping

- Run actual `WKWebView` tests against controlled HTTP fixtures. Assert that an ad script or image never reaches the fixture server, ordinary content still loads, and disabling the blocker restores the request. DOM disappearance alone does not prove network blocking.
- Verify first navigation, redirects, frames, back/forward, restored pages, reloads, and immediate navigation during initial compilation. Test toggling protection while compilation is pending so a late result cannot override the latest choice.
- Check exact-host and subdomain exceptions, exception persistence, malicious lookalike hosts, and browsing-data clearing. A disabled site must stay disabled after browser recreation.
- Exercise cached rules, invalid JSON, failed compilation, update replacement, and failed first enable. A failed update must preserve the previous working rules.
- Re-run selection, article import, PDF opening, sign-in, cookies, and verification-frame checks. Existing `TextBrowserTests` cover several of these behaviors and should remain valid.
- Test phone and iPad layouts, VoiceOver labels, Dynamic Type, and Mac Catalyst. No server/schema work or account mutations are needed for the browser-blocking implementation.
- For any later YouTube commitment, test mobile and desktop sites, signed-in and signed-out sessions, watch pages, Shorts, seeking, playlists, full screen, and observed ad variants across accounts and regions. Record dates and failures. A few successful videos do not establish reliable support.

## Evidence and limits of this assessment

Verified the existing WebKit configuration, navigation paths, browser recreation, menu locations, deployment target, and public SDK declarations. Checked current Apple, YouTube, WebKit, and blocker-vendor sources linked above.

No blocker was implemented and no live YouTube effectiveness claim was tested. Simulator inventory through the sandboxed CLI was unavailable because CoreSimulator service access failed; this does not affect the source and policy assessment. No app or fixture was launched, and no device or account state was changed.
