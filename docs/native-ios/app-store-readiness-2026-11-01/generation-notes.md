# Image generation record

Created with the built-in Image Gen tool, not an API or CLI fallback. These are complementary screen studies for the recommended experience. Native components and bundled fonts remain authoritative for implementation.

All prompts requested a 390 × 844 logical-point portrait screen, app content only, with no phone bezel, status bar, notch, OS clock, home indicator or external captions. They specified Chinese-first literary typography, clear hierarchy, generous spacing, exact Chinese copy, and 1 November 2026 as the date anchor without a visible date.

## Home prompt

Create one realistic production-quality iOS Leximory Home UI design. Use the actual existing day wallpaper faithfully as aspect-fill background. Fixed Chinese card titles use a graceful Chinese Song serif, Latin interface Urbanist, Latin content titles EB Garamond. No logo, avatar, sign-in banner, signup nag, dashboard metrics or new navigation tabs.

Keep the existing exact four Home cards in a centered aligned 304 pt square 2×2 grid, 12 pt gaps, 24 pt corner radius, each 146 pt square, no tilts. Titles: 浏览网页, 我的书签, 打开电子书, 每日复习. Use globe, bookmark, closed book and leaf icons, with small arrow.up.right controls. Existing card colors: #E0EEDD, #DDEFE6, #DCEEF2, #E1E9F8; subdued green-black ink #2D493F; gentle translucency and subtle gradients only on the existing cards.

Leave wallpaper visible above and below. Add one small optional sample entry below the cards: eyebrow 试读, title The quiet art of noticing, document outline and chevron. Use a white glass backing only as needed. The bottom floating glass address bar has a neutral Leximory label and circular More control. Hide unavailable Back, Forward and Home on fresh Home. Account lives in More. No marketing headline or feature inventory.

Reference: `apps/leximory-ios/App/Resources/Assets.xcassets/HomeWallpaperLight.imageset/wallpaper.png`.

## Sign-in prompt

Create a realistic production-quality contextual sign-in screen for Leximory. Native large sheet, light iOS grouped background #F2F2F7, white grouped fields, short drag indicator, neutral circular xmark close control. The actual app icon is identity grounding only; do not place it on the form.

Heading: 让生词成为你的词汇, in elegant Chinese Song serif like 欣意吉祥宋, approximately 28 pt. Supporting copy: 登录后保存生词，并在每日复习中重温。 Ordinary Chinese text uses ChillDuanHeiSong-style serif; Latin uses Urbanist. No sage tint on ordinary controls.

Two-row white group with persistent 邮箱 and 密码 labels, email placeholder yourname@example.com, password placeholder dots and native credential affordances. 忘记密码？ follows with a comfortable tap area. Nearly black primary capsule 登录并继续, about 54 pt high. Secondary 没有账号？ 注册. Footer 服务条款 与 隐私政策. No prechecked consent or keyboard in this frame. Preserve space for keyboard adaptation.

Closing returns to the original reading selection or draft. No Apple, GitHub or Google buttons in this baseline, no upsell, illustration, decorative badges, feature lists or shadows.

Reference: `apps/leximory-ios/App/Resources/Onboarding/leximory-icon.png`.

## Deletion prompt

Create a realistic production-quality account deletion details screen. Use native iOS grouped gray #F2F2F7 and white grouped rows. Neutral black/gray controls, red only for deletion. The actual app icon is aesthetic grounding only; no cats or artwork on this screen.

Native back navigation 账号 and title 删除账号. Large Chinese display heading 删除后，无法恢复. Supporting text 你的文件夹、文本、生词和学习记录将被永久删除。

One white two-row group: 将删除 / 账号及关联的学习数据, then 删除完成后 / 返回主页，仍可浏览网页和打开电子书.

Section 你的订阅: 删除账号不会取消 Apple 订阅。 Secondary 请先管理订阅，避免继续扣费。 Row 管理 Apple 订阅 with external-link symbol. Footer 订阅状态不影响你立即删除账号。

Bottom action 删除账号 in system red text on a white native grouped row. This opens the final confirmation; do not draw an alert overlay. No forced cancellation checkbox, password field, survey, countdown, sad cats, manipulation or warning illustration.

Reference: `apps/leximory-ios/App/Resources/Onboarding/leximory-icon.png`.

The final correction prompt was: "Edit this Leximory DELETE ACCOUNT UI concept with precisely one correction: the top left back chevron and 账号 navigation label must be neutral near-black primary label color, matching the screen's black navigation title. They must NOT be blue. Keep everything else unchanged including all Chinese text, exact layout, sizes, typography, white rows, gray background, red bottom delete action, and subscription warning. Do not add or remove any element. This is semantic neutral navigation to match this app's established styling."

## Visual review

All final images were opened and inspected. The deletion navigation correction was checked. Chinese labels and the proposed action hierarchy are legible. Image generation approximates bundled fonts, SF Symbols and native metrics; it does not reproduce them exactly. In particular, implement Home using the existing filled symbol variants and exact grid geometry, rather than tracing the generated icon outlines. The screen specifications in `experience.md` take precedence over raster details.

The studies cover light appearance. Dark appearance, Dynamic Type, keyboard layout and VoiceOver are specified for later native verification and are not claimed as tested here.
