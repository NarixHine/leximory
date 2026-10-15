# PDF handwriting implementation plan

Drafted 2026-10-15. Scope: private, editable handwriting on iOS PDF pages, local persistence, and automatic synchronization to Leximory's DB. The user runs the SQL through the Supabase dashboard. No live schema changes or Supabase operations have been performed.

## Fixed choices

- Keep PDFKit and add a PencilKit canvas per visible page, with one native tool picker for the reader. Keep source PDF bytes unchanged.
- Store complete page drawings, rather than individual stroke operations. Typed notes, PDF export, web editing, and automatic stroke merging are outside the first version.
- Use one remote table, `public.pdf_page_notes`, with no new buckets, triggers, extensions, or SQL functions. Store the PencilKit archive as base64 text to keep the generated JSON contracts simple. This costs roughly one third more space than raw bytes.
- Keep all database access behind Leximory's authenticated mobile API. The existing server uses the service-role client. Enable RLS and revoke direct client access; add no client policies. The API must scope every query to the authenticated user and check current text access. [Supabase grants and RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
- Use zero-based page indices. `pdf_version` is the existing storage object version, exposed explicitly in the ebook descriptor and retained with the cached source. It is not the signed URL or its expiry.
- Use `revision` as an opaque UUID, also serving as the save's stable retry identity. Never order revisions or resolve conflicts by timestamps. The server must write the client-generated UUID, rather than rely on the insert default for sync saves. [PostgreSQL UUID generation](https://www.postgresql.org/docs/current/functions-uuid.html).

## 1. Add remote storage and contracts

Run [pdf-notes.sql](pdf-notes.sql) once in the Supabase SQL editor. Its transaction creates only the new table and its grants. It intentionally fails if that table already exists rather than silently accepting a different structure. `text_id` is text because Leximory creates text IDs with `nanoid`; `user_id` references the UUID in `auth.users`.

Regenerate the Supabase database types using the project's normal process after the table exists. Add shared API schemas and two operations: list page notes for a text/PDF version and save a single page snapshot. Return revision and coordinate metadata with each drawing. Extend the ebook descriptor with its source version, using the same metadata used for the existing signed URL's `v` parameter.

Follow the existing feature module, endpoint, route registration, and generated Swift-client workflow. Before changing Next.js code, read its relevant installed documentation as required by AGENTS.md.

The save request carries the page key, drawing, dimensions, format version, `baseRevision`, and `revision`. The API derives `user_id` from authentication. Validate current text access, source-version syntax, PDF format, page-index bounds against the available source, finite dimensions, supported format, valid base64, and payload size. The new revision must differ from the base revision. Accept saves for an older source version as private archived notes, so replacing a PDF while a device is offline does not discard its pending work; the current reader only loads the current version's notes. Start with an explicit request-size cap selected using prototype measurements; oversized notes remain saved locally with an actionable failure rather than being discarded.

Acceptance: unauthenticated requests fail; user A cannot read or write user B's notes; newly created notes remain private even on a shared library; a replaced PDF does not return old-version notes as current notes. The server credential never enters the iOS app.

## 2. Implement atomic conflict checks in the server

No read-then-unconditional-upsert sequence is allowed.

| Request | Atomic database operation | Result |
| --- | --- | --- |
| First save, `baseRevision = null` | Insert a row with the requested new revision | Success; a primary-key race proceeds to retry/conflict handling. |
| Existing page | Update the full page key **and** `revision = baseRevision`; set the new revision and `updated_at` | Success only if a row is returned. |
| Retry of an accepted save | Read the scoped row after an insert collision or update miss | If its revision equals the requested new revision and its payload matches, acknowledge it. |
| Competing edit | Insert collides or conditional update returns no row; the stored revision differs | Return HTTP 409 with the current revision. Preserve the local snapshot. |

Supabase/PostgREST supports an update filtered by the old revision, so the comparison happens in the same SQL statement as the write. The save API must select the updated row to detect zero-row updates. If a later device has already changed the row, an old retry conservatively returns a conflict; this simple table does not maintain an indefinite history of accepted mutation IDs.

After a 409, retain both versions locally and offer a deliberate choice between them. Before replacing the remote version, use its newly fetched revision as the next base. Do not concatenate drawings, which can restore erased strokes. Empty drawings use the same save protocol; deleting their rows would lose conflict history and permit old strokes to reappear.

Acceptance: two simultaneous saves from the same base cannot both replace the page; retries after a lost response are safe; a stale retry never overwrites a newer page; an erase-to-empty survives synchronization and reopening.

## 3. Add durable local storage and upload queue

Add an app-local note store, separate from `LocalReadingStore` and its cleanup/eviction directory. Use a small local SQLite store for page snapshots and pending state, committing both in one transaction. Scope the store by backend and account. Retain source PDFs for documents with notes outside the evictable reading cache so those documents remain readable offline.

Each local record contains the remote page key, editable drawing bytes, geometry/format metadata, base remote revision, a local generation, and pending state. Each in-flight upload freezes its exact payload and retry UUID. New edits while it is in flight create a newer local generation. An acknowledgment clears pending state only for the generation sent; it advances the newer generation's known remote base without replacing its drawing. After a crash with an uncertain upload outcome, retry the frozen request before sending the newer snapshot. Its identity and payload must survive restart.

Load local drawings before enabling page editing. Save changes throughout interaction and flush at completed gestures, page dismissal, and background transitions. A stale disk load or remote response cannot overwrite a newer local drawing. Keep notes and pending uploads on authentication expiry or sign-out, protected and inaccessible to another account; resume only when the same account authenticates. Explicit account deletion can purge them after confirmation of that user-requested action.

Acceptance: saved strokes and partial erasures survive termination and offline reopening; cache eviction cannot remove notes or their retained source; unfinished uploads survive restart; local write failures retain the in-memory drawing and expose recovery at the affected drawing control.

## 4. Integrate drawing into the reader

Extend `NativePDFReader` in `EbookScreen.swift` with a retained overlay provider, `PKCanvasViewDelegate`, and reader-level tool picker. Add one drawing toggle. Reading mode retains Leximory's word selection, lookup, and bookmark actions; drawing mode routes touches to the canvases through `isInMarkupMode`. Notes remain visible in both modes.

Use a fixed page-local coordinate convention for format 1, with canvas width/height persisted. Prototype crop-box offsets and rotation before fixing the convention. Keep the original PDF and bookmark annotations outside the PencilKit drawing, so the eraser affects only handwriting. Coordinate PDF scrolling, canvas scrolling, pinch zoom, center taps, and edge-back behavior in `EbookControls.swift`. Support finger drawing on iPhone and Pencil drawing on compatible iPads. Local notes stay editable offline independently of the reader's existing network-based `readOnly` flag.

Acceptance: draw, partially erase, save, terminate, reopen offline, and erase an older stroke; verify alignment after zoom, rotation, resizing, and page recycling. Verify word lookup and bookmark controls after leaving drawing mode, unchanged source PDF bytes, and bounded canvas memory in a long document.

## 5. Connect automatic sync and verify release behavior

Extend `NativeSync` with a note-upload worker that runs after local saves, on foreground entry, and on network recovery. Do not place uploads behind the full library download pass. Retry transient failures quietly with backoff; retain dirty pages. Fetch remote notes on reader entry and reconnect, without overwriting dirty local pages. Conflicts preserve both drawings until resolved. Stop uploads after confirmed access revocation, apply the existing access-removal policy to retained source PDFs, and retain unresolved handwriting under the original account.

Guarantee synchronization when the authenticated app next has network access and execution time. Immediate upload while suspended is outside the first version; notes remain durable locally.

Verify core store/queue behavior with Swift package tests, native drawing integration in simulator and on an iPad with Pencil, and server authorization/conflict behavior with injected stores through the existing mobile test harness. Include an actual two-client conditional-update race against a disposable local database before release. Never use a live user's account for automated verification.

Run the mobile route checks, mobile tests, and Leximory type checks required by the server AGENTS.md, plus the native/Core checks appropriate to the implementation. Verify account isolation, token expiry, edits during uploads, storage failures, PDF replacement, and reconnect without a manual refresh. Leave the app in normal account mode after verification.

## SQL behavior and limits

The SQL supplies storage, uniqueness, foreign keys, and server-only access. Revision checking and retry behavior belong to the API and are not automatically provided by creating the table. `updated_at` defaults on insert; the API sets it on every update. It is informational and is never the conflict check.

Deleting an auth user or text cascades to that user's or text's note rows. Replacing a PDF preserves older versions under the existing text, because each PDF version has a separate key. There is no extra index initially: the primary key starts with user, text, and PDF version, matching the list and save queries.

This plan and SQL have been reviewed against repository code and official documentation. The SQL has not been executed against Supabase, and runtime behavior remains to be verified during implementation.
