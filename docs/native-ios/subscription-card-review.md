# Subscription entry review

## Setup and objective

- Review: `2026-10-18-subscription-entry`; project `local-9af2a1acd3918520373baf2fcbd55356`; runtime Codex; Design Arc workflow 0.3.0.
- Evidence: Guidelines only, first-use selection from the user's reply `2`. No benchmark products or benchmark motion were inspected.
- Approval: Fully automatic, first-use selection from the user's reply `3`. No preference file or project home was created. These settings apply to this review.
- Renderer: Codex only, explicitly selected through the renderer question. No Stitch service or assets are involved.
- Graph: default on, but `.codex/` creation is prohibited by this workspace's filesystem policy. The graph validator confirmed the graph is missing. Graph assistance is therefore unavailable; continue the standard workflow using this record without relying on a graph. No escalation or additional approval is needed for this optional aid.
- Explicit objective: make the subscription card visually interesting and clearly actionable on iPhone and iPad, recognizably Leximory, without returning currency UI or a separate management button.
- Evaluation: visible entry action, truthful plan/status, continuity with the existing purchase sheet, readable text, one semantic control, full-width placement above two quota columns, no decorative motion.

## Current journey and inspected evidence

The account subscription card leads into the existing membership sheet for free/App Store accounts. Legacy paid accounts retain their existing management routing. Closing the sheet returns to the account. App Store management uses native system UI. Transaction delivery remains disabled outside fixtures pending backend work.

Inspected current `AccountView.subscriptionCard`, `MembershipView`, `MembershipStore`, `AccountPreview`, the exact membership illustration, and the saved phone/iPad account and purchase captures from the latest passing verification run. Account captures are 1206 × 2622 and 1668 × 2420 pixels. Those captures establish current appearance; they do not prove a new design, animation timing or conversion lift.

Observed: the card visually resembles the quota containers. It makes the current free tier its largest text, offers only a small benefit sentence, and has a chevron without a visible action phrase. It does not show the artwork used immediately after entry. The iPad's larger card width makes the empty space more apparent. Inference: these choices reduce invitation and continuity. No click-through measurement has been collected.

Journey: account loading or cached account → full-width subscription entry → plan selection or existing provider management → loading/unavailable, purchase pending, cancellation, failure/restoration recovery, success → return to account. Existing account editors, quota cards and calendar remain in place.

## First-party constraints

- [Apple Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons): clear action, press state and at least a 44-point hit region. This supports explicit view/manage copy on a single full-card button.
- [Apple In-App Purchase](https://developer.apple.com/design/human-interface-guidelines/apple-in-app-purchase): integrate the store with the app and adapt messaging for existing subscribers. This supports reusing the same illustration and avoiding an upgrade invitation for active subscribers.
- [Apple Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility): scalable type and sufficient light/dark contrast. Reflow rather than truncate; the illustration is decorative and must not supply the action name.
- [Apple Motion](https://developer.apple.com/design/human-interface-guidelines/motion): use motion for a purpose and prefer standard behavior. Retain the native sheet and use non-spatial press feedback. Static imagery cannot prove animation behavior.

Direct documentation HTML initially returned a JavaScript shell and the Markdown fetch was unsupported. Current indexed first-party text was inspected through search, including the relevant button, purchase, accessibility and motion passages. No third-party examples substitute for Apple requirements.

## Direction gate

| Direction                                                     | Journey and visual change                                                                                                                                          | Benefit and tradeoff                                                                                                                                       | Motion and remaining proof                                                                                                                                             |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 Ink and watercolor, recommended and automatically selected | Retain routing; replace the entry label with an ink surface, light editorial headline, current-tier caption, exact cats/book art, and explicit view/manage action. | Strong separation from quota cards, direct continuity with the sheet. Costs additional vertical space; artwork and headline need testing at narrow widths. | Native sheet; opacity-only press feedback. No idle movement. Reduce Motion keeps the same feedback. New layout, contrast and hit behavior require native verification. |
| D2 Pale illustrated invitation                                | Same journey and explicit action, pale sage surface with the same illustration.                                                                                    | Quiet and familiar; closer to the rejected card's low-salience appearance beside pale quota cards.                                                         | Same native sheet and opacity feedback; no custom spatial motion. Dynamic Type and contrast remain unproven.                                                           |
| D3 Full lawn scene                                            | Same journey with the lawn illustration extending across the card and an inset action band.                                                                        | More immersive scenery; more crop and text-background contrast risk on iPhone and iPad.                                                                    | Keep scenery static and sheet native. Reduce Motion unchanged. Crop/legibility need additional runtime proof.                                                          |

Direction selection is Design Arc judgment grounded in the objective and inspected constraints. It is not a measured conversion claim. No new screens, fees, trials or entitlement promises are introduced.

## Selected design contract

- One native SwiftUI Button owns the entire card; the visible action treatment inside its label is not a second nested button. Preserve `account-subscription` as its accessibility identifier.
- Preserve the full-width placement above the two-column quota grid, 20-point account inset and 640-point maximum account measure.
- Current background uses the existing `HomeWallpaperLight` and `HomeWallpaperDark` assets under the user-directed wallpaper amendment below. Use ink labels and an ink action treatment by day, paper labels and a paper action treatment by night. The earlier solid ink/inset background is superseded. Do not add gradients, sparkles, crowns, badges, timers or fake discounts.
- Keep the small label `订阅计划`; present current tier as secondary metadata. Free headline is `畅学语言，畅行天下。`, matching the next sheet. Visible action is `查看会员方案`. Supporting copy can name the real AI annotation/audio benefit without inventing another feature.
- Active paid accounts lead with their actual membership name and status. Their action is `管理当前订阅`, not a new-subscription invitation. Cancellation, grace, billing retry and expiry copy derives from existing account data.
- Reuse the complete book/cats illustration without cropping cats or book edges. The text and action remain readable and spatially separate from the art. On narrow/large-type layouts, reflow or reduce/omit decorative art before truncating labels.
- Original account management, purchase pricing, native payment confirmation, restore, terms/privacy and backend gate are retained. The new backend plan's release gaps remain pending; this card review does not certify App Store release readiness.

## Complete material state inventory

| ID  | State and action                      | Proposal / implementation treatment                                                                                  |
| --- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| E1  | Free account, phone light/dark        | New invitation; real current-tier caption; view plans.                                                               |
| E2  | Free account, iPad portrait/landscape | Same identity and full width; constrain text/art to the account measure.                                             |
| E3  | Paid active                           | Actual paid name and status; manage current subscription.                                                            |
| E4  | Renewal canceled                      | Preserve access-to-expiry message; management action.                                                                |
| E5  | Grace / billing retry                 | Existing payment-action-needed copy; no celebratory new-purchase message.                                            |
| E6  | Expired / revoked                     | Existing ended-access copy and free-tier plan context; view available plans.                                         |
| E7  | Cached offline / action busy          | Keep identity and cached content; retain disabled action and in-control busy feedback. No new infrastructure banner. |
| E8  | Initial loading / account unavailable | Retain existing spinner or retry page. No fabricated membership card without account data.                           |
| P1  | Sheet and plan selection              | Retain existing localized monthly price, selection, allowances and close action.                                     |
| P2  | Product loading / unavailable         | Retain existing wait/unavailable explanation and disabled checkout.                                                  |
| P3  | Approval pending                      | Existing pending copy; no repurchase or tier switching.                                                              |
| P4  | User cancels payment                  | Return silently to the same selected plan and price.                                                                 |
| P5  | Purchase / restore failure            | Existing local error beside affected action and support recovery.                                                    |
| P6  | Confirmed success                     | Existing success screen and return to reading; fixture-only until backend delivery.                                  |
| M1  | Provider management / return          | Existing App Store system sheet or existing legacy routing; no replica Apple payment UI.                             |

Planned implementation viewports: iPhone 402 × 874 and compact landscape; iPad 834 × 1210 and landscape; light/dark, largest accessibility text, Reduce Motion. These are target specifications, not new render proof.

## Production asset set

Selected set: platform. No new raster asset is needed. `membership-reading.png` is the exact existing built-in Imagegen illustration described in [membership-art.md](membership-art.md).

| Asset ID | File / provenance                                                                                                                               | Intended use and variants                                                                                               | Source / render proof                                                           |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| A1       | `apps/leximory-ios/App/Resources/Membership/membership-reading.png`; SHA-256 `033e067a6edfd713a42b8631fd02f3f0642ba13561df85ebc7f95877437f171d` | Same transparent PNG in card and purchase sheet, both appearances. Preserve character identities and entire silhouette. | Existing file inspected; card integration and phone/iPad runtime proof pending. |
| A2       | Bundled Chinese editorial, EB Garamond and Raleway faces from LeximoryTheme                                                                     | Semantic native titles/labels with Dynamic Type; not raster lettering in production.                                    | Existing font APIs inspected; new wrapping proof pending.                       |
| A3       | Native SF Symbols arrow/checkmark as appropriate                                                                                                | Semantic action/state affordance; native text supplies the meaning.                                                     | Native implementation pending.                                                  |

The static proposal board is a design artifact, never an app resource. Image generation must use A1 as the unchanged visual reference; the implementation imports the exact A1 file rather than extracting a regenerated lookalike from the board.

## Motion contracts

| ID                   | Purpose / trigger / start and end                                                                             | Spatial behavior / choreography / timing / easing                                                                                             | Interruption / Reduce Motion / evidence / implementation / proof                                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MC1 Press            | Confirm direct touch; press down/release; normal → subdued → normal label.                                    | No displacement or scaling; no choreography. Instant opacity state change, no animation duration/easing. Values are Design Arc judgment.      | Release/cancel restores normal immediately; same non-spatial alternative under Reduce Motion. Custom SwiftUI ButtonStyle within existing frontend authorization. Specified only; runtime input proof pending. |
| MC2 Membership sheet | Preserve account context on explicit card activation; account → existing membership sheet → account on close. | Native SwiftUI sheet; default platform timing/easing are unverified, not invented.                                                            | Native dismissal/interruption and system Reduce Motion behavior retained. Pattern-level inference from the existing SwiftUI sheet; runtime proof pending.                                                     |
| MC3 State changes    | Explain availability, pending approval and success without idle decoration.                                   | Existing state rendering and native ProgressView; no new custom transition, loop, parallax or delayed action. Exact system timing unverified. | Preserve visible text/control state without spatial animation; respect system accessibility. Existing MembershipView is the implementation source. New screen-state verification pending.                     |

## Proposal and validation record

Renderer choice is resolved to Codex. Initial proposal, conformance matrix, correction count, final visual verdict and native verification results will be added below. The initial proposal permits at most three batched correction rounds; any unresolved renderer-expressible mismatch prevents an automatic pass.

Objective confirmation: explicit objective plus Fully automatic selection, no pause required. Direction gate: D1 automatically selected. Visual Proposal Gate: pending inspected proposal. Existing user authorization covers frontend implementation after a `meets direction` verdict; backend, Supabase execution, device installation and release are not authorized by this review.

### Initial board inspection

Render R0: `exec-b5d7323e-435d-4102-a87c-a1a410ff73e0.png`, Codex built-in Imagegen, 1536 × 1024. Inspected the complete board. Verdict: `meets with corrections`. Correction scope is platform, round 1 of at most 3. The core direction remains unchanged.

| State | Requirement / provenance                                                       | Observed in R0                                        | Classification / next action                                                                     |
| ----- | ------------------------------------------------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| E1    | Editorial free headline, secondary tier, exact-art identity; selected contract | Ink card and action match; tier is too large          | Repairable drift: reduce tier to metadata                                                        |
| E2    | Full-width restrained iPad measure; selected contract                          | Clear larger illustration and action, no added panels | Match; native size/reflow remains runtime proof                                                  |
| E3    | Paid title and management; existing data                                       | Correct paid title and action                         | Match                                                                                            |
| E4    | Canceled subscriber keeps paid tier; existing data                             | Incorrect beginner title                              | Repairable drift: 双语者 with retained-access copy                                               |
| E5    | Grace/retry keep paid tier and management; existing data                       | Beginner title and changed action                     | Repairable drift: actual paid tier, status, 管理当前订阅                                         |
| E6    | Ended status, free-tier context; existing data                                 | Free card but missing ended-status distinction        | Repairable drift: include ended status                                                           |
| E7    | Cached disabled card / in-control busy; existing behavior                      | Disabled action present, busy absent                  | Repairable drift: include busy control state                                                     |
| E8    | Existing account spinner / retry page; existing behavior                       | Fabricated unknown-plan cards                         | Repairable drift: remove cards before account data                                               |
| P1    | Preserve complete sheet; existing screen                                       | Sheet reduced to artwork and plan names               | Repairable drift: include actual full reference and monthly/legal context                        |
| P2    | Loading/unavailable disabled checkout; existing behavior                       | Illustrated as a combined simplified panel            | Repairable drift: distinguish loading and unavailable                                            |
| P3    | Approval without repurchase; existing behavior                                 | Intent visible                                        | Match; exact state text in correction                                                            |
| P4    | Silent cancellation preserves choice; existing behavior                        | Missing                                               | Repairable drift: include return to selection                                                    |
| P5    | Local purchase/restore errors and recovery; existing behavior                  | Generic combined failure                              | Repairable drift: distinguish affected controls                                                  |
| P6    | Existing success and continue; existing behavior                               | Generic changed success text                          | Repairable drift: use actual success text                                                        |
| M1    | System handoff and account return; native platform                             | Handoff tile, no payment replica                      | Match                                                                                            |
| MC1–3 | Static least-motion contract; selected contract                                | No decorative motion shown                            | Runtime proof: press/release, interruption, native presentation, Reduce Motion remain unverified |

The first correction request batches all listed drift. The board remains a preview, not a production asset. Exact A1 integration will be checked separately in the application source and runtime.

### First correction inspection

Render R1: `exec-e9c41798-1dc6-437f-ac60-fdb2e6ec812a.png`, 1536 × 1024. Inspected the complete board. Verdict: `meets with corrections`. Main card hierarchy, paid cancellation/grace/retry tiers, disabled cached action, and card-free account loading/retry now match. The lower journey still omits cancellation, substitutes generic purchase-error controls, shrinks the retained sheet, and incorrectly combines a paid entry label with the free headline. Paid-card titles also need a proper leading hierarchy. This is meaningful improvement over R0, without a direction change or oscillation.

R1 conformance: E1/E2/E4/E5/E8 match; E3/E6/E7/P1/P4/P5 are repairable drift; P2/P3/P6/M1 match at state-intent level. MC1–3 and exact assets, type, contrast, hit behavior remain runtime proof. Round 2 batches the remaining corrections and replaces invented miniature screens with a labeled complete state map beside the actual retained-sheet reference. The new card's focal phone/iPad/dark design is retained. Each state remains represented individually. No implementation has started.

### Second correction inspection

Render R2: `exec-279495b5-199f-4428-ac5b-34f4861c5fe1.png`, 1024 × 1536. Inspected the full portrait board. Verdict: `meets with corrections`. E1/E2/E3/E4/E5/E6a/E7/E8/P1/P2/P3/P4/P5a/P6/M1 now match the selected state intent. Paid titles lead correctly; the retained sheet, cancellation and separate recovery states are present. E6b still incorrectly copies offline state and disables the revoked account's action. P5b substitutes support for the retained restore control. Metadata also introduces dot separators, contrary to native design rules. These are repairable drift. Product-loading punctuation is included in the same correction. Round 3 is the final allowed correction and changes only those items. There has been substantial improvement each round and no direction oscillation.

Static board state tiles describe unchanged behavior and control context; they are not pixel specifications for replacement purchase screens. The full current sheet reference is authoritative for that unchanged UI. MC1–3 remain runtime proof. Text, controls, status and accessibility remain semantic SwiftUI in implementation.

### Final visual proposal and explicit acceptance

Render R3: `exec-43c3f449-520e-4153-acb8-0c87d301c4dd.png`, 1024 × 1536. Inspected the complete board after correction round 3. Final verdict: `meets with corrections`. Revoked status and enabled action are fixed; restore and support controls are distinct. Some card metadata still contains a dot separator. This is the remaining bounded visual mismatch. The correction budget is exhausted; automatic continuation stopped as required.

The user explicitly answered **Accept and implement with that correction** to the question naming removal of the metadata separators in native SwiftUI and reuse of the exact existing illustration. This is an explicit product exception and implementation instruction, not an automatic `meets direction` verdict. It changes no platform/accessibility requirement. Selected design and production assets remain platform A1–A3. The board itself is not imported into the app.

| State | Final R3 inspection against selected contract                                    | Classification / implementation action                                                   |
| ----- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| E1    | Phone light/dark ink invitation, secondary tier, complete art, explicit capsule  | Match except metadata separator; remove in SwiftUI under explicit acceptance             |
| E2    | Restrained wide iPad card with larger whole illustration                         | Match; narrow/landscape layout is runtime proof                                          |
| E3    | Paid title/status and management action, no free invitation                      | Match except accepted metadata correction                                                |
| E4    | Paid canceled tier with retained access                                          | Match except accepted metadata correction                                                |
| E5    | Paid grace and retry, payment recovery status, management action                 | Match except accepted metadata correction                                                |
| E6    | Expired and revoked, free context and enabled view-plans action                  | Match except accepted metadata correction                                                |
| E7    | Cached disabled action; opening spinner inside control                           | Match except accepted metadata correction                                                |
| E8    | Plain account loading / unavailable retry without fabricated plan                | Match; retained existing UI                                                              |
| P1    | Full existing sheet with monthly price, allowances and legal/restoration context | Match; retained existing UI                                                              |
| P2    | Separate product loading / unavailable with disabled checkout                    | Match; retained existing UI                                                              |
| P3    | Pending approval prevents repurchase                                             | Match; retained existing UI                                                              |
| P4    | Cancellation returns silently to selected plan and price                         | Match; retained existing UI                                                              |
| P5    | Purchase error by purchase action, restore error and support by restore          | Match; retained existing UI                                                              |
| P6    | Existing confirmed success and continue                                          | Match; retained existing UI                                                              |
| M1    | System handoff and return, no recreated Apple payment UI                         | Match; native management retained                                                        |
| MC1–3 | No idle motion, opacity press, native sheet and existing state rendering         | Matches static capabilities; timing, interruption and Reduce Motion remain runtime proof |

Motion evaluation: the static proposal shows no displacement, parallax or decorative loop and preserves the specified press/sheet/state intent. Provenance remains Design Arc judgment for instantaneous press opacity, pattern-level inference for standard sheet behavior, and unverified for exact platform timing. Static imagery cannot verify interruption or Reduce Motion. Native verification follows under the user's frontend authorization.

## Implementation record

The accepted card is implemented in `AccountView.swift` as one native Button with `MembershipEntryLabel` and opacity-only `MembershipEntryButtonStyle`. The current metadata uses spaced labels without punctuation separators. The same explicit `UIImage(named: "membership-reading.png")` reference as the purchase sheet imports A1, with no new or extracted artwork. The source hash still matches the asset manifest.

`ViewThatFits` selects a 240-point or 160-point whole illustration beside the headline, then a stacked fallback. Accessibility text sizes omit only the decorative illustration. Text containers grow without a fixed card height. Paid status and ended-subscription messages stay visible. The action capsule is label content, never a nested Button. Native navigation and provider routing are unchanged.

Historical measurement for the superseded solid card: token contrast for paper `#F8FAF8` against light card `#192024` is 15.72:1, and against dark card `#27272A` is 14.20:1. Secondary metadata uses 80% paper opacity; appearance inspection and native state checks follow. These token calculations do not substitute for rendered layout or assistive-technology verification.

First native iPhone build and launch succeeded. The running phone capture shows the complete illustration, separate headline/action, full-width card and unchanged quota cards. Phone and iPad UI tests and final visual inspection remain in progress.

### User-authored copy amendment

After implementation started, the user replaced the assistant-authored headline with `畅学语言，畅行天下。`. This exact line now appears on the free entry card and the purchase sheet. The card breaks after the comma. Paid cards retain their actual plan title. Earlier static boards preserve the superseded headline as review history and are not current copy specifications. This explicit amendment requires no new direction or asset choice.

### User-directed wallpaper amendment

The user rejected the solid ink background as dull and explicitly requested trying the existing wallpapers as card backgrounds. This supersedes the solid-background portion of D1 and the earlier static board. The canonical implementation now uses the bundled daytime and nighttime meadow pair, ink labels/action fill by day and paper labels/action fill by night. The book illustration, user-authored headline, semantic single-button structure, routes, status and motion contracts remain. This is a direct amendment to the authorized implementation, not a silent automatic approval of another generated proposal. No new image is generated or substituted. Native visual and interaction verification is required again for the changed background/contrast.

- A4: exact existing `apps/leximory-ios/App/Resources/Assets.xcassets/HomeWallpaperLight.imageset/wallpaper.png`; SHA-256 `33ddca6443ce9a7ed15d853de0b46ef3d836d0c9a39ad457d75fef41a15c2fe4`. Bundled platform asset set, used only as decorative card background for light appearance. Source integration present; new runtime proof pending.
- A5: exact existing `apps/leximory-ios/App/Resources/Assets.xcassets/HomeWallpaperDark.imageset/wallpaper.png`; SHA-256 `ecab5098d0ed128b7b43fb577343f1b22df6e2d6a9766c30e2dbd8112d173e7a`. Bundled platform asset set, used only as decorative card background for dark appearance. Source integration present; new runtime proof pending.

### Wallpaper verification in progress

Phone build and all 3 account UI tests passed on the wallpaper implementation, including light entry, paid dark management/return, largest text and landscape activation. Inspected full-size phone light, paid dark and largest-text captures. A1 loads whole and unclipped. A4 and A5 load from their exact asset-catalog entries; the horizon stays near the lower edge and the backgrounds remain within the card corners. Native text remains separate and readable in both appearances. Largest text omits the decorative book while retaining the wallpaper and complete action text. Wallpaper-specific contrast is visually inspected here, not certified from the old solid-token measurement.

The final refinement scopes the opening spinner to subscription management, so unrelated account edits do not make the card appear to be opening. iPad source is built with that refinement; final iPad tests and normal-mode cleanup remain pending.

### Final native verification

- Wallpaper iPhone run: 3 account UI tests passed, result `test_sim_2026-10-18T04-17-19-398Z_pid18128_548e889c.xcresult`.
- Wallpaper iPad run: 3 account UI tests passed, result `test_sim_2026-10-18T04-20-02-401Z_pid18128_4e2bb2d4.xcresult`. This build includes the subscription-only opening state.
- User-authored purchase-sheet copy: screenshot/selection/orientation test passed on phone in `test_sim_2026-10-18T04-14-59-846Z_pid18128_7355379c.xcresult` and iPad in the 4-test passing run `test_sim_2026-10-18T04-09-37-723Z_pid18128_d77e307c.xcresult`. Purchase-sheet layout is unchanged by the wallpaper amendment.
- Inspected final phone free light, free dark, paid dark, largest-text and landscape entry; iPad free light, paid dark, largest-text and landscape. Artwork and wallpapers load, text and actions fit their card, whole-card activation and native sheet return work. The exact A1/A4/A5 references appear in source and the running app on compact and wide viewports. Asset-fidelity verdict: `matches user-amended direction`.
- Final source built successfully on both simulators. Runtime semantic snapshot identifies one `account-subscription` Button with the plan label and status value. Labels, controls and status are native, never flattened into the imagery.
- MC1 has no custom spatial animation or timing. Its instantaneous opacity behavior is source-verified; touch-down timing and Reduce Motion were not separately measured. MC2 sheet activation/dismissal is simulator-verified; exact system duration/easing and system Reduce Motion remain unmeasured. MC3 introduces no new animation. No physical-device, live purchase, production or conversion-lift proof is claimed.
- Stopped and relaunched both targets with empty launch arguments. Verified normal iPad browser and normal phone onboarding snapshots, with no fixture account or catalog. Fixtures use isolated in-memory account data. Real account data was preserved; no user-device installation, backend implementation or Supabase mutation occurred.

Final previews live in the task's visualization directory as `account-iphone.png`, `account-iphone-dark.png`, `account-ipad.png`, `account-ipad-dark.png`, and corresponding accessibility captures. Earlier boards and solid-background captures are historical, not current visual specifications. Backend delivery, real Sandbox testing, policy links, account deletion, AI consent and provider-portal restrictions remain the release gates described in `billing-plan.md`.

## Card refinement after wallpaper adoption

The user requested native Liquid Glass on the card action, less status clutter, a larger plan name using the correct English display face, and a fresher heatmap. They clarified that the font correction concerns the plan name on the card, not the purchase-sheet wordmark or allowance numbers, and selected keeping EB Garamond. The card had forced the Chinese face for its headline, which also changes Latin glyphs. It now uses the existing EB Garamond-based editorial helper with its Chinese cascade, at 30 pt compact and 38 pt in the fitting wide composition. The free plan caption increases from 13 to 18 pt. The purchase-sheet display typography is unchanged.

The action keeps the same one-Button semantics and uses `.glassEffect(.regular.interactive(...), in: .capsule)` after its layout. It has a standard material fallback. There is one glass element, no glass-on-glass layering or custom morph. Native interaction timing and system accessibility rendering remain platform behavior, not invented motion values. Sources: [Apple custom Liquid Glass](https://developer.apple.com/documentation/SwiftUI/Applying-Liquid-Glass-to-custom-views) and [Materials](https://developer.apple.com/design/human-interface-guidelines/materials).

Routine active/free status copy is removed from the card and paid overview through one optional `membershipNotice` property. Cancellation, grace, billing retry, expiry and revocation retain their existing messages. Success confirmation remains a one-time purchase result. No entitlement, backend or schema behavior changes.

The user then supplied the exact heatmap palette `["#edeec9", "#dde7c7", "#bfd8bd", "#98c9a3", "#77bfa3"]`. It replaces the temporary green ramp with five opaque shades at counts 0, 1, 10, 20 and 35, shared by cells and legend in both appearances. Day numbers stay dark; contrast is verified separately. Calendar dates and activity counts are unchanged. Native phone/iPad inspection and focused checks are pending for this refinement.

The phone run `test_sim_2026-10-18T05-33-18-872Z_pid18128_76adf0f9.xcresult` passed all 9 reported checks, including the four account UI flows and membership checks. The final user-selected five-color palette was numerically checked against its black day numbers, with contrast from 9.77:1 to 17.67:1. Those exact colors supersede the temporary ramp in the earlier capture. The user then requested immediate wrap-up and no further verification was started. iPad build and normal-mode cleanup are the final housekeeping steps; no new screenshot or broader accessibility certification is claimed for that palette.

Final housekeeping completed: the iPad build succeeded, both simulator apps were stopped and relaunched with empty arguments, and fixture mode is cleared. Real account data is preserved. No backend or Supabase changes were made.

## User-supplied wallpaper replacement, 18 October 2026

The user supplied a new day/night pair and requested replacing the default wallpapers. These assets supersede A4 and A5 above. Both originals remain at 3344 × 1882 pixels, with no recompression or image edits. The home screen and subscription card continue to share the asset-catalog entries.

- `HomeWallpaperLight` now uses the exact user-supplied `day-lawn-wallpaper.jpg`, stored as `apps/leximory-ios/App/Resources/Assets.xcassets/HomeWallpaperLight.imageset/wallpaper.jpg`. SHA-256 `cd2a22eb579e2c096b933b5eb70d30676f5e7437dc28cf9db381f698ce3fdada`.
- `HomeWallpaperDark` now uses the exact user-supplied `night-lawn-wallpaper.jpg`, stored as `apps/leximory-ios/App/Resources/Assets.xcassets/HomeWallpaperDark.imageset/wallpaper.jpg`. SHA-256 `40d0866983ffb3be27f098e136f52cc359457c70d69adab47b1cdb467bcf7744`.

The focused wallpaper and membership suites pass 14 tests on each of iPhone and iPad. Account-card activation and purchase selection/success pass on both sizes. The iPad largest-text and landscape check also passes. The iPad capture shows the supplied meadow behind the plan name and glass action, with the original book artwork retained.
