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
    var allowsFingerSelection: Bool {
        canvas.drawingPolicy == .pencilOnly ||
            (canvas.drawingPolicy == .default && UIPencilInteraction.prefersPencilOnlyDrawing)
    }
    init(pageIndex: Int, size: CGSize) {
        self.pageIndex = pageIndex; pageSize = size
        super.init(frame: CGRect(origin: .zero, size: size))
        backgroundColor = .clear; isOpaque = false
        canvas.backgroundColor = .clear; canvas.isOpaque = false
        canvas.overrideUserInterfaceStyle = .light
        canvas.isScrollEnabled = false; canvas.bounces = false
        canvas.panGestureRecognizer.isEnabled = false
        canvas.pinchGestureRecognizer?.isEnabled = false
        canvas.bouncesZoom = false
        canvas.contentInsetAdjustmentBehavior = .never
        canvas.maximumSupportedContentVersion = .version4
        canvas.drawingPolicy = .default
        #if DEBUG && targetEnvironment(simulator)
        if ProcessInfo.processInfo.arguments.contains("--browser-workspace-fixtures"),
           ProcessInfo.processInfo.arguments.contains("--pdf-pencil-only") { canvas.drawingPolicy = .pencilOnly }
        if ProcessInfo.processInfo.arguments.contains("--browser-workspace-fixtures"),
           ProcessInfo.processInfo.arguments.contains("--pdf-drawing-fixtures") { canvas.drawingPolicy = .anyInput }
        #endif
        canvas.isDrawingEnabled = false
        canvas.contentSize = size
        canvas.accessibilityIdentifier = "pdf-drawing-page-\(pageIndex)"
        addSubview(canvas)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    override func didMoveToWindow() {
        super.didMoveToWindow()
        setNeedsLayout()
    }
    override func layoutSubviews() {
        super.layoutSubviews()
        guard bounds.width > 0, bounds.height > 0 else { return }
        let start = convert(bounds.origin, to: window)
        let end = convert(CGPoint(x: bounds.maxX, y: bounds.minY), to: window)
        let zoom = hypot(end.x - start.x, end.y - start.y) / pageSize.width
        guard zoom.isFinite, zoom > 0 else { return }
        let renderedSize = CGSize(width: pageSize.width * zoom, height: pageSize.height * zoom)
        // Cancel the PDF's outer magnification and let PencilKit render its own zoom.
        // The drawing itself stays in the original page coordinate space.
        canvas.bounds = CGRect(origin: .zero, size: renderedSize)
        canvas.center = CGPoint(x: bounds.midX, y: bounds.midY)
        canvas.transform = CGAffineTransform(scaleX: bounds.width / renderedSize.width, y: bounds.height / renderedSize.height)
        if canvas.minimumZoomScale > zoom { canvas.minimumZoomScale = zoom }
        if canvas.maximumZoomScale < zoom { canvas.maximumZoomScale = zoom }
        if canvas.zoomScale != zoom { canvas.zoomScale = zoom }
        canvas.minimumZoomScale = zoom; canvas.maximumZoomScale = zoom
        if canvas.contentSize != renderedSize { canvas.contentSize = renderedSize }
        if canvas.contentOffset != .zero { canvas.contentOffset = .zero }
    }
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        updateInput?()
        guard canvas.isDrawingEnabled else { return nil }
        return super.hitTest(point, with: event)
    }
}

@MainActor final class PDFDrawingOverlays: NSObject, @MainActor PDFPageOverlayViewProvider, PKCanvasViewDelegate, PKToolPickerObserver, UIGestureRecognizerDelegate {
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
    private let picker: PKToolPicker
    private weak var activeCanvas: PKCanvasView?
    private weak var selectionResponder: UIView?
    private lazy var textSelection = UILongPressGestureRecognizer(target: self, action: #selector(selectText(_:)))
    private var selectionAnchor: (page: PDFPage, range: NSRange)?
    private var presentationUpdate: Task<Void, Never>?
    private var stopped = false
    private weak var navigationPan: UIPanGestureRecognizer?
    private var originalMinimum = 1
    private var originalTouchTypes: [NSNumber] = []
    var allowsFingerSelection: Bool {
        overlays.values.contains { $0.allowsFingerSelection }
    }
    init(model: PDFNotesModel, pdf: PDFView) {
        self.model = model; self.pdf = pdf
        picker = Self.makeToolPicker()
        super.init()
        picker.addObserver(self)
        textSelection.delegate = self
        textSelection.allowedTouchTypes = [NSNumber(value: UITouch.TouchType.direct.rawValue),
                                          NSNumber(value: UITouch.TouchType.indirectPointer.rawValue)]
        textSelection.isEnabled = false
        pdf.addGestureRecognizer(textSelection)
        NotificationCenter.default.addObserver(self, selector: #selector(scaleChanged), name: .PDFViewScaleChanged, object: pdf)
        NotificationCenter.default.addObserver(self, selector: #selector(selectionChanged), name: .PDFViewSelectionChanged, object: pdf)
    }
    static func makeToolPicker(autosaveName: String = "leximory.pdf.tools") -> PKToolPicker {
        let picker = PKToolPicker()
        picker.maximumSupportedContentVersion = .version4
        picker.colorUserInterfaceStyle = .light
        picker.stateAutosaveName = autosaveName
        return picker
    }
    @objc private func scaleChanged() {
        for overlay in overlays.values { overlay.setNeedsLayout() }
    }
    @objc private func selectionChanged() { schedulePresentationUpdate() }
    func pdfView(_ view: PDFView, overlayViewFor page: PDFPage) -> UIView? {
        guard !stopped, let document = view.document else { return nil }
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
        schedulePresentationUpdate()
    }
    func pdfView(_ pdfView: PDFView, willEndDisplayingOverlayView overlayView: UIView, for page: PDFPage) {
        guard let overlay = overlayView as? PDFDrawingOverlay else { return }
        capture(overlay); model.flush()
        if activeCanvas === overlay.canvas { schedulePresentationUpdate() }
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
                schedulePresentationUpdate()
            } catch { if !Task.isCancelled { model.failedToLoad() } }
        }
    }
    func update() {
        guard !stopped else { return }
        for overlay in overlays.values { load(overlay) }
        schedulePresentationUpdate()
    }
    func schedulePresentationUpdate() {
        guard !stopped, presentationUpdate == nil else { return }
        // Enter and leave drawing outside PDFKit and SwiftUI layout callbacks.
        presentationUpdate = Task { [weak self] in
            await Task.yield()
            guard !Task.isCancelled, let self else { return }
            defer { presentationUpdate = nil }
            updatePresentation()
        }
    }
    private func updatePresentation() {
        if !model.drawing {
            for overlay in overlays.values { capture(overlay) }
            model.flush()
            // Release PencilKit before PDFKit changes the page's interaction mode.
            hidePicker()
        }
        // Initial hit testing can precede UIEvent.allTouches. Let PencilKit filter its own input.
        let markup = model.drawing
        if let pdf, pdf.isInMarkupMode != markup {
            hidePicker()
            pdf.isInMarkupMode = markup
        }
        for overlay in overlays.values {
            let enabled = model.drawing && overlay.loaded
            if overlay.canvas.isDrawingEnabled != enabled { overlay.canvas.isDrawingEnabled = enabled }
        }
        configureNavigation()
        if model.drawing {
            if let pdf, pdf.currentSelection != nil {
                // PDFKit takes first responder for selection; keep the same picker visible for it.
                if let responder = firstResponder(in: pdf), responder !== activeCanvas, selectionResponder !== responder {
                    if let selectionResponder { picker.setVisible(false, forFirstResponder: selectionResponder) }
                    selectionResponder = responder
                    picker.setVisible(true, forFirstResponder: responder)
                }
            } else {
                if let selectionResponder { picker.setVisible(false, forFirstResponder: selectionResponder) }
                selectionResponder = nil
                activateLoadedPage()
            }
        }
    }
    private func firstResponder(in view: UIView) -> UIView? {
        if view.isFirstResponder { return view }
        return view.subviews.lazy.compactMap { self.firstResponder(in: $0) }.first
    }
    private func activateLoadedPage() {
        if let activeCanvas, [.began, .changed].contains(activeCanvas.drawingGestureRecognizer.state) { return }
        guard model.drawing, let pdf, let page = pdf.currentPage, let document = pdf.document else { return }
        guard pdf.currentSelection == nil else { return }
        guard let overlay = overlays[document.index(for: page)], overlay.loaded else { hidePicker(); return }
        activate(overlay.canvas)
    }
    func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
        model.drawing && allowsFingerSelection && !overlays.values.contains {
            [.began, .changed].contains($0.canvas.drawingGestureRecognizer.state)
        }
    }
    @objc private func selectText(_ gesture: UILongPressGestureRecognizer) {
        guard let pdf = pdf as? LearningPDFView else { return }
        switch gesture.state {
        case .began:
            pdf.dismissSelection()
            selectionAnchor = nil
            if let word = word(at: gesture.location(in: pdf)) {
                selectionAnchor = (word.page, word.range)
                pdf.setCurrentSelection(word.selection, animate: false)
            }
        case .changed:
            guard let anchor = selectionAnchor, let word = word(at: gesture.location(in: pdf)),
                  let document = pdf.document else { return }
            let startsBeforeAnchor = document.index(for: word.page) < document.index(for: anchor.page) ||
                (word.page === anchor.page && word.range.location < anchor.range.location)
            let start = startsBeforeAnchor ? (word.page, word.range) : (anchor.page, anchor.range)
            let end = startsBeforeAnchor ? (anchor.page, anchor.range) : (word.page, word.range)
            pdf.setCurrentSelection(document.selection(from: start.0, atCharacterIndex: start.1.location,
                to: end.0, atCharacterIndex: NSMaxRange(end.1) - 1), animate: false)
        case .ended:
            if selectionAnchor != nil { pdf.presentTextSelectionMenu() }
            selectionAnchor = nil
        case .cancelled, .failed:
            if selectionAnchor != nil { pdf.dismissSelection() }
            selectionAnchor = nil
        default: break
        }
    }
    private func word(at point: CGPoint) -> (page: PDFPage, range: NSRange, selection: PDFSelection)? {
        guard let pdf, let page = pdf.page(for: point, nearest: false),
              let selection = page.selectionForWord(at: pdf.convert(point, to: page)),
              selection.numberOfTextRanges(on: page) > 0 else { return nil }
        let range = selection.range(at: 0, on: page)
        guard range.location != NSNotFound, range.length > 0 else { return nil }
        return (page, range, selection)
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
        if let selectionResponder { picker.setVisible(false, forFirstResponder: selectionResponder) }
        selectionResponder = nil
        guard let canvas = activeCanvas else { return }
        activeCanvas = nil
        picker.setVisible(false, forFirstResponder: canvas)
        canvas.resignFirstResponder()
    }
    private func configureNavigation() {
        let selectionEnabled = model.drawing && allowsFingerSelection
        if textSelection.isEnabled != selectionEnabled { textSelection.isEnabled = selectionEnabled }
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
        let minimum: Int
        let touchTypes: [NSNumber]
        if model.drawing {
            minimum = allowsFingerSelection ? 1 : 2
            touchTypes = [NSNumber(value: UITouch.TouchType.direct.rawValue), NSNumber(value: UITouch.TouchType.indirectPointer.rawValue)]
        } else {
            minimum = originalMinimum
            touchTypes = originalTouchTypes
        }
        if navigationPan?.minimumNumberOfTouches != minimum { navigationPan?.minimumNumberOfTouches = minimum }
        if navigationPan?.allowedTouchTypes != touchTypes { navigationPan?.allowedTouchTypes = touchTypes }
    }
    func toolPickerSelectedToolItemDidChange(_ toolPicker: PKToolPicker) { configureNavigation(); schedulePresentationUpdate() }
    func canvasViewDidBeginUsingTool(_ canvasView: PKCanvasView) {
        if model.drawing {
            (pdf as? LearningPDFView)?.dismissSelection()
            activate(canvasView)
        }
    }
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
        stopped = true
        NotificationCenter.default.removeObserver(self)
        presentationUpdate?.cancel(); presentationUpdate = nil
        for overlay in overlays.values { capture(overlay); overlay.load?.cancel(); picker.removeObserver(overlay.canvas) }
        model.flush(); hidePicker()
        pdf?.removeGestureRecognizer(textSelection)
        selectionAnchor = nil
        navigationPan?.minimumNumberOfTouches = originalMinimum; navigationPan?.allowedTouchTypes = originalTouchTypes
        if pdf?.isInMarkupMode == true { pdf?.isInMarkupMode = false }
        picker.removeObserver(self); overlays.removeAll()
    }
}
