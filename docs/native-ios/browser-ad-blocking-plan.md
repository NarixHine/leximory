# Conservative browser ad-blocking implementation plan

Plan date: 2026-10-17. This document implements the direction from the [feasibility assessment](browser-ad-blocking-feasibility.md). It plans the work; application behavior remains unchanged.

## Product decision

Make website operation the priority. Automatically block only reviewed third-party banner-image requests on explicitly approved pages. Load everything normally whenever the browser lacks current evidence that a rule is suitable. Require no setup, filter management, website exceptions, or recovery actions from users.

This reduces risk; it cannot eliminate it. A website can change its behavior or react to any blocked request. WebKit cannot prove that a page's forms, controls, and business logic still work. If zero additional interference is an absolute acceptance criterion, ship ordinary browsing without active ad blocking. Do not represent automatic fallback as a guarantee of zero breakage.

The first release deliberately offers limited banner-ad reduction. It does not promise general tracker protection, removal of every advertisement, or an ad-free YouTube experience.

## Fixed scope

| Area | First-release behavior |
| --- | --- |
| Eligible content | Precisely matched third-party image URLs on reviewed top-level website hosts and page paths |
| Unreviewed websites or paths | Ordinary browsing, with no blocking |
| Subframes and embedded players | No blocking of their resources |
| Scripts, styles, fonts, API requests, media, navigation | Unchanged |
| Cookies, authentication, consent, CAPTCHA, payments | No changes to these mechanisms; their pages are outside the approved set |
| Layout and page content | No cosmetic selectors, element removal, or layout rewriting; empty ad space may remain |
| YouTube | No YouTube rules or player manipulation; its pages and embedded-player frames remain unfiltered |
| User experience | Automatic; no counters, settings, exception lists, warnings, or prompts for this optional feature |

YouTube is excluded because it expressly objects to ad blocking and may restrict playback. [YouTube Help](https://support.google.com/youtube/answer/14129599?hl=en). Public WebKit APIs reduce implementation risk but do not guarantee App Store approval; third-party terms still matter under Apple's review rules. [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/#intellectual-property).

## Phase 1: Establish an eligible rule set

Deliver a small, owned and reviewed rule manifest before enabling any filtering. Do not import EasyList, a generic tracking list, or another browser's scripts for this first release.

Each candidate records a stable ID, content version, exact website and page patterns, advertising-image URL pattern, initial review date, maximum review age, and evidence of the ad-only purpose. The evidence includes reproducible page visits, the matched requests, and comparison of the relevant user journeys with filtering on and off. Do not put private browsing histories or signed URLs into the manifest.

Admit a candidate only when all of these conditions hold:

- The top-level host and path belong to a reviewed page family, such as a particular publication's article pages. Unknown paths, home pages, sign-in, checkout, and account pages remain outside it.
- The target is a dedicated advertising-image endpoint. A shared image CDN, a broad Google domain, or a generic `/ads/` substring is insufficient evidence.
- The native rule restricts the resource type to `image`, the relationship to `third-party`, and the loading context to the top frame. Confirm these restrictions compile and behave correctly on the minimum supported iOS runtime. If the required context restriction is unavailable, omit the rule rather than broaden it.
- Tests prove complete host and path boundaries. Lookalike hosts, query-string occurrences, unexpected ports, and unreviewed subdomains do not qualify.
- The reviewed page continues to work after the image fails, including its ad-block detection behavior. Sites that demand advertising or disable content are ineligible; do not defeat their checks.

Set the initial maximum review age to seven days. This is a conservative starting policy, not a guarantee that a website cannot change sooner. Record subsequent reviews in the bounded policy described in Phase 3, so operators can renew evidence for the same bundled rule without making users install weekly builds. Re-review or let the rule expire automatically. Rules stay ineligible until evidence exists; do not fill the shipping manifest with guessed domains.

Exit condition: at least one useful rule passes review and the controlled tests below. If none qualifies, retain normal browsing and do not advertise a functioning blocker.

## Phase 2: Build the browser-only WebKit integration

Deliver these application-local files, following the existing XcodeGen source structure:

| File | Responsibility |
| --- | --- |
| `App/Browser/BrowserAdBlocker.swift` | Validate bundled rules and policy, compile and cache WebKit lists, publish immutable usable snapshots |
| `App/Browser/BrowserAdRules.json` | Reviewed, versioned candidates and their evidence metadata |
| `App/Browser/TextBrowserModel.swift` | Attach an eligible prepared snapshot to the webpage browser at a document boundary |
| `Tests/BrowserAdBlockerTests.swift` | Rule boundaries, policy expiry, compilation, and real WebKit network behavior |

Keep the public interface small: asynchronous preparation and an optional prepared rule list for the next document. The manager owns compilation and eligibility; views and navigation callers do not parse rules. Use dependency injection for time, policy fetching, and the rule store in tests. A generic rule-engine framework or shared Core package is unnecessary.

Generate WebKit JSON from the restricted manifest. Permit only the `block` action with the image, third-party, top-frame, and approved-page restrictions. Reject arbitrary actions, unrestricted patterns, missing metadata, and unknown schema versions. Compile through `WKContentRuleListStore`; attach through the webpage browser's own content controller. Apple's [rule format](https://developer.apple.com/documentation/safariservices/creating-a-content-blocker) provides resource, top-URL, frame, and loading-context restrictions; Apple's [WKWebView example](https://developer.apple.com/videos/play/wwdc2022/10049/) demonstrates native rule compilation and installation.

Prewarm preparation without delaying a page. Key the compiled cache by the actual rule-content hash. A compiled cache entry is usable only while the underlying rule evidence and disable policy are still valid. A cached list alone is not authorization to keep filtering indefinitely.

Choose the snapshot once, before the web view's first external document load. If preparation is incomplete, let that browser instance remain unfiltered without awaiting network access or compilation. For a filtered instance, eligibility may only shrink during its lifetime. A revocation or expiry removes its owned list and leaves that instance unfiltered. Never add replacement or expanded rules to an existing browsing session. A later browser instance can use a fresh snapshot without recreating the current browser just for filtering.

This trades some coverage on cold startup for a simpler lifetime guarantee. Rules cannot appear halfway through a visit, and history restoration cannot acquire new filtering behavior. Native URL and context restrictions handle redirects and subsequent documents. Test native back/forward cache behavior rather than assuming the navigation delegate controls every restored page.

Keep the existing `WKWebView`, cookies, data store, user agent, and native history. Recreating the web view to enable filtering is not acceptable. `BrowserWorkspaceModel.clearHistory()` must create its replacement browser through the same preparation path. Ebook and editor controllers receive no ad rules. Remove only the lists owned by this feature, preserving any unrelated WebKit rules.

Exit condition: first load, browser recreation, history, and cold-cache browsing work without a filtering-related delay or user action.

## Phase 3: Keep eligibility current and disabling automatic

Deliver a small public, HTTPS policy document on Leximory's existing hosting. Its location and deployment are part of implementation, not an assumed existing endpoint. No database, Supabase, account credentials, or per-website request telemetry are required.

The document contains a schema version, publication and expiry times, an increasing revision, a global-disable flag, revoked bundled-rule versions, and the last successful review date for each exact bundled-rule hash. It may renew review evidence for an unchanged rule. It cannot introduce hosts, patterns, scripts, or blocking capabilities. Unknown rule IDs or mismatched hashes cannot become eligible. Persist a revocation for that rule version so a later policy response cannot reactivate it. Only an app release with a newly reviewed version can replace a revoked rule.

Treat review renewal as an operator responsibility with recorded evidence. Automate reproducible smoke checks and flag changed journeys for review; passing a shallow page-load check alone cannot renew the review date. If nobody maintains this evidence, the feature expires into normal browsing instead of asking the user to fix anything. New scope requires bundled assets and an app release.

Require a successfully validated policy no older than 24 hours and a rule review no older than seven days before a rule is eligible. Use a stricter server expiry if supplied. A fresh install with no policy loads normally while preparation runs. Offline devices may use a valid cached policy; after expiry they browse normally. Reject rollback revisions, malformed documents, invalid clocks, future review dates, and unsupported schemas. Do not send account identifiers, page URLs, or cookies in this fetch.

Refresh policy on foreground entry and while the app remains active, at most once per 15 minutes after a successful check. Back off failed requests while honoring the fixed expiry. A global disable or revocation stops further use of the affected lists. Expiry must also remove them from active controllers without reloading the document, with a foreground check before an inactive browser resumes. An unfinished compilation must not reinstall revoked or expired rules.

| Situation | Automatic behavior |
| --- | --- |
| Missing, corrupt, expired, or uncompiled rules | Continue ordinary browsing |
| Policy update temporarily unavailable | Use only the still-valid eligible snapshot; fall back to ordinary browsing on expiry |
| Candidate compilation fails | Retain a previous snapshot only if it remains eligible; otherwise use no rules |
| Rule or feature is revoked | Stop filtering with it; never refresh or replay the website automatically |
| Website load fails | Preserve the browser's normal failure handling; do not guess that blocking caused it |

Disabling prevents future matching cancellations. It cannot undo an image request already blocked or guarantee recovery of a page that has already reacted. Policy changes reach devices when refreshes succeed; a connected active device normally checks within 15 minutes, while the cached policy expires within 24 hours. These are mitigation limits, not instantaneous repair promises.

Do not build heuristics around missing elements, HTTP errors, or page-load timing to detect all breakage. Do not retry forms, replay navigation, erase cookies, or reload a page as a filtering fallback. No blocker-specific error UI is necessary because this optional feature always yields to ordinary browsing.

Exit condition: every preparation, freshness, and revocation failure returns to ordinary browsing without a prompt, forced reload, or lost input.

## Phase 4: Verify behavior and release

Add controlled HTTP fixtures that record requests, and exercise actual `WKWebView` loads. Keep these tests independent of live accounts and mutable production websites.

Required checks:

1. A reviewed top-level fixture's targeted ad image never reaches the fixture server. Its normal images and article content do.
2. The identical advertising-image URL loads on an unreviewed site, an unreviewed path, and inside a child frame. This verifies that scope restrictions actually work.
3. Matching-looking script, stylesheet, font, API, document, video, and audio requests all reach the server. An embedded player's resources remain unfiltered.
4. Typing, submitting a form once, links, cookies, CAPTCHA-like frames, selection lookup, import, PDF opening, scrolling, and playback behave as they do without filtering. Runtime disabling preserves entered text and never submits or navigates again.
5. Cold compilation, offline startup, malformed assets, stale policy, rule expiry, revocation, rollback policy responses, and compilation finishing after revocation all take the documented automatic path. Inject time; do not make tests wait hours or days.
6. Redirects into and out of approved paths, popup navigation, back/forward restoration, and browser recreation cannot broaden rule coverage or acquire rules partway through a document visit.
7. Clearing browsing data removes no account content and introduces no new webpage-history records. Ad-rule evidence and policy caches contain no browsing URLs or account secrets.

Regenerate the Xcode project and run the focused native tests plus existing `TextBrowserTests` and relevant `BrowserWorkspaceTests`. Run on iOS 26 and the current iOS runtime, phone and iPad, plus the existing Mac Catalyst target. Leave the app in normal account mode after verification. The hosted policy is a static data asset; no web product behavior changes or JavaScript package installation are needed for the native portion.

Before each rule version ships, replay its real page journeys in addition to deterministic fixtures. Include any known advertising gate, infinite scroll, selection/import, media, and layout-sensitive controls. Record the app build, runtime, website, date, and exact result. A new failure removes the candidate; it does not justify a new bypass.

Start with internal testing, then TestFlight. Keep the policy endpoint available before distributing a build with active candidates. App Review notes should describe limited automatic banner-image filtering, its scope restrictions, and normal browsing on preparation failure. Make no zero-breakage, universal blocking, tracking-protection, or YouTube-ad-removal claims.

## Completion criteria

- Real WebKit tests prove that eligible banner-image requests are blocked and excluded requests still load.
- Approved website journeys have no observed functional regression in the recorded test matrix.
- Unknown websites, expired rules, disabled policies, and uncertain preparation use ordinary browsing.
- Users never have to configure exceptions, refresh filters, or repair a page for the feature's own recovery path.
- A developer can revoke filtering without changing an account or asking users to update settings, subject to the refresh and expiry limits above.
- Residual risk is documented honestly. General website compatibility and App Store approval cannot be guaranteed.

No implementation or live website effectiveness testing has been performed as part of this plan. The next executable unit is Phase 1's evidence manifest and controlled rule-scope tests, followed by the browser integration.
