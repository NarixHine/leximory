import Testing
import UIKit
import PDFKit
import PencilKit
import SwiftUI
@testable import LeximoryCore
@testable import Leximory

@Suite(.serialized) @MainActor struct PDFDrawingTests {
    @Test(arguments: [CGFloat(0.5), 1, 2, 4])
    func canvasRendersAtDisplayScaleWithoutChangingStrokeCoordinates(scale: CGFloat) throws {
        let pageSize = CGSize(width: 400, height: 600)
        let scene = try #require(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let previous = scene.windows.first { $0.isKeyWindow }
        let window = UIWindow(windowScene: scene)
        let host = UIViewController()
        window.rootViewController = host
        window.makeKeyAndVisible()
        defer { window.isHidden = true; window.rootViewController = nil; previous?.makeKey() }
        let parent = UIView(frame: CGRect(origin: .zero, size: pageSize))
        host.view.addSubview(parent)
        parent.transform = CGAffineTransform(scaleX: scale, y: scale)
        let overlay = PDFDrawingOverlay(pageIndex: 0, size: pageSize)
        parent.addSubview(overlay)
        overlay.canvas.drawing = drawing()
        let before = overlay.canvas.drawing.dataRepresentation()
        for resize in [CGFloat(1), 1.5] {
            overlay.bounds.size = CGSize(width: pageSize.width * resize, height: pageSize.height * resize)
            overlay.setNeedsLayout()
            overlay.layoutIfNeeded()
            let zoom = scale * resize
            #expect(abs(overlay.canvas.zoomScale - zoom) < 0.001)
            #expect(overlay.canvas.minimumZoomScale == overlay.canvas.maximumZoomScale)
            #expect(overlay.canvas.panGestureRecognizer.isEnabled == false)
            #expect(overlay.canvas.pinchGestureRecognizer?.isEnabled != true)
            #expect(abs(displayScale(of: overlay.canvas) - 1) < 0.001)
            #expect(overlay.canvas.bounds.size == CGSize(width: pageSize.width * zoom, height: pageSize.height * zoom))
            #expect(overlay.canvas.drawing.dataRepresentation() == before)
        }
    }

    @Test func drawingModeDoesNotRepeatedlyReconfigurePDFKit() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let (model, data, store) = try fixture(root: root)
        let pdf = MarkupCountingPDFView(frame: CGRect(x: 0, y: 0, width: 400, height: 600))
        let provider = PDFDrawingOverlays(model: model, pdf: pdf)
        pdf.pageOverlayViewProvider = provider
        pdf.document = PDFDocument(data: data)
        let scene = try #require(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let previous = scene.windows.first { $0.isKeyWindow }
        let window = UIWindow(windowScene: scene)
        let host = UIViewController()
        host.view = pdf
        window.rootViewController = host
        window.makeKeyAndVisible()
        defer {
            provider.tearDown()
            window.isHidden = true
            window.rootViewController = nil
            previous?.makeKey()
        }
        pdf.layoutIfNeeded()
        try await Task.sleep(for: .milliseconds(100))
        for overlay in provider.overlays.values { await overlay.load?.value }
        let page = try #require(pdf.currentPage)
        let document = try #require(pdf.document)
        let overlay = try #require(provider.overlays[document.index(for: page)])
        provider.update()
        let initialAssignments = pdf.markupAssignments
        await model.toggleDrawing()
        #expect(model.drawing)
        provider.update()
        #expect(!overlay.canvas.isFirstResponder)
        for _ in 0..<10 {
            provider.pdfView(pdf, willDisplayOverlayView: overlay, for: page)
            provider.update()
        }
        try await Task.sleep(for: .milliseconds(100))
        #expect(pdf.isInMarkupMode)
        #expect(pdf.markupAssignments - initialAssignments == 1)
        #expect(overlay.loaded)
        #expect(overlay.canvas.isDrawingEnabled)
        #expect(overlay.canvas.isFirstResponder)
        overlay.canvas.drawing = drawing()
        provider.canvasViewDrawingDidChange(overlay.canvas)
        pdf.drawingCanvas = overlay.canvas
        await model.toggleDrawing()
        provider.update()
        try await Task.sleep(for: .milliseconds(100))
        #expect(!pdf.isInMarkupMode)
        #expect(!overlay.canvas.isFirstResponder)
        #expect(!pdf.restoredReadingModeWithActiveCanvas)
        #expect(pdf.markupAssignments - initialAssignments == 2)
        await model.flush()?.value
        let key = PDFNoteKey(document: model.document, pageIndex: overlay.pageIndex)
        let saved = try #require(await store.record(for: key))
        #expect(try PKDrawing(data: saved.note.drawing).strokes.count == 1)
        await model.toggleDrawing()
        provider.update()
        await model.toggleDrawing()
        provider.update()
        try await Task.sleep(for: .milliseconds(100))
        #expect(!overlay.canvas.isFirstResponder)
        #expect(!overlay.canvas.isDrawingEnabled)
    }

    @Test func finishingPopulatedDrawingSavesAndReopensThroughSwiftUI() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let (model, data, store) = try fixture(root: root)
        let scene = try #require(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let previous = scene.windows.first { $0.isKeyWindow }
        let window = UIWindow(windowScene: scene)
        let host = UIHostingController(rootView: DrawingReader(data: data, model: model))
        window.rootViewController = host
        window.makeKeyAndVisible()
        defer { window.isHidden = true; window.rootViewController = nil; previous?.makeKey() }
        host.view.layoutIfNeeded()
        try await Task.sleep(for: .milliseconds(200))
        let pdf = try #require(pdfView(in: host.view))
        let provider = try #require(pdf.pageOverlayViewProvider as? PDFDrawingOverlays)
        await model.toggleDrawing()
        try await Task.sleep(for: .milliseconds(200))
        let overlay = try #require(provider.overlays[0])
        #expect(overlay.canvas.isFirstResponder)
        overlay.canvas.drawing = drawing()
        provider.canvasViewDrawingDidChange(overlay.canvas)
        await model.toggleDrawing()
        await model.flush()?.value
        try await Task.sleep(for: .milliseconds(200))
        #expect(!pdf.isInMarkupMode)
        #expect(!overlay.canvas.isFirstResponder)
        #expect(!model.localError)
        let key = PDFNoteKey(document: model.document, pageIndex: 0)
        #expect(try PKDrawing(data: #require(await store.record(for: key)).note.drawing).strokes.count == 1)
        await model.toggleDrawing()
        try await Task.sleep(for: .milliseconds(200))
        let reopened = try #require(provider.overlays[0])
        #expect(reopened.canvas.isFirstResponder)
        #expect(reopened.canvas.drawing.strokes.count == 1)
        #expect(reopened.canvas.panGestureRecognizer.isEnabled == false)
        #expect(reopened.canvas.pinchGestureRecognizer?.isEnabled != true)
        let originalStrokeBounds = reopened.canvas.drawing.bounds
        pdf.scaleFactor *= 2
        try await Task.sleep(for: .milliseconds(200))
        #expect(abs(displayScale(of: reopened.canvas) - 1) < 0.001)
        #expect(reopened.canvas.drawing.bounds == originalStrokeBounds)
        let page = try #require(pdf.currentPage)
        func strokePosition() -> CGPoint {
            reopened.canvas.convert(CGPoint(x: 40 * reopened.canvas.zoomScale, y: 80 * reopened.canvas.zoomScale), to: pdf)
        }
        func pagePosition() -> CGPoint { pdf.convert(CGPoint(x: 40, y: 520), from: page) }
        #expect(abs(strokePosition().x - pagePosition().x) < 1)
        #expect(abs(strokePosition().y - pagePosition().y) < 1)
        var parent = pdf.documentView?.superview
        while let view = parent, !(view is UIScrollView) { parent = view.superview }
        let navigation = try #require(parent as? UIScrollView)
        #expect(navigation.panGestureRecognizer.isEnabled)
        #expect(navigation.pinchGestureRecognizer?.isEnabled == true)
        let beforePan = pagePosition()
        navigation.contentOffset.y += 40
        pdf.layoutIfNeeded()
        #expect(abs(pagePosition().y - beforePan.y + 40) < 1)
        #expect(abs(strokePosition().x - pagePosition().x) < 1)
        #expect(abs(strokePosition().y - pagePosition().y) < 1)
        #expect(reopened.canvas.drawing.bounds == originalStrokeBounds)
        reopened.canvas.drawing = PKDrawing()
        provider.canvasViewDrawingDidChange(reopened.canvas)
        await model.toggleDrawing()
        await model.flush()?.value
        try await Task.sleep(for: .milliseconds(200))
        #expect(!pdf.isInMarkupMode)
        #expect(try PKDrawing(data: #require(await store.record(for: key)).note.drawing).strokes.isEmpty)
    }

    private func drawing() -> PKDrawing {
        let points = (0..<4).map { index in
            PKStrokePoint(location: CGPoint(x: 40 + index * 20, y: 80), timeOffset: Double(index) * 0.01,
                size: CGSize(width: 3, height: 3), opacity: 1, force: 1, azimuth: 0, altitude: .pi / 2)
        }
        return PKDrawing(strokes: [PKStroke(ink: PKInk(.pen, color: .black),
            path: PKStrokePath(controlPoints: points, creationDate: Date()))])
    }
    private func displayScale(of view: UIView) -> CGFloat {
        let start = view.convert(CGPoint.zero, to: view.window)
        let end = view.convert(CGPoint(x: 1, y: 0), to: view.window)
        return hypot(end.x - start.x, end.y - start.y)
    }
    private func pdfView(in view: UIView) -> PDFView? {
        if let pdf = view as? PDFView { return pdf }
        return view.subviews.lazy.compactMap { pdfView(in: $0) }.first
    }
    private func fixture(root: URL) throws -> (PDFNotesModel, Data, PDFNotesStore) {
        let origin = URL(string: "https://notes.example")!
        let store = try PDFNotesStore(root: root, origin: origin, accountID: "test")
        let data = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: 400, height: 600)).pdfData { $0.beginPage() }
        let text = CatalogText(id: "book", libraryId: "folder", title: "Book", topics: [], emoji: nil, createdAt: nil, format: "ebook")
        let library = CatalogLibrary(id: "folder", name: "Books", language: "en", owned: true, archived: false, shadow: false)
        let descriptor = EbookDescriptor(text: text, library: library, url: origin.appending(path: "file.pdf"), format: "pdf",
            expiresAt: .distantFuture, location: nil, bookmarks: [], sourceVersion: "original")
        let model = PDFNotesModel(book: LocalEbook(descriptor: descriptor, data: data, location: nil), store: store, sync: nil)
        return (model, data, store)
    }
}

@MainActor private struct DrawingReader: View {
    let data: Data
    let model: PDFNotesModel
    @State private var reader = EbookReaderState()
    var body: some View {
        NativePDFReader(data: data, reader: reader, command: nil, notes: model,
            notesRevision: model.revision, drawingEnabled: model.drawing)
            .task { await model.run() }
    }
}

@MainActor private final class MarkupCountingPDFView: PDFView {
    var markupAssignments = 0
    weak var drawingCanvas: PKCanvasView?
    var restoredReadingModeWithActiveCanvas = false
    override var isInMarkupMode: Bool {
        get { super.isInMarkupMode }
        set {
            markupAssignments += 1
            if !newValue, drawingCanvas?.isFirstResponder == true { restoredReadingModeWithActiveCanvas = true }
            // Stop an accidental recursive setter from hanging the test host.
            guard markupAssignments < 30 else { return }
            super.isInMarkupMode = newValue
        }
    }
}
