# Editable PDF notes on iOS

Research date: 2026-10-15. This is a feasibility study, not an implementation. No database, Supabase, or app behavior was changed.

## Recommendation

Keep the existing PDFKit reader. Add transparent PencilKit canvases through `PDFPageOverlayViewProvider`, and store a separate `PKDrawing` for each annotated page. Save locally first, then synchronize page snapshots through Leximory's authenticated mobile API. Keep the original PDF immutable.

This meets persistence, isolation, and simple drawing requirements with Apple frameworks. The drawing UI is a relatively small integration. Durable offline writes and conflict handling are the larger implementation work.

The scope here is handwritten notes and freehand marks. Typed sticky notes, text boxes, text-aligned highlighting, handwriting search, and collaboration are separate capabilities. PencilKit is not the complete Markup editor from Files or Notes.

## What Apple supplies

- `PKCanvasView` captures drawing; `PKToolPicker` supplies native drawing tools, colors, and controls. Use its standard tools rather than building brushes or an eraser. [PencilKit overview](https://developer.apple.com/documentation/pencilkit), [tool picker](https://developer.apple.com/documentation/pencilkit/pktoolpicker).
- `PKDrawing.dataRepresentation()` saves editable drawing data; `PKDrawing(data:)` restores it. Assign the restored drawing to a canvas, and previous strokes remain drawing content that PencilKit can edit and erase. A preview image alone cannot provide that behavior. Persistence of drawing data does not imply persistence of the previous session's undo history. [PKDrawing](https://developer.apple.com/documentation/pencilkit/pkdrawing-swift.struct).
- PDFKit's overlay provider creates page overlays as needed and handles their page layout and rotation. Apple demonstrates PencilKit overlays, saving drawing data, and restoring it for editing in its [WWDC22 PDFKit session](https://developer.apple.com/videos/play/wwdc2022/10089/).
- Drawing policy distinguishes finger drawing from Pencil input. [Drawing policies](https://developer.apple.com/documentation/pencilkit/pkcanvasviewdrawingpolicy).

The repository targets iOS 26. The installed SDK headers mark PDF page overlays and `isInMarkupMode` as available since iOS 16, so these APIs fit the deployment target without an older-system fallback. Avoid depending on newer APIs merely because the development SDK has them.

## Approaches

| Approach | Editable after reopening? | Persistence and isolation | Assessment for Leximory |
| --- | --- | --- | --- |
| PencilKit overlays; drawings stored separately | Yes, by restoring `PKDrawing` | Per-page local data and DB records; original PDF untouched | Recommended. Native drawing tools and straightforward ownership boundaries. Leximory builds the upload queue. |
| PencilKit overlays; drawing data embedded in PDF annotations | Yes, if Leximory preserves and reloads the original PencilKit data | A personal annotated PDF copy contains drawing data and a visible appearance | Valid when a self-contained file is important. Whole-document persistence and sync are less convenient than page snapshots. |
| Standard PDF ink annotations | Yes as PDF annotations; PencilKit erasing is not automatic | Can keep annotation data separately or save a personal PDF copy | Better for interoperable PDF editing. More work for brush fidelity, touch handling, hit testing, partial erasure, and undo. |
| Quick Look with editing enabled | Must prove the required repeated-edit/erase behavior | App receives edited file contents or a copy, not a documented per-page PencilKit data interface | Smallest system preview/markup experiment, but poor integration with the current learning reader and page-level sync. |
| Commercial PDF SDK | Depends on SDK and configuration | Annotation formats and optional vendor sync services | Consider if typed notes, interoperable editing, or cross-platform collaboration become central. Adds licensing and integration dependencies. |

Apple's embedded-data example uses a PDF annotation appearance plus private drawing data. Do not flatten the canonical editable notes. Standard PDF annotations are separate from page content until flattened, so embedding is not inherently destructive. It simply couples persistence to a PDF copy. [Saving annotations and drawing data](https://developer.apple.com/videos/play/wwdc2022/10089/).

PDFKit exposes ink paths through `PDFAnnotation`, but those paths do not themselves constitute a PencilKit drawing. [Ink paths](https://developer.apple.com/documentation/pdfkit/pdfannotation/add(_:)).

Quick Look supports `createCopy` and `updateContents`, with delegate callbacks for edited files. Its public editing contract does not expose the `PKDrawing` payload needed by the proposed design. Reopening and erasing old marks would need a device experiment before accepting Quick Look for this requirement. [Editing modes](https://developer.apple.com/documentation/quicklook/qlpreviewitemeditingmode), [edited-copy callback](https://developer.apple.com/documentation/quicklook/qlpreviewcontrollerdelegate/previewcontroller(_:didsaveeditedcopyof:at:)).

[Nutrient](https://www.nutrient.io/sdk/ios/pdf-annotations/) supports native Pencil input and annotation exchange formats. Its optional [Instant offline support](https://www.nutrient.io/guides/ios/pspdfkit-instant/offline-support/) uses a local annotation database and Document Engine, rather than automatically writing to Leximory's database. Its documented same-annotation conflict policy accepts the first submission and discards later conflicting local changes. [Apryse](https://docs.apryse.com/ios/guides/features/annotation/export) supports separate XFDF annotation export. A custom Leximory DB integration would still need synchronization logic unless adopting a vendor service.

## Fit with the existing app

Repository evidence:

- `apps/leximory-ios/App/Reader/EbookScreen.swift`, `NativePDFReader`, already wraps a native `PDFView` with continuous vertical pages. Its coordinator is the natural place to connect a page overlay provider. No PDF renderer replacement is needed.
- The same coordinator adds temporary `EbookPDFHighlight` annotations from private bookmarks. Keep these separate from handwriting. The PencilKit eraser should affect handwriting only; bookmark removal keeps its existing control.
- `apps/leximory-ios/App/Reader/EbookControls.swift`, `LearningPDFView` and `EbookGestures`, owns word selection, bookmark menus, center taps, and back gestures. Drawing mode must prevent those recognizers from responding to drawing input.
- `apps/leximory-ios/Core/Sources/LeximoryCore/LocalReadingStore.swift` partitions cached content by backend/account and writes atomically. However, its finite cache evicts content, discards corrupt entries, and deletes its partition on `close()`. It is not a safe store for the only copy of unsynchronized notes.
- `apps/leximory-ios/App/NativeSync.swift` already responds to foreground entry and network recovery, but refreshes cached reads. It has no durable upload queue and pauses when inactive.
- `apps/leximory-ios/Core/Sources/LeximoryCore/MobileClient.swift` blocks network operations while offline. The reader also derives `readOnly` from connectivity. New local note editing must not inherit that network-only restriction. Other existing network-dependent actions can retain their behavior.
- `apps/leximory/server/mobile/ebooks.ts` and `ebook-store.ts` currently expose assets, reading positions, and private quote bookmarks, not drawing storage. Asset URLs include the storage object's version. Existing bookmarks contain quote/location fields; the existing `notes` table relates to papers. Neither is an established PDF drawing contract.

See also [the existing offline behavior](offline-sync.md).

## Proposed persistence and sync

### Identity and storage

Use a note key scoped to authenticated user, text ID, PDF revision, and page index. Use one documented page-index convention throughout the new API; existing reader locations are one-based.

Bind notes to an immutable PDF revision, not just a text ID or expiring signed URL. Prefer an explicit server revision derived from the existing object version; a source-byte hash is another option. Replacing a PDF at the same text ID must not attach old strokes to unrelated pages. Keep notes for the older revision rather than silently moving them. Page insertion and reordering are outside the initial scope.

Store drawings in a stable page-local coordinate space, with the canvas dimensions, display box, and coordinate-format version needed to interpret them. Do not persist viewport or screen coordinates. Validate crop boxes, nonzero origins, page rotation, and device resizing in the prototype.

Use a dedicated durable local store, outside the reading cache's directory. A small SQLite database can transactionally commit the drawing snapshot and its pending-upload state. Atomic sidecar files are also feasible if pending work is recoverable from each committed snapshot, rather than relying on an independently written queue file. SwiftData is an alternative local store; it would still need a custom Leximory sync implementation.

For the remote store, the simplest initial model is a per-page DB record with drawing bytes and revision metadata. PostgreSQL `bytea` is one candidate. Base64 in JSON is easier with some generated clients but increases payload size by roughly one third. A private object-storage blob plus a DB row is another option for large drawings, at the cost of coordinating two writes and cleaning up unused objects. Measure representative drawings before choosing limits or a storage threshold.

These are proposed models only. A dedicated database model would require separately authorized schema work. Do not retrofit binary drawings into quote bookmarks or paper notes.

### Save and upload sequence

1. Restore the local page drawing before enabling edits to it. An asynchronous load or remote refresh must not replace a drawing the user has already started editing.
2. Observe `canvasViewDrawingDidChange`. Commit changed drawing data and pending state locally, coalescing redundant work. Flush pending saves on completed gestures, leaving the page, reader dismissal, and background transitions. Do not save only when an overlay scrolls out of view. [Drawing-change delegate](https://developer.apple.com/documentation/pencilkit/pkcanvasviewdelegate).
3. Queue the latest complete snapshot of each dirty page. A local record needs the drawing, a local generation, its known server revision, a stable mutation ID, and its format/coordinate metadata. Do not upload at touch-sample frequency.
4. Upload through the authenticated API after local commit, on a short idle delay, foreground entry, and reconnect. Reuse the existing sync lifecycle, but give note uploads their own queue so a long library refresh cannot delay them indefinitely.
5. The server checks identity and current text access, enforces payload limits, and conditionally replaces the page snapshot using the known server revision. A stable mutation ID makes retries safe after a lost response. Derive the user from authentication, not the request body's claimed owner.
6. Clear pending state only after acknowledgment, and only for the exact local generation sent. A response for an older upload must not mark newer strokes as synchronized.
7. Persist an empty drawing when the user erases the last stroke. Treat that as a revisioned update, not a missing file, or old remote strokes can return.

For a simple first version, synchronize complete page snapshots. Different pages do not conflict. If two devices edit the same page from the same base revision, preserve both versions and require a deliberate resolution. Do not silently use the latest client timestamp. Combining two drawings by concatenating strokes can restore marks that one device erased. Automatic stroke-level merging is a separate, substantially larger feature.

Notes must never be evicted as downloadable cache data. If offline reopening of annotated PDFs is promised, retain the corresponding source PDF too, or define a separate content-retention policy. Notes surviving alone do not make an evicted PDF readable.

Expired authentication must preserve pending notes under the original account while uploads wait for reauthentication. Access revocation must stop uploads. The existing sign-out cleanup cannot simply delete the note store: deliberate sign-out/account deletion needs an explicit policy for unsynchronized work, with isolation from other accounts. Local write failures must preserve the in-memory drawing and require user action if saving cannot recover. Transient upload failures should retry quietly.

### What “back online” can guarantee

Guarantee upload when the app is active again with valid authentication and a reachable backend. Connectivity alone cannot make a suspended app execute. Optional background URLSession transfers or BackgroundTasks can improve delivery, but should not be required for note durability or promise immediate sync while the app is closed. [Apple's background strategies](https://developer.apple.com/documentation/backgroundtasks/choosing-background-strategies-for-your-app).

## Simple user experience

Provide a single drawing toggle in the reader. Reading mode keeps existing selection and vocabulary behavior; drawing mode shows the system palette and editable notes. Notes remain visible in both modes. No Save button, manual sync control, or connectivity banner is needed.

Set `PDFView.isInMarkupMode` deliberately. The installed SDK documents it as routing hit tests to page overlays when enabled and to PDFView text selection when disabled. It does not create a drawing toolbar by itself. [API](https://developer.apple.com/documentation/pdfkit/pdfview/isinmarkupmode).

For finger drawing on iPhone, use one finger to draw in drawing mode and establish a clear scroll/zoom gesture, such as two fingers. On compatible iPads, Pencil drawing with finger navigation is preferable. This needs an interaction prototype because PDFView and PKCanvasView both manage scrolling and gestures; setting drawing policy alone does not prove the containing PDF will navigate correctly. Disable or coordinate each page canvas's independent scrolling and Leximory's competing tap gestures.

Use one retained tool picker per reader/window and move its first-responder association to the active canvas. Avoid recreating it on every SwiftUI update or page scroll. The picker is not displayed in Mac Catalyst apps, so Catalyst needs a separate product decision if it is included in scope. [Tool picker behavior](https://developer.apple.com/documentation/pencilkit/pktoolpicker).

Store editable PencilKit data as the source of truth. Generate an annotated PDF copy only for a later export feature. Web display could use a generated preview, but editable web annotations would require a separate format/rendering strategy; do not assume a browser can edit the PencilKit archive. Set compatible content-version limits on the canvas and picker if clients with different supported ink versions must exchange drawings. [Ink compatibility](https://developer.apple.com/documentation/pencilkit/supporting-backward-compatibility-for-ink-types).

## Verification before implementation commitment

First build a local-only prototype in the existing reader. The decisive check is to draw, erase part of a stroke, save, terminate, reopen offline, and erase another part of the restored stroke. Also test zoom, continuous scroll, crop/rotation, phone/tablet layouts, word lookup after leaving drawing mode, and memory use in a long PDF. Verify that original PDF bytes remain unchanged.

Then verify the durable queue across crashes, retries after a lost acknowledgment, edits during an upload, erasing a page to empty, device conflicts, PDF replacement, account changes, expired authentication, and storage exhaustion. Confirm a second device receives the drawing as editable data. Network restoration should upload without requiring a manual refresh.

These are proposed acceptance checks. No drawing prototype or runtime persistence/sync test was performed for this research. Feasibility is supported by Apple's documented integration, SDK availability, and the repository review. Gesture behavior and production reliability remain to be demonstrated in Leximory.
