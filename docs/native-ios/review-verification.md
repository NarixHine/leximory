# Native review

The iOS Home card 每日复习 opens an account-scoped timeline. Each earlier day's language entry opens the lawn, story, translations and daily writing. Today remains a collection day. Returning from a review updates that day's progress without replacing loaded history or its cursor.

The native flow retains the web artwork, copy, annotated stories, evaluation feedback and progress rules. At least 60% of translations must be complete to unlock writing. Completing writing sets progress to 100%. Reading, editing, keyboard dismissal and feedback details use native sheets, popovers and controls. Story definitions are read-only; timeline definitions use the existing vocabulary editor.

## API

All native requests require a verified Supabase bearer token. The mobile adapter passes the verified owner to the shared server review operations. The web routes retain their session authentication and error responses.

| Endpoint under `/api/mobile/v1/review` | Method | Purpose |
| --- | --- | --- |
| `/` | GET | Dated words, per-language progress, pagination and streak |
| `/check` | GET | Generation and evaluation state, plus the native annotated story document |
| `/start` | POST | Existing review generation workflow |
| `/translation` | POST | Existing translation submission and evaluation |
| `/conversation` | POST | Existing writing submission, including the server-side unlock gate |

The adapter separates vocabulary labels from their serialized annotations. It projects story Markdown through the existing native reader contract. Account-scoped caches support reading offline. Submission and editing controls disable offline. Pending evaluations recover on foregrounding. A lost submission response triggers a read before another submission is allowed.

## Verification

- `pnpm --dir apps/leximory run check-types`
- `pnpm --dir apps/leximory run test:mobile`: 114 passing checks, including verified ownership, unauthenticated access, invalid selections, timeline annotation projection and annotated story rendering.
- `swift test --package-path apps/leximory-ios/Core`: the existing 58 tests passed. The four additional review tests verify progress thresholds, completed writing, bearer refresh, submission identity and mutation failures without replay.
- `LeximoryUITests/ReviewUITests`: Home entry, story reading, translation submission and feedback, writing unlock and reply, 100% progress on return, dark appearance, accessibility-size text, and landscape control bounds. Tests use isolated iPhone and iPad simulators.

The UI transport is restricted to DEBUG simulator builds and the existing browser workspace fixture mode. Each UI test relaunches without fixture arguments; normal launch removes the workspace fixture cache. No physical device installation or live database/AI mutations were used for verification. Live generation and evaluation remain connected to the existing authenticated server workflow and were not exercised against a real account.
