# PDF outline generation

The iOS contents tray offers AI generation for every PDF. Only the generation button calls AI. `PDFOutlineModel` belongs to the reader state, so dismissing the tray leaves its task and one undo/redo pair intact. A new successful generation establishes a new pair. Replacing a document creates a different model; late completion cannot change another reader's chapters.

## Saving and quota

`generatePDFOutline` authenticates the caller, requires folder ownership, checks the original PDF version, and returns a validated chapter tree. Results are cached by account, text, source version and request identity. Generation does not charge quota. The provider schema omits array-size bounds that Gemini rejects; the API still validates the original nonempty, 1,000-entry limit and chapter ordering before returning a result.

`savePDFOutline` serializes the outline on the server with pdf-lib. iOS PDFKit can display the edited tree but omitted outlines from both `dataRepresentation()` and `write(to:)` in the simulator round-trip test. The server changes the outline dictionary without drawing or replacing pages. Original content streams, resources, annotations, links and metadata remain in the PDF object graph.

Each generated PDF is uploaded under a new immutable storage path. After upload, one Redis transaction checks the active revision and remaining shared commentary allowance, publishes the file pointer, records a permanent request receipt and increments usage by exactly one. An upload, serialization, stale revision or quota failure cannot replace the active pointer or charge quota. A lost-response retry returns the recorded publication and never charges again. The existing generation button resumes a pending publication with the same request identity; a separate retry or save button is not shown.

Undo and redo select only one of the server-recorded before/after file hashes. They publish the selected file without a charge, upload or AI request. The client retains the corresponding bytes for the reading session. Concurrent changes reject a stale base revision instead of overwriting another saved outline.

Mobile ebook descriptors sign the active file and return an `outlineRevision`. The original `sourceVersion` remains unchanged, preserving handwriting's page-coordinate identity. The client caches the exact saved PDF and retains it with the notes store. Reopening, offline reopening and exporting those bytes preserve the embedded outline. Live completion changes only `outlineRoot` on the existing PDFKit document, so it does not navigate, reset zoom or replace live annotations.

Deploy the mobile endpoints with the iOS app. No database migration is required. Storage paths and Redis outline pointers/receipts are durable document state and must be retained together.

## Account settings

The quota table uses the existing account allowances and TTLs. PDF generation shares AI 词点额度 and costs one unit per successful saved generation. AI audio retains its existing separate allowance. Cached summaries retain their observation time so a cached TTL does not become a new reset deadline on each reopening. A successful generation refreshes account usage; undo and redo leave it unchanged.

## Verification

- `pnpm --dir apps/leximory run check-types`
- `pnpm --dir apps/leximory run check:mobile-routes`
- `pnpm --dir apps/leximory run test:mobile`
- `pnpm --dir apps/leximory run test:mobile-runtime`
- `swift test --package-path apps/leximory-ios/Core --disable-sandbox`
- iOS Simulator: `LeximoryTests/PDFOutlineTests` and the account summary/accessibility UI tests.

Server tests exercise authorization, invalid output, saved PDF structure and the production Lua publication transaction. Reader tests cover existing/empty outlines, save and generation failure, lost responses, duplicate taps, undo/redo, exhaustion, document switching, page/zoom stability and exported bytes. Client tests cover generated request retries, cache reopening, bookmarks, original note identity and retained handwriting. Account UI tests verify the table at standard and accessibility text sizes and leave the app in normal account mode.
