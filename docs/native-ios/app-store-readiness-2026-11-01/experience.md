# Adjusted native flow

The implementation follows the user's final simplification: no guest word saving, guest library, or migration. Existing account behavior remains the reference.

1. Launch restores an existing account using its established cached and offline behavior. A genuinely signed-out installation opens the existing Home immediately.
2. Guests browse websites or choose an EPUB/PDF in Files. Local files remain in memory and are not uploaded or added to a guest library.
3. The existing selection controls open the real annotation tray. The first guest AI lookup requests contextual processing permission. Five free generated lookups are available per 30-day credential period.
4. 收藏词汇 opens the approved optional account sheet with the annotation base form, available source excerpt/title, existing typography, watercolor highlight and meadow artwork. Closing returns without saving. Signing in saves that single word to the account. Registration, confirmation and password recovery stay in the same native form.
5. Cloud library, reviews, imports and account allowances require sign-in. More > 账号 opens optional sign-in. Signed-in users keep their existing home, libraries, readers, trays, saving, quotas, review and widget paths.
6. 账号 > 删除账号 opens a native explanation of permanent data deletion, shared account scope, and separate subscription cancellation. A destructive confirmation starts deletion. Recent authentication is required. The app preserves an opaque receipt before sending, signs out after confirmed acceptance, and can recover pending/failed/completed status without an account token. The app reports completion only when the worker confirms it.

## Architecture

Guest file input is a small immutable wrapper around the existing reader input. No durable guest word collection, progress database, sync engine, merge, or account migration exists. A lazy Keychain guest token uses the existing Redis/AI stack. The authenticated single-word endpoint reuses shadow libraries and vocabulary persistence. Deletion uses existing Inngest infrastructure plus a Redis receipt and ownership manifest so storage can still be removed after metadata changes.

## Design

[Optional account reference](05-optional-account.png) is the approved direction. The app uses bundled prose/interface faces, neutral system labels, flat fields, a black primary capsule, the real sage word highlight and existing lawn/cat assets. The form scrolls under the keyboard and supports Dynamic Type. It does not autofocus a field or replace native reader controls. Account deletion uses native navigation, a red destructive action, and one confirmation.

Earlier generated reader alternatives are exploratory artifacts, not implementation specifications. The current [guest AI notes](guest-ai.md) describe the implemented allowance and its limitations.

## Actual annotation data

The account headword uses `Definition.lemma`, the annotation's base form. `original` retains the selected occurrence for vocabulary persistence and source context. The formatted definition remains intact; it is not parsed to guess a short Chinese translation. Webpage, EPUB and PDF selection inputs include context and a UTF-16 offset. An excerpt appears only when actual surrounding text exists. Source titles are captured from the browser or reader when lookup begins, then omitted when absent. No author, chapter or fabricated title is inferred. Canonical language codes stay separate from display names so typography cannot change the language used for saving.

The simulator account preview now reads an existing bundled `ReadingDocument` annotation instead of constructing a bank/river-path marketing example. An inflected-form UI scenario checks that selecting **leaves** displays the annotation's **leaf**. These are local scenario checks, not evidence of live AI requests.

User-approved copy is **登录解锁词汇本** with **登录后即可在云端同步生词并定期复盘噢！**. The unnecessary reading eyebrow is removed. Dedicated light and dark assets live in the native asset catalog; the dark highlight was repainted to share the meadow's slate-blue palette. See [asset prompts and final files](account-assets.json).
