# Ebook pre-annotation

The ebook-only More action opens one switch, off by default. Enabling it prepares the current page and its immediate neighbors. EPUB neighbors use the existing hidden pagination renderer; extraction clips to visible graphemes. PDF uses physical page text. The authenticated API saves every completed annotation before emitting it, and cached passages and interrupted-request retries reuse their quota receipt. Usage is proportional to source characters at 0.25 commentary units per thousand characters.

The `ebook_preannotations` table was applied separately by the project owner. Its generated types are in `packages/supabase/src/types.ts`. The API keeps the source file immutable and stores private, versioned passage records. Vocabulary saves resolve the stored annotation rather than trusting a supplied definition or an expiring lookup receipt.

Rendering premise checked: absolutely positioned strokes inside the publisher document are not reliable in fragmented horizontal and vertical layouts. `EbookPreannotationTests.epubUnderlinesPreserveRubySourceAndPosition` measures actual painted pixels for both writing modes and short/nested versus long paragraphs. Strokes therefore belong in the outer reader viewport, with source range rectangles converted through the iframe. Source text, ruby and CFIs remain untouched.

Verification uses fake service transports and database HTTP responses through the installed SDK. Run the mobile checks and `EbookPreannotationTests`; no live account writes are required. Textless scans need an OCR extraction path before they can receive word annotations.
