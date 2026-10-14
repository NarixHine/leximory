# Native review

The iOS Home card 每日复习 opens an account-scoped timeline inside the browser workspace. The address bar remains visible through the timeline, lawn and exercises. Each earlier day's language entry opens the lawn, translations and daily writing. Home combines recent reading and webpages into 继续浏览, with up to three non-webpage resources and one page-title link placed first, a 400 pt maximum measure and single-line labels, and outline resource icons. The address bar also shows webpage domains. Recent reading restores saved titles and resource types synchronously from account-scoped preferences; older ID-only records resolve against the cached catalog before network refreshes. Home uses four matching square cards on wide screens, with filled icons tinted to each border palette. Today remains a collection day. Returning from a review updates that day's progress without replacing loaded history or its cursor.

The native flow retains the web artwork, copy, evaluation feedback and progress rules. At least 60% of translations must be complete to unlock writing. Completing writing sets progress to 100%. Timeline and lawn are browser resources. 连词成文 is omitted from iOS. Word pills use 16 pt prose text, 16 pt horizontal padding, and a 44 pt minimum height. Word pills open an in-place translation tray, with a compact input above the persistent address bar. Keyboard avoidance applies to the tray and input; the lawn keeps its geometry. The persistent back chevron dismisses trays first, then leaves the lawn. Home leaves the lawn and Back restores it. There are no duplicate review close or cancel controls. The loading indicator overlays the lawn to preserve its initial position. Empty lawn taps move the 100 pt white cat using the web sprite and distance-based motion phases. Timeline definitions use the existing vocabulary editor.

## API

All native requests require a verified Supabase bearer token. The mobile adapter passes the verified owner to the shared server review operations. The web routes retain their session authentication and error responses.

| Endpoint under `/api/mobile/v1/review` | Method | Purpose |
| --- | --- | --- |
| `/` | GET | Dated words, per-language progress, pagination |
| `/check` | GET | Generation and evaluation state |
| `/start` | POST | Existing review generation workflow |
| `/translation` | POST | Existing translation submission and evaluation |
| `/conversation` | POST | Existing writing submission, including the server-side unlock gate |

The adapter separates vocabulary labels from their serialized annotations. It projects story Markdown through the existing native reader contract. Account-scoped caches support reading offline. Submission and editing controls disable offline. Pending evaluations recover on foregrounding. A lost submission response triggers a read before another submission is allowed.

## Verification

- `pnpm --dir apps/leximory run check-types`
- `pnpm --dir apps/leximory run test:mobile`: 114 passing checks, including verified ownership, unauthenticated access, invalid selections, timeline annotation projection and annotated story rendering.
- `swift test --package-path apps/leximory-ios/Core`: 67 tests passed. Review tests verify progress thresholds, completed writing, bearer refresh, submission identity and mutation failures without replay. Motion tests verify sprite dimensions, travel speed, turning, acceleration, landing, diagonal tilt, rendered heading in all four diagonal directions, and short-distance taps. Sprite and dust share the same rotation followed by horizontal reflection.
- `LeximoryUITests/ReviewUITests`: Home entry, in-place translations, submission and feedback, writing unlock and reply, 100% progress on return, empty lawn taps, Home/Back restoration, dark appearance, accessibility-size text, landscape control bounds, persistent address-bar access in each step, content-sized word wrapping, and four matching square cards on iPad. The software-keyboard check asserts unchanged lawn and pill geometry, an input below 100 pt high, and the input moving above the keyboard. Tests use isolated iPhone and iPad simulators. In Xcode 27 Device Hub, turn off Device → Keyboard → Simulate Hardware Keyboard for the software-keyboard check.

The translation flow test also submits using Return, checks the input's two-line minimum, reads the reference answer directly, opens an anchored correction popover from the highlighted answer, and resubmits from 修改回答. Correction and praise details have no separate cards.

The UI transport is restricted to DEBUG simulator builds and the existing browser workspace fixture mode. Each UI test relaunches without fixture arguments; normal launch removes the workspace fixture cache. The supplied test account was also used to compare the live web and native timeline and translation prompt. Opening the web day prepared its review through the normal product workflow. No live translation or writing answers were submitted, and no physical device was used.

Use a signed Simulator build (`CODE_SIGNING_ALLOWED=YES`, or the default Xcode signing settings) for real-account verification. An unsigned build can authenticate remotely but cannot retain its session in Keychain. Keep passwords out of source files, launch arguments and test fixtures.
