import UIKit
import PDFKit
import PencilKit
import LeximoryCore

@MainActor final class PDFDrawingOverlay: UIView {
    let canvas = PKCanvasView()
    let pageIndex: Int
    let pageSize: CGSize
    var loaded = false
    var applying = false
    var appliedData: Data?
    var revision: UUID?
    var load: Task<Void, Never>?
    var updateInput: (() -> Void)?
    init(pageIndex: Int, size: CGSize) {
        self.pageIndex = pageIndex; pageSize = size
        super.init(frame: CGRect(origin: .zero, size: size))
        backgroundColor = .clear; isOpaque = false
        canvas.backgroundColor = .clear; canvas.isOpaque = false
        canvas.overrideUserInterfaceStyle = .light
        canvas.isScrollEnabled = false; canvas.bounces = false
        canvas.maximumSupportedContentVersion = .version4
        canvas.drawingPolicy = .default
        canvas.contentSize = size
        canvas.accessibilityIdentifier = "pdf-drawing-page-\(pageIndex)"
        addSubview(canvas)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    override func layoutSubviews() {
        super.layoutSubviews()
        canvas.bounds = CGRect(origin: .zero, size: pageSize)
        canvas.center = CGPoint(x: bounds.midX, y: bounds.midY)
        canvas.transform = CGAffineTransform(scaleX: bounds.width / max(1, pageSize.width), y: bounds.height / max(1, pageSize.height))
    }
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        updateInput?()
        return super.hitTest(point, with: event)
    }
}

@MainActor final class PDFDrawingOverlays: NSObject, @MainActor PDFPageOverlayViewProvider, PKCanvasViewDelegate, PKToolPickerObserver {
    static var supportsDrawing: Bool {
        #if targetEnvironment(macCatalyst)
        false
        #else
        true
        #endif
    }
    private(set) var overlays: [Int: PDFDrawingOverlay] = [:]
    private weak var pdf: PDFView?
    private let model: PDFNotesModel
    private let picker = PKToolPicker()
    private weak var activeCanvas: PKCanvasView?
    private weak var navigationPan: UIPanGestureRecognizer?
    private var originalMinimum = 1
    private var originalTouchTypes: [NSNumber] = []
    init(model: PDFNotesModel, pdf: PDFView) {
        self.model = model; self.pdf = pdf
        super.init()
        picker.maximumSupportedContentVersion = .version4
        picker.colorUserInterfaceStyle = .light
        picker.stateAutosaveName = "leximory.pdf.tools"
        picker.addObserver(self)
    }
    func pdfView(_ view: PDFView, overlayViewFor page: PDFPage) -> UIView? {
        guard let document = view.document else { return nil }
        let index = document.index(for: page)
        if let overlay = overlays[index] { return overlay }
        let size = page.bounds(for: view.displayBox).size
        guard size.width > 0, size.height > 0 else { return nil }
        let overlay = PDFDrawingOverlay(pageIndex: index, size: size)
        overlay.canvas.delegate = self
        overlay.updateInput = { [weak self] in self?.configureNavigation() }
        picker.addObserver(overlay.canvas)
        overlays[index] = overlay
        load(overlay)
        return overlay
    }
    func pdfView(_ pdfView: PDFView, willDisplayOverlayView overlayView: UIView, for page: PDFPage) {
        update()
    }
    func pdfView(_ pdfView: PDFView, willEndDisplayingOverlayView overlayView: UIView, for page: PDFPage) {
        guard let overlay = overlayView as? PDFDrawingOverlay else { return }
        capture(overlay); model.flush()
        if activeCanvas === overlay.canvas { hidePicker() }
        overlay.load?.cancel(); picker.removeObserver(overlay.canvas)
        overlays[overlay.pageIndex] = nil
    }
    private func load(_ overlay: PDFDrawingOverlay) {
        guard overlay.load == nil, !model.loadError else { return }
        overlay.load = Task { [weak self, weak overlay] in
            guard let self, let overlay else { return }
            defer { overlay.load = nil }
            let baseline = overlay.revision
            do {
                let note = try await model.page(overlay.pageIndex)
                guard !Task.isCancelled, overlays[overlay.pageIndex] === overlay, overlay.revision == baseline else { return }
                if overlay.canvas.isDrawingEnabled && [.began, .changed].contains(overlay.canvas.drawingGestureRecognizer.state) { return }
                if note?.revision != overlay.revision || !overlay.loaded {
                    var drawing = try note.map { try PKDrawing(data: $0.drawing) } ?? PKDrawing()
                    if let note {
                        drawing.transform(using: CGAffineTransform(scaleX: overlay.pageSize.width / note.canvasWidth, y: overlay.pageSize.height / note.canvasHeight))
                    }
                    overlay.applying = true
                    overlay.canvas.drawing = drawing
                    overlay.appliedData = overlay.canvas.drawing.dataRepresentation(); overlay.revision = note?.revision
                    overlay.loaded = true; overlay.applying = false
                }
                overlay.canvas.isDrawingEnabled = overlay.loaded && model.drawing
                activateCurrentPage()
            } catch { if !Task.isCancelled { model.failedToLoad() } }
        }
    }
    func update() {
        pdf?.isInMarkupMode = model.drawing
        for overlay in overlays.values {
            overlay.canvas.isDrawingEnabled = model.drawing && overlay.loaded
            load(overlay)
        }
        configureNavigation()
        if model.drawing { activateCurrentPage() } else { hidePicker(); model.flush() }
    }
    func activateCurrentPage() {
        if let activeCanvas, [.began, .changed].contains(activeCanvas.drawingGestureRecognizer.state) { return }
        guard model.drawing, let pdf, let page = pdf.currentPage, let document = pdf.document,
              let overlay = overlays[document.index(for: page)], overlay.loaded else { return }
        activate(overlay.canvas)
    }
    private func activate(_ canvas: PKCanvasView) {
        guard canvas.window != nil else { return }
        if activeCanvas !== canvas {
            hidePicker(); activeCanvas = canvas
            picker.setVisible(true, forFirstResponder: canvas)
        }
        if !canvas.isFirstResponder { canvas.becomeFirstResponder() }
    }
    private func hidePicker() {
        guard let canvas = activeCanvas else { return }
        picker.setVisible(false, forFirstResponder: canvas)
        canvas.resignFirstResponder(); activeCanvas = nil
    }
    private func configureNavigation() {
        if navigationPan == nil {
            var parent = pdf?.documentView?.superview
            while let view = parent {
                if let scroll = view as? UIScrollView {
                    navigationPan = scroll.panGestureRecognizer
                    originalMinimum = scroll.panGestureRecognizer.minimumNumberOfTouches
                    originalTouchTypes = scroll.panGestureRecognizer.allowedTouchTypes
                    break
                }
                parent = view.superview
            }
        }
        if model.drawing {
            let pencilOnly = UIDevice.current.userInterfaceIdiom == .pad && UIPencilInteraction.prefersPencilOnlyDrawing
            navigationPan?.minimumNumberOfTouches = pencilOnly ? 1 : 2
            navigationPan?.allowedTouchTypes = [NSNumber(value: UITouch.TouchType.direct.rawValue), NSNumber(value: UITouch.TouchType.indirectPointer.rawValue)]
        } else {
            navigationPan?.minimumNumberOfTouches = originalMinimum
            navigationPan?.allowedTouchTypes = originalTouchTypes
        }
    }
    func toolPickerSelectedToolItemDidChange(_ toolPicker: PKToolPicker) { configureNavigation() }
    func canvasViewDidBeginUsingTool(_ canvasView: PKCanvasView) { if model.drawing { activate(canvasView) } }
    func canvasViewDidEndUsingTool(_ canvasView: PKCanvasView) {
        if let overlay = overlays.values.first(where: { $0.canvas === canvasView }) { capture(overlay) }
        model.flush()
    }
    func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
        guard let overlay = overlays.values.first(where: { $0.canvas === canvasView }) else { return }
        capture(overlay)
    }
    private func capture(_ overlay: PDFDrawingOverlay) {
        guard overlay.loaded, !overlay.applying else { return }
        let data = overlay.canvas.drawing.dataRepresentation()
        guard data != overlay.appliedData else { return }
        let note = model.capture(page: overlay.pageIndex, data: data, size: overlay.pageSize)
        overlay.appliedData = data; overlay.revision = note.revision
    }
    func tearDown() {
        for overlay in overlays.values { capture(overlay); overlay.load?.cancel(); picker.removeObserver(overlay.canvas) }
        model.flush(); hidePicker()
        navigationPan?.minimumNumberOfTouches = originalMinimum; navigationPan?.allowedTouchTypes = originalTouchTypes
        pdf?.isInMarkupMode = false
        picker.removeObserver(self); overlays.removeAll()
    }
}
