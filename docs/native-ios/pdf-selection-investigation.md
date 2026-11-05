# Saved PDF selection investigation

Reported on iPhone 17 Pro Max, iOS 27.0.1. The reported iPad works. This investigation concerns the saved ebook reader.

## What the previous checks missed

The catalog's `--ebook-fixtures` path has no `MobileClient`, so it never creates `PDFNotesModel` or installs PencilKit page overlays. Its PDF selection checks cannot detect an overlay intercepting touches in an account-backed book.

The workspace test does install the notes provider, but previously opened Contents and jumped to page two before pressing a short fixture sentence. It asserted that the learning menu appeared. It did not verify first-open selection, native handles, copied text, range adjustment, or a real finger stroke before returning to reading.

## Observed touch routing

Before the explicit touch-routing fix, an LLDB breakpoint at `EbookGestures.gestureRecognizer(_:shouldReceive:)` inspected the actual `UITouch.view` during a simulator HID long-press on iOS 27.0. No selection was assigned programmatically.

| Reading state | Overlay interaction | Actual touch recipient | Result |
| --- | --- | --- | --- |
| PDF markup off, canvas drawing off | Enabled | A `UIView` inside `PKCanvasView` | No native PDF selection or handles |
| PDF markup off, canvas drawing off | Disabled | `PDFDocumentView` | Native selection, both handles, and learning menu |

Switching only the overlay's interaction flag reversed the result repeatedly on iPhone. Enabling the overlay also broke selection on an iPad running the same simulator OS. This is not evidence of an iPhone-only branch in the app.

`PKCanvasView.isDrawingEnabled = false` leaves its view hierarchy interactive. Preventing new strokes does not make its views pass finger touches through to PDFKit's text interaction.

## Why the OS distinction matters

The machine has cached device frameworks from the reported iPhone's exact iOS 27.0.1 build, 24A446. Read-only inspection compared their hit-testing methods with the cached iPhone iOS 26.6.2 and iPadOS 26.6.1 frameworks.

- In the iOS 26.6 frameworks, `PDFDocumentView.hitTest:withEvent:` and `PDFPageView.hitTest:withEvent:` explicitly check `isInMarkupMode` or form detection before the extra subview-routing path.
- In the iOS 27.0.1 framework, those markup/form checks are absent from these methods. `PDFPageView` uses superclass hit testing and returns a descendant hit, or nil if the page view itself was hit.
- The same older checks exist in the cached iPhone 26.6.2 framework. The difference is between framework versions, not proof of a hardware-idiom condition.

The live simulator result agrees with this change: restoring PDFKit's reading mode alone does not prevent an interactive PencilKit overlay from receiving touches.

The earlier fix already present in the working tree makes the page overlay noninteractive at construction and enables it only when drawing is active and its note has loaded. That relies on the drawing hierarchy remaining passive.

## Behavioral fix

`LearningPDFView.hitTest(_:with:)` now enforces the reading input target. If normal hit testing lands in one of this reader's drawing overlays while the notes model is in reading mode, the result is `PDFView.documentView`. The native PDF document therefore receives the finger touch, including its text-selection recognizers and its parent scroll view's pan gesture.

This redirects only hits inside the app's drawing hierarchy. Native selection handles and other PDFKit controls retain their normal hit targets. While handwriting is active, the original PencilKit hit target is preserved. The change does not synthesize selections, replace native handles, or alter text-selection menus.

The old provider also removed an offscreen overlay from its tracking dictionary without disabling the overlay or canvas. Later reading-mode updates iterate only that dictionary. A retained view could therefore keep receiving touches after it was no longer tracked. The provider now disables input when a page leaves display, and the touch router examines actual view ancestry rather than dictionary membership. Tool-picker and first-responder changes retain their existing deferred presentation path outside PDFKit layout callbacks.

The simulator-only `LEXIMORY_FIXTURE_PDF_ACTIVE_CANVAS` fixture keeps the drawing hierarchy interactive during reading, including immediately before each hit test. This deliberately defeats the earlier passive-overlay fix. Without the new PDF-view routing, the UI regression produces no selection handles. With routing restored, the same finger press creates native handles and copies the selected word. The test also exercises finger scrolling to page two.

The native regression also enters drawing, delivers the page-overlay end-display callback while retaining the UIKit view, and returns to reading. Before the lifecycle fix, the departing canvas remained enabled and first responder, and a canvas no longer in the dictionary was not redirected. The corrected path disables the departing input and routes retained drawing descendants to the PDF document.

## Verification

The focused native regression checks actual overlay hit testing before handwriting, during handwriting, and after finishing. The reading states must return no hit; the drawing state must accept input.

Saved-PDF UI coverage now checks first-open selection without Contents navigation, both native handles, and the copied word pasted through the app's own address field. The print-scale case supplies a 612 × 792 PDF with 12-point prose, holds with slight movement, adjusts the trailing selection handle, copies the expanded range, draws a real finger stroke, and selects again after finishing handwriting. The supplied PDF is available only through the simulator fixture environment, `LEXIMORY_FIXTURE_PDF`.

The available runtime is iOS 27.0, build 24A434. Simulators include an isolated iPhone 17 Pro Max matching the reported hardware and an iPad. Framework inspection is evidence about 27.0.1's implementation, not a live execution of that OS. The physical iPhone and iPad were unavailable to device tooling. No physical-device installation or account/database mutation was performed.

Results on 2026-11-01:

| Check | Result |
| --- | --- |
| Native drawing suite with the overlay interaction fix temporarily removed | 4 passed, 1 failed; reading-mode hit testing returned a PencilKit child |
| Native drawing suite with the overlay interaction fix restored | All 5 tests passed, including ink appearance, zoom coordinates, persistence, and input-mode transitions |
| iPhone 17 Pro Max, first-open selection and copied word | Passed |
| iPhone 17 Pro Max, 12-point prose, slight movement, range expansion, copy/paste, and actual finger drawing | Passed |
| iPhone 17 Pro Max, selection before/after handwriting toggle and page navigation | Passed |
| iPad, native suite plus all three saved-PDF UI cases | 8 passed, 0 failed |

The subsequent behavioral fix was verified separately:

| New regression | Before the new fix | After the new fix |
| --- | --- | --- |
| Drawing hierarchy kept interactive during reading, despite the passive-overlay flags | No native selection handles; UI case failed | Native handles, correct copied word, and finger scrolling passed on iPhone 17 Pro Max and iPad |
| Drawing page leaves display while the UIKit overlay is retained, then reading resumes | Input remained enabled and the untracked canvas was not redirected; native suite had 1 failure | Departing input disabled, retained descendants redirected; final native suite passed all 5 tests on both simulators |

Normal first-open selection, 12-point text, range expansion, copying, actual finger drawing, and selection after drawing also passed on both simulator types with the new routing. Final whitespace checks passed. The implementation changes are in `EbookControls.swift` and `PDFDrawingOverlays.swift`; simulator fault injection remains inside the debug-only `BrowserWorkspacePreview`.

The read-only probe was exercised against the iPhone 17 Pro Max simulator. It captured a direct finger touch reaching `PDFDocumentView`, native handles appeared, and the state command reported a six-character native selection. All three simulators were returned to normal account mode and checked for remaining workspace fixture data.

Physical confirmation on the affected installed build remains necessary before claiming that the user's exact failure is resolved. In particular, a simulator pass cannot establish which overlay state or app build was present during the reported failure.

## Capture the affected installed reader

With matching debug symbols, attach Xcode's debugger to the installed app and open the affected saved PDF. First reproduce without breakpoints, interrupt execution, and inspect the state. Import the [read-only LLDB probe](probes/pdf_input.py), then run:

```text
command script import /absolute/path/to/docs/native-ios/probes/pdf_input.py
pdf-input-state
pdf-input-trace
continue
```

Use the finger operation that fails for a second capture with tracing enabled. The state command reports OS, markup mode, overlay interaction, canvas drawing state, and native selection length. The trace reports the actual touch recipient and three ancestor classes. Neither command records document text or changes view interaction, account data, or PDF data. Delete the reported breakpoint after capture. A breakpoint changes timing, so judge selection success from the attempt without tracing and use the traced attempt to identify touch routing.
