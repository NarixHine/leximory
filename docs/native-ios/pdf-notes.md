# PDF handwriting

The iOS PDF reader uses PencilKit page overlays with the native tool picker. The pencil button enters handwriting mode; the checkmark returns to reading mode for text selection, lookup, and quote bookmarks. Notes remain visible in reading mode. Handwriting remains editable offline, independently of network-only learning actions.

The original PDF is never rewritten. Each page stores an editable PencilKit archive. An encoded empty drawing is a normal update, so erased strokes do not return after synchronization. The canvas and tool picker both cap PencilKit content at version 4, available on the app's iOS 26 minimum.

## Storage

`PDFNotesStore` owns an account/backend partition in Application Support under `Leximory/PDFNotes`, separate from the evictable reading cache. Each atomic page record contains its current drawing, known remote revision, and complete frozen upload request when a request is in flight. A request's revision UUID and drawing remain unchanged on retries. New strokes receive a new UUID and stay pending when an older request is acknowledged.

Entering handwriting retains the source PDF and descriptor in the partition's `Sources` directory. Retained bytes provide offline fallback after reading-cache eviction. Source files are excluded from system backup; the user-authored note records are not. iOS file protection covers the partition. Account sign-out closes the note store without deleting its records. The same backend/account can resume uploads after signing in again. Another account cannot open that partition through the app.

Confirmed access removal or deletion removes retained source PDFs while preserving unresolved handwriting. Successful full library/text refreshes reconcile retained sources. Replacing a PDF gives it a new version key and preserves older notes separately. Old-version drawings are not automatically transferred to new pages.

File format 1 records strokes in the page overlay's logical coordinate space, with explicit width/height. Resizing and PDF zoom update the canvas viewport and PencilKit's native zoom while archives retain page coordinates. The canvas cancels outer page magnification to avoid stretching its rendered surface. PDFKit owns the page's crop and rotation placement. Interaction and visual alignment still require human verification.

## API

The existing `public.pdf_page_notes` table holds one row per authenticated user, text, PDF object version, and zero-based page index. Its grants allow only the existing server-side service-role client. The API authorizes current ebook/text access and scopes every database query to the authenticated user. No schema or Supabase changes are performed by the app implementation.

- `GET /texts/{textId}/pdf-notes?pdfVersion=...&after=...` returns one page drawing and its next page-index cursor. A final empty response terminates pagination. Returning one drawing bounds response size.
- `POST /texts/{textId}/pdf-notes` saves a complete drawing with its base revision and new revision UUID. An omitted or null base revision means a first save and inserts a row. Later saves atomically update the page key only when the stored revision matches the base. A repeated request with the same revision and payload is acknowledged. A conflicting request returns 409.

Drawing data uses base64 in JSON. The current upload cap is 2 MiB of raw PencilKit data per page. A larger drawing remains local and displays a recovery option at the handwriting control. The server checks page-index limits, geometry, format version, canonical base64, and request size. It does not parse the PDF to verify an archived version's actual page count. Version metadata and geometry come from the PDF reader; archives remain private to their owner.

The ebook descriptor includes its storage `sourceVersion`. Cached descriptors from before this feature can recover it from the existing signed URL's `v` parameter. The version identifies source bytes, not the expiring signing token.

## Synchronization and recovery

Note uploads run independently of library downloads, after a short idle delay, while foregrounded, and on reconnect. The foreground worker retries every 20 seconds. Remote notes are refreshed for the active PDF. Local dirty pages and pages edited during an older remote read cannot be overwritten by that read. Unchanged remote drawings do not rewrite local files.

A conflict retains both drawings and presents a choice at the affected handwriting control. Resolving it archives both versions locally before accepting the chosen version. There is no stroke merge, which could otherwise restore erased content. If an acknowledged save has already been replaced by another device before a retry, the retry conservatively becomes a conflict; the table does not keep an indefinite request ledger.

Transient network failures remain silent. Permanent upload failures expose recovery at the handwriting control. Local write failures retain the current drawing in memory and request a retry. A read/decode failure never replaces a stored drawing with a blank one. No manual synchronization controls, connectivity banners, or sync timestamps appear in the reader.

Notes do not guarantee immediate upload while iOS suspends the app. They upload when the authenticated app next has network access and execution time. Deploy the mobile API changes before testing account synchronization against that backend. A missing note endpoint is not treated as revoked PDF access.

Mac Catalyst does not show Apple's tool picker. The handwriting control is disabled there; existing notes remain readable. This implementation does not provide typed notes, PDF export, browser editing, or automatic cross-device stroke merging.

## Preliminary checks and human verification

Automated checks cover authorization, version/page isolation, conditional database queries, duplicate requests, frozen upload retries after a lost response, newer edits during acknowledgment, conflict resolution, storage failure recovery, cache-independent source retention, payload limits, and generated API serialization. Native tests cover drawing persistence, zoom coordinates, ink appearance, and tool-picker restoration. PDF selection UI checks run in reading mode.

Physical Pencil input, palm rejection, and cross-device synchronization still require human verification. No physical-device installation or live Supabase writes were performed for testing.

Human checks:

1. Open a real PDF, enter handwriting, draw with the native tools, partially erase, and finish. Reopen it and erase another part of an earlier stroke.
2. Repeat offline, terminate/relaunch, reconnect, and confirm the drawing arrives as editable strokes on another device.
3. Check finger drawing and two-finger scrolling on iPhone. On iPad, check Pencil drawing, finger navigation, palm rejection, and the system finger-drawing preference.
4. Check continuous scrolling, zoom, crop offsets, rotated pages, orientation changes, narrow windows, ink colors in light/dark appearance, and return to word selection/bookmark controls.
5. Edit the same page on two devices, including an erasure. Confirm neither version silently replaces the other and that each resolution choice behaves as labeled.
6. Erase the final stroke, reopen on both devices, and check that it stays erased. Replace the PDF and confirm old notes are not placed on new pages.

Retained PDFs are outside the cache budget to preserve offline reading. Their storage footprint and the provisional 2 MiB page limit should be assessed with real annotated documents during human verification.
