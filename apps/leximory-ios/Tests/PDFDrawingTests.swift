import Testing
import UIKit
import PDFKit
import PencilKit
import SwiftUI
@testable import LeximoryCore
@testable import Leximory

@Suite(.serialized) @MainActor struct PDFDrawingTests {
    @Test func pencilOnlyDrawingReceivesInitialHitBeforeTouchesAreAvailable() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let (model, data, _) = try fixture(root: root, text: "A quiet river runs through the valley.")
        let pdf = LearningPDFView(frame: CGRect(x: 0, y: 0, width: 400, height: 600))
        let reader = EbookReaderState()
        pdf.reader = reader
        let coordinator = PDFReaderView.Coordinator(reader: reader)
        coordinator.observe(pdf)
        let provider = PDFDrawingOverlays(model: model, pdf: pdf)
        pdf.pageOverlayViewProvider = provider
        pdf.document = PDFDocument(data: data)
        let scene = try #require(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let previous = scene.windows.first { $0.isKeyWindow }
        let window = UIWindow(windowScene: scene)
        let host = UIViewController()
        host.view = pdf; window.rootViewController = host; window.makeKeyAndVisible()
        defer {
            provider.tearDown(); window.isHidden = true; window.rootViewController = nil; previous?.makeKey()
        }
        pdf.layoutIfNeeded()
        try await Task.sleep(for: .milliseconds(100))
        let overlay = try #require(provider.overlays[0])
        await overlay.load?.value
        overlay.canvas.drawingPolicy = .pencilOnly
        await model.toggleDrawing(); provider.update()
        try await Task.sleep(for: .milliseconds(100))
        let point = overlay.convert(CGPoint(x: 100, y: 100), to: pdf)
        let hit = try #require(pdf.hitTest(point, with: nil))
        #expect(hit.isDescendant(of: overlay.canvas), "Initial hit testing must reach PencilKit before UIEvent has populated allTouches.")
        #expect(pdf.isInMarkupMode)
        #expect(overlay.canvas.isDrawingEnabled)
        #expect(model.drawing)
        let initialEvent = UIEvent()
        #expect(initialEvent.allTouches?.isEmpty != false)
        #expect(try #require(pdf.hitTest(point, with: initialEvent)).isDescendant(of: overlay.canvas))
        overlay.canvas.drawing = drawing()
        provider.canvasViewDrawingDidChange(overlay.canvas)
        let strokes = overlay.canvas.drawing.dataRepresentation()
        let page = try #require(pdf.document?.page(at: 0))
        pdf.setCurrentSelection(page.selection(for: NSRange(location: 2, length: 5)), animate: false)
        #expect(reader.selection?.quote == "quiet")
        #expect(reader.selection?.location == "1")
        provider.update()
        try await Task.sleep(for: .milliseconds(100))
        #expect(reader.selection?.quote == "quiet")
        provider.canvasViewDidBeginUsingTool(overlay.canvas)
        #expect(pdf.currentSelection == nil)
        #expect(reader.selection == nil)
        #expect(model.drawing)
        #expect(overlay.canvas.isFirstResponder)
        overlay.canvas.drawingPolicy = .anyInput
        provider.update()
        try await Task.sleep(for: .milliseconds(100))
        #expect(pdf.isInMarkupMode)
        #expect(try #require(pdf.hitTest(point, with: initialEvent)).isDescendant(of: overlay.canvas))
        overlay.canvas.drawingPolicy = .pencilOnly
        provider.update()
        try await Task.sleep(for: .milliseconds(100))
        #expect(pdf.isInMarkupMode)
        #expect(overlay.canvas.drawing.dataRepresentation() == strokes)
        await model.toggleDrawing(); provider.update()
        try await Task.sleep(for: .milliseconds(100))
        #expect(try #require(pdf.hitTest(point, with: initialEvent)).isDescendant(of: overlay) == false)
    }

    @Test(arguments: [false, true])
    func coloredMarkersKeepTheirHueWhenAppearanceChanges(initialDark: Bool) async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let (model, data, _) = try fixture(root: root)
        let scene = try #require(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let previous = scene.windows.first { $0.isKeyWindow }
        let window = UIWindow(windowScene: scene)
        let host = UIHostingController(rootView: DrawingReader(data: data, model: model))
        host.overrideUserInterfaceStyle = initialDark ? .dark : .light
        window.rootViewController = host
        window.makeKeyAndVisible()
        defer { window.isHidden = true; window.rootViewController = nil; previous?.makeKey() }
        host.view.layoutIfNeeded()
        try await Task.sleep(for: .milliseconds(250))
        let pdf = try #require(pdfView(in: host.view))
        let provider = try #require(pdf.pageOverlayViewProvider as? PDFDrawingOverlays)
        let overlay = try #require(provider.overlays[0])
        await overlay.load?.value
        let colors: [UIColor] = [.yellow, .red, .green, .blue, .black]
        overlay.canvas.drawing = PKDrawing(strokes: colors.enumerated().map { index, color in
            let points = (0..<4).map { point in
                PKStrokePoint(location: CGPoint(x: 100 + point * 20, y: 160 + index * 60),
                    timeOffset: Double(point) * 0.01, size: CGSize(width: 24, height: 24),
                    opacity: 1, force: 1, azimuth: 0, altitude: .pi / 2)
            }
            return PKStroke(ink: PKInk(index == 4 ? .pen : .marker, color: color),
                path: PKStrokePath(controlPoints: points, creationDate: .now))
        })
        let original = overlay.canvas.drawing.dataRepresentation()
        func markerSamples() throws -> [[Int]] {
            let format = UIGraphicsImageRendererFormat(); format.scale = 1
            let image = try #require(UIGraphicsImageRenderer(bounds: host.view.bounds, format: format).image { _ in
                host.view.drawHierarchy(in: host.view.bounds, afterScreenUpdates: true)
            }.cgImage)
            return try colors.indices.map { index in
                let point = overlay.canvas.convert(CGPoint(x: 130 * overlay.canvas.zoomScale,
                    y: CGFloat(160 + index * 60) * overlay.canvas.zoomScale), to: host.view)
                var bytes = [UInt8](repeating: 0, count: 4)
                try bytes.withUnsafeMutableBytes { storage in
                    let context = try #require(CGContext(data: storage.baseAddress, width: 1, height: 1,
                        bitsPerComponent: 8, bytesPerRow: 4, space: CGColorSpaceCreateDeviceRGB(),
                        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue))
                    context.draw(image, in: CGRect(x: -Int(point.x), y: -(image.height - Int(point.y) - 1),
                        width: image.width, height: image.height))
                }
                return bytes.map(Int.init)
            }
        }
        for dark in [initialDark, !initialDark, initialDark] {
            host.overrideUserInterfaceStyle = dark ? .dark : .light
            try await Task.sleep(for: .milliseconds(250))
            var samples = try markerSamples()
            for _ in 0..<10 where abs(samples[0][0] - samples[0][2]) < 20 {
                try await Task.sleep(for: .milliseconds(100))
                samples = try markerSamples()
            }
            #expect(samples[0][0] > samples[0][2] + 20 && samples[0][1] > samples[0][2] + 20, "Yellow marker, dark \(dark): \(samples[0])")
            #expect(samples[1][0] > samples[1][1] + 20 && samples[1][0] > samples[1][2] + 20, "Red marker, dark \(dark): \(samples[1])")
            #expect(samples[2][1] > samples[2][0] + 20 && samples[2][1] > samples[2][2] + 20, "Green marker, dark \(dark): \(samples[2])")
            #expect(samples[3][2] > samples[3][0] + 20 && samples[3][2] > samples[3][1] + 20, "Blue marker, dark \(dark): \(samples[3])")
            #expect(samples[4].prefix(3).allSatisfy { dark ? $0 > 240 : $0 < 15 }, "Pen contrast, dark \(dark): \(samples[4])")
            #expect(overlay.canvas.drawing.dataRepresentation() == original)
        }
    }

    @Test func toolPickerRestoresBrushCustomInkColorAndWidth() async throws {
        let name = "leximory.pdf.tools.test.\(UUID().uuidString)"
        let scene = try #require(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let previous = scene.windows.first { $0.isKeyWindow }
        let window = UIWindow(windowScene: scene)
        let host = UIViewController()
        let canvas = PKCanvasView(frame: CGRect(x: 0, y: 0, width: 400, height: 600))
        host.view = canvas
        window.rootViewController = host
        window.makeKeyAndVisible()
        defer {
            window.isHidden = true; window.rootViewController = nil; previous?.makeKey()
            for key in UserDefaults.standard.dictionaryRepresentation().keys where key.contains(name) {
                UserDefaults.standard.removeObject(forKey: key)
            }
        }
        let customColor = UIColor(red: 0.23, green: 0.47, blue: 0.71, alpha: 1)
        func makePicker() -> PKToolPicker {
            let picker = PKToolPicker(toolItems: PKToolPicker.defaultToolItems.map { item in
                guard let ink = item as? PKToolPickerInkingItem, ink.inkingTool.inkType == .marker else { return item }
                return PKToolPickerInkingItem(type: .marker, color: customColor, width: 18, identifier: item.identifier)
            })
            picker.maximumSupportedContentVersion = .version4
            picker.colorUserInterfaceStyle = .light
            picker.stateAutosaveName = name
            return picker
        }
        var picker: PKToolPicker? = makePicker()
        picker?.addObserver(canvas)
        picker?.setVisible(true, forFirstResponder: canvas)
        canvas.becomeFirstResponder()
        try await Task.sleep(for: .milliseconds(200))
        let marker = try #require(picker?.toolItems.first { ($0 as? PKToolPickerInkingItem)?.inkingTool.inkType == .marker })
        picker?.selectedToolItemIdentifier = marker.identifier
        try await Task.sleep(for: .milliseconds(200))
        picker?.setVisible(false, forFirstResponder: canvas)
        canvas.resignFirstResponder()
        picker?.removeObserver(canvas)
        picker = nil
        let reopened = PDFDrawingOverlays.makeToolPicker(autosaveName: name)
        reopened.addObserver(canvas)
        reopened.setVisible(true, forFirstResponder: canvas)
        canvas.becomeFirstResponder()
        try await Task.sleep(for: .milliseconds(200))
        #expect(reopened.selectedToolItemIdentifier == marker.identifier)
        #expect((canvas.tool as? PKInkingTool)?.inkType == .marker)
        #expect((canvas.tool as? PKInkingTool)?.color == customColor)
        #expect(abs(try #require(canvas.tool as? PKInkingTool).width - 18) < 0.001)
        reopened.setVisible(false, forFirstResponder: canvas)
        canvas.resignFirstResponder()
        reopened.removeObserver(canvas)
    }

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
    private func fixture(root: URL, text: String? = nil) throws -> (PDFNotesModel, Data, PDFNotesStore) {
        let origin = URL(string: "https://notes.example")!
        let store = try PDFNotesStore(root: root, origin: origin, accountID: "test")
        let data = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: 400, height: 600)).pdfData {
            $0.beginPage()
            if let text { (text as NSString).draw(at: CGPoint(x: 40, y: 80), withAttributes: [.font: UIFont.systemFont(ofSize: 16)]) }
        }
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
