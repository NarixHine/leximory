import SwiftUI
import WebKit
import PDFKit

struct EbookSelection: Equatable {
    let quote: String
    let context: String
    let offset: Int
    var location: String?
    var rect = CGRect.zero
}

struct EbookSelectionAction {
    enum Kind { case define, bookmark }
    let id = UUID()
    let kind: Kind
    let selection: EbookSelection
}

enum EbookAppearance: String, CaseIterable {
    case automatic, paper, sepia, night
    var title: String {
        switch self { case .automatic: "跟随系统"; case .paper: "白纸"; case .sepia: "暖纸"; case .night: "夜间" }
    }
    var colorScheme: ColorScheme? {
        switch self { case .automatic: nil; case .night: .dark; case .paper, .sepia: .light }
    }
    func colors(dark: Bool, softerInk: Bool = false) -> (paper: String, ink: String) {
        switch self {
        case .automatic: dark ? ("#100f0f", "#cecdc3") : ("#ffffff", softerInk ? "#434943" : "#192024")
        case .paper: ("#ffffff", softerInk ? "#434943" : "#192024")
        case .sepia: ("#f5f0e5", softerInk ? "#505047" : "#37372e")
        case .night: ("#100f0f", "#cecdc3")
        }
    }
}

@MainActor enum EbookLearningMenu {
    static func insert(into builder: UIMenuBuilder, reader: EbookReaderState) {
        guard builder.system == .context else { return }
        ReadingSelectionMenu.removeUnrelatedActions(from: builder)
        let selection = reader.selection
        let define = UIAction(title: ReadingSelectionMenu.lookupTitle, image: ReadingSelectionMenu.lookupImage, attributes: reader.readOnly ? .disabled : []) { _ in
            if let selection = selection ?? reader.menuSelection { reader.selectionAction = EbookSelectionAction(kind: .define, selection: selection) }
        }
        let bookmark = UIAction(title: "添加书签", image: UIImage(systemName: "bookmark"), attributes: reader.canBookmark && !reader.readOnly ? [] : .disabled) { _ in
            if let selection = selection ?? reader.menuSelection { reader.selectionAction = EbookSelectionAction(kind: .bookmark, selection: selection) }
        }
        builder.insertSibling(UIMenu(title: "", options: .displayInline, children: [define, bookmark]), beforeMenu: .standardEdit)
    }
}

final class LearningWebView: WKWebView {
    var reader: EbookReaderState?
    override var keyCommands: [UIKeyCommand]? {
        let paging = [
            UIKeyCommand(input: UIKeyCommand.inputLeftArrow, modifierFlags: [], action: #selector(previousKey)),
            UIKeyCommand(input: UIKeyCommand.inputRightArrow, modifierFlags: [], action: #selector(nextKey))
        ]
        paging.forEach { $0.wantsPriorityOverSystemBehavior = true }
        return (super.keyCommands ?? []) + paging
    }
    @objc private func previousKey() { reader?.navigate(reader?.rightToLeft == true ? "next" : "previous") }
    @objc private func nextKey() { reader?.navigate(reader?.rightToLeft == true ? "previous" : "next") }
    override func buildMenu(with builder: UIMenuBuilder) {
        super.buildMenu(with: builder)
        if let reader { EbookLearningMenu.insert(into: builder, reader: reader) }
    }
}

final class LearningPDFView: PDFView {
    var reader: EbookReaderState?
    override func buildMenu(with builder: UIMenuBuilder) {
        super.buildMenu(with: builder)
        if let reader { EbookLearningMenu.insert(into: builder, reader: reader) }
    }
}

@MainActor final class EbookGestures: NSObject, UIGestureRecognizerDelegate {
    let reader: EbookReaderState
    init(reader: EbookReaderState) { self.reader = reader }
    @discardableResult func install(on view: UIView, centerTap: Bool) -> UIScreenEdgePanGestureRecognizer {
        if centerTap {
            let tap = UITapGestureRecognizer(target: self, action: #selector(tapped))
            tap.cancelsTouchesInView = false; tap.delegate = self
            view.addGestureRecognizer(tap)
            for recognizer in view.gestureRecognizers ?? [] where recognizer !== tap {
                if let other = recognizer as? UITapGestureRecognizer, other.numberOfTapsRequired > 1 { tap.require(toFail: other) }
            }
        }
        let back = UIScreenEdgePanGestureRecognizer(target: self, action: #selector(backSwiped))
        back.edges = .left; view.addGestureRecognizer(back)
        return back
    }
    @objc private func tapped(_ gesture: UITapGestureRecognizer) {
        guard let view = gesture.view, reader.selection == nil else { return }
        let x = gesture.location(in: view).x / max(1, view.bounds.width)
        if reader.pageBounds != nil {
            if reader.gutterSide(at: gesture.location(in: view)) == nil { reader.chromeVisible.toggle() }
        } else if (0.25...0.75).contains(x) { reader.chromeVisible.toggle() }
    }
    @objc private func backSwiped(_ gesture: UIScreenEdgePanGestureRecognizer) {
        if gesture.state == .ended, gesture.translation(in: gesture.view).x > 70 { reader.backRequest = UUID() }
    }
    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool { true }
}

/// Flat page-slide geometry. The current page tracks the finger's exact travel;
/// the destination page enters from the opposite edge over a shorter, parallaxed
/// distance. Brightness is a continuous function of a page's forward shift:
/// forward darkens, center and behind stay at full brightness.
struct PageSlide {
    /// Fraction of the viewport the incoming page begins beyond the leading edge.
    static let incomingInset: CGFloat = 0.16
    /// Peak veil applied to the animating page at the far end of its travel.
    static let veilStrength: CGFloat = 0.1

    static func progress(travel: CGFloat, width: CGFloat) -> CGFloat {
        guard width > 0 else { return 0 }
        return max(0, travel / width)
    }
    /// The turning leaf always travels the finger's full distance; the page it
    /// reveals only parallaxes the short inset. `advances` selects which page is
    /// the leaf: the current page going forward, the previous page going back.
    static func outgoingOffset(progress: CGFloat, width: CGFloat, forward: Bool, advances: Bool) -> CGFloat {
        let p = min(1, max(0, progress))
        let direction: CGFloat = forward ? -1 : 1
        return advances ? direction * p * width : direction * incomingInset * width * p
    }
    static func incomingOffset(progress: CGFloat, width: CGFloat, forward: Bool, advances: Bool) -> CGFloat {
        let p = min(1, max(0, progress))
        let direction: CGFloat = forward ? 1 : -1
        return advances ? direction * incomingInset * width * (1 - p) : direction * width * (1 - p)
    }
    /// Brightness as a function of displacement toward the next page. The veil
    /// ramps in from center and never lightens past full brightness.
    static func veilAlpha(forwardOffset: CGFloat, width: CGFloat) -> CGFloat {
        guard width > 0 else { return 0 }
        let reach = width * incomingInset
        return min(1, abs(forwardOffset) / reach) * veilStrength
    }
    /// Whether the veil at this displacement darkens (forward) or lightens (behind).
    static func veilDarkens(forwardOffset: CGFloat) -> Bool { forwardOffset >= 0 }
    /// Decide a release from the projected landing point, so a quick flick is
    /// enough and a deliberate reverse release cancels. `velocity` is viewport
    /// widths per second in the advancing direction.
    static func commits(progress: CGFloat, velocity: CGFloat) -> Bool {
        let projected = progress + velocity * 0.16
        return projected > 0.3 || (progress > 0.05 && velocity > 0.3)
    }
}

/// Critically damped spring shared by both pages. It carries the release
/// velocity into the endpoint and decays exponentially without overshoot, so the
/// page always comes to a natural, physical halt.
struct PageTurnSpring {
    let from: CGFloat
    let target: CGFloat
    let velocity: CGFloat
    /// Angular frequency. Lower is slower and more stately.
    var omega: CGFloat = 9

    var duration: Double { 5.5 / Double(omega) }
    func value(at time: CGFloat) -> CGFloat {
        let seconds = CGFloat(min(1, max(0, time))) * CGFloat(duration)
        let displacement = from - target
        let slope = velocity + omega * displacement
        return target + (displacement + slope * seconds) * exp(-omega * seconds)
    }
    func settledValue(at time: CGFloat) -> CGFloat {
        let time = min(1, max(0, time))
        return value(at: time) - (value(at: 1) - target) * time
    }
    /// Physical velocity, including the same endpoint correction as the position.
    func settledVelocity(at time: CGFloat) -> CGFloat {
        let seconds = min(1, max(0, time)) * CGFloat(duration)
        let slope = velocity + omega * (from - target)
        return (velocity - omega * slope * seconds) * exp(-omega * seconds)
            - (value(at: 1) - target) / CGFloat(duration)
    }
}

@MainActor final class EPUBPageTurn: NSObject, UIGestureRecognizerDelegate {
    private weak var web: WKWebView?
    private let reader: EbookReaderState
    private var snapshot: UIImage?
    private var snapshotID = UUID()
    private struct SwipePreviews {
        let size: CGSize
        var images: [Bool: UIImage]
    }
    private var swipePreviews: [String: SwipePreviews] = [:]
    private var preloadOrder: [String] = []
    private var preparedNeighbors: SwipePreviews?
    private var neighborPreparation: Task<Void, Never>?
    private var preloadRenderer: EPUBPreloadRenderer?
    private var resolvedSwipeImage: UIImage?
    private var pinnedIncoming = false
    private var outgoing: UIView?
    private var incoming: UIView?
    private var outgoingImage: UIImageView?
    private var incomingImage: UIImageView?
    private var outgoingVeil: UIView?
    private var incomingVeil: UIView?
    private var outgoingShadow: UIView?
    private var incomingShadow: UIView?
    private var sourceCopies: [UIView] = []
    private var progress: CGFloat = 0
    private var dragOrigin: CGFloat = 0
    private var forward = true
    private var advances = true
    private var previewReady = false
    private var requestedCommit: Bool?
    private var resolvingTurn = false
    private var motionFinished = false
    private var launchVelocity: CGFloat = 0
    private var settlementDriver: PageTurnFrames?
    private var queuedTurns: [Bool] = []
    private var turnInFlight = false
    private var preparingTap = false
    private var stopped = false
    private var tapPreparation: Task<Void, Never>?
    private var pendingTaps: [Bool] = []
    let pan = UIPanGestureRecognizer()

    init(web: WKWebView, reader: EbookReaderState) {
        self.web = web; self.reader = reader
        super.init()
        pan.addTarget(self, action: #selector(dragged))
        pan.delegate = self; pan.maximumNumberOfTouches = 1
        web.addGestureRecognizer(pan)
    }
    func prepare() {
        guard !stopped, !turnInFlight, !preparingTap, let web, web.bounds.width > 0 else { return }
        let request = UUID(); snapshotID = request
        let location = reader.location
        preparedNeighbors = location.flatMap { swipePreviews[$0] }.flatMap { $0.size == web.bounds.size ? $0 : nil }
        Task { [weak self] in
            guard let self else { return }
            let image = await self.captureWebImage(hiding: [])
            guard self.snapshotID == request, self.reader.location == location,
                  !self.turnInFlight, !self.preparingTap, !self.stopped else { return }
            self.snapshot = image
            if let image { await self.prepareSwipePreviews(source: image) }
        }
    }
    func pageArrived() {
        prepare()
    }
    func prime() async {
        snapshotID = UUID(); preparedNeighbors = nil
        let image = await captureWebImage(hiding: [])
        if !stopped {
            snapshot = image
            if let image { await prepareSwipePreviews(source: image) }
        }
    }
    /// Drop a captured page so the next turn re-reads the current appearance
    /// (theme, size, or leading changes would otherwise animate a stale sheet).
    func invalidateSnapshot() {
        snapshotID = UUID(); snapshot = nil
        neighborPreparation?.cancel()
        swipePreviews.removeAll(); preloadOrder.removeAll(); preparedNeighbors = nil
    }

    /// Taps update the EPUB directly. Only swipes install animated sheets.
    func requestTurn(advancing: Bool) {
        guard !stopped, reader.ready, reader.selection == nil else { return }
        if turnInFlight {
            queuedTurns.append(advancing)
            return
        }
        if !preparingTap && pendingTaps.isEmpty {
            guard advancing ? !reader.atEnd : !reader.atStart else { return }
        }
        pendingTaps.append(advancing)
        snapshotID = UUID(); snapshot = nil; preparedNeighbors = nil
        neighborPreparation?.cancel()
        renderPendingTaps()
    }

    private func renderPendingTaps() {
        guard !preparingTap else { return }
        preparingTap = true
        tapPreparation = Task { [weak self] in
            guard let self, let web = self.web else { return }
            defer { self.preparingTap = false; self.prepare() }
            while !self.pendingTaps.isEmpty && !Task.isCancelled {
                let batch = self.pendingTaps
                self.pendingTaps.removeAll()
                do {
                    _ = try await web.callAsyncJavaScript("return await window.readerTap(actions)",
                        arguments: ["actions": batch.map { $0 ? "next" : "previous" }], in: nil, contentWorld: .page)
                    guard !Task.isCancelled else { return }
                } catch {
                    _ = try? await web.callAsyncJavaScript("return await window.readerTurn('cancel')", arguments: [:], in: nil, contentWorld: .page)
                    self.pendingTaps.removeAll()
                }
            }
        }
    }
    func stop() {
        stopped = true
        preloadRenderer?.stop(); preloadRenderer = nil
        queuedTurns.removeAll(); pendingTaps.removeAll()
        tapPreparation?.cancel(); tapPreparation = nil
        neighborPreparation?.cancel()
        settlementDriver?.stop()
        sourceCopies.forEach { $0.removeFromSuperview() }; sourceCopies.removeAll()
        for view in [outgoing, incoming, outgoingVeil, incomingVeil, outgoingShadow, incomingShadow] { view?.removeFromSuperview() }
        invalidateSnapshot()
    }
    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
        guard let web else { return false }
        return touch.location(in: web).x > 24
    }
    func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
        guard let web, reader.ready, reader.selection == nil else { return false }
        guard gestureRecognizer === pan else { return true }
        guard !preparingTap else { return false }
        let velocity = pan.velocity(in: web)
        guard abs(velocity.x) > abs(velocity.y) * 1.5 else { return false }
        if turnInFlight {
            guard let driver = settlementDriver else { return false }
            // Claim the existing sheets before UIKit delivers .began. Otherwise
            // the old completion can restore the renderer between those calls.
            driver.stop(); settlementDriver = nil
            return true
        }
        let requestingNext = reader.rightToLeft ? velocity.x > 0 : velocity.x < 0
        return requestingNext ? !reader.atEnd : !reader.atStart
    }
    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool {
        true
    }
    @objc private func dragged() {
        guard let web else { return }
        switch pan.state {
        case .began:
            if turnInFlight {
                settlementDriver?.stop(); settlementDriver = nil
                requestedCommit = nil; resolvingTurn = false; motionFinished = false
                dragOrigin = progress * web.bounds.width * (forward ? -1 : 1)
                updateDrag(translation: dragOrigin + pan.translation(in: web).x)
                return
            }
            dragOrigin = 0
            forward = pan.velocity(in: web).x < 0
            advances = reader.rightToLeft ? !forward : forward
            launchVelocity = 0
            if !UIAccessibility.isReduceMotionEnabled {
                beginTurn(advancing: advances, forward: forward, translation: pan.translation(in: web).x)
            }
        case .changed:
            guard !UIAccessibility.isReduceMotionEnabled else { return }
            updateDrag(translation: dragOrigin + pan.translation(in: web).x)
        case .ended:
            let raw = pan.velocity(in: web).x * (forward ? -1 : 1)
            launchVelocity = raw / max(1, web.bounds.width)
            if UIAccessibility.isReduceMotionEnabled {
                if PageSlide.commits(progress: progress, velocity: launchVelocity) { reader.navigate(advances ? "next" : "previous") }
                return
            }
            if turnInFlight {
                releaseDrag(velocity: launchVelocity)
            } else if PageSlide.commits(progress: progress, velocity: launchVelocity) {
                reader.navigate(advances ? "next" : "previous")
            }
        case .cancelled, .failed:
            releaseDrag(velocity: 0, cancelled: true)
        default: break
        }
    }
    func updateDrag(translation: CGFloat) {
        guard let web else { return }
        let travel = max(0, translation * (forward ? -1 : 1))
        progress = PageSlide.progress(travel: travel, width: max(1, web.bounds.width))
        pose()
    }

    func beginTurn(advancing: Bool, forward: Bool, translation: CGFloat = 0) {
        guard !stopped else { return }
        snapshotID = UUID()
        neighborPreparation?.cancel()
        turnInFlight = true
        advances = advancing; self.forward = forward
        progress = 0; launchVelocity = 0
        previewReady = false; requestedCommit = nil; resolvingTurn = false; motionFinished = false
        // Install the current page synchronously. Destination rendering must
        // never gate the finger's movement or accumulate a hidden translation.
        let previews = reader.location.flatMap { swipePreviews[$0] } ?? preparedNeighbors
        let destination = previews?.size == web?.bounds.size ? previews?.images[advancing] : nil
        pinnedIncoming = destination != nil; resolvedSwipeImage = nil
        installOverlays(image: snapshot, destination: destination)
        updateDrag(translation: translation)
        Task { [weak self] in
            guard let self, let web = self.web else { return }
            guard let image = await self.ensureSnapshot(), !self.stopped else { self.resetTurn(); return }
            self.outgoingImage?.image = image
            self.sourceCopies.forEach { $0.removeFromSuperview() }; self.sourceCopies.removeAll()
            do {
                _ = try await web.callAsyncJavaScript("return await window.readerTurn(action)",
                    arguments: ["action": advancing ? "next" : "previous"], in: nil, contentWorld: .page)
            } catch { self.previewReady = true; self.finish(to: 0, restore: true); return }
            // Overlays live outside the web view, so a snapshot never captures them.
            let destination = await self.captureWebImage(hiding: [])
            guard !self.stopped else { self.resetTurn(); return }
            guard let destination else { self.previewReady = true; self.finish(to: 0, restore: true); return }
            self.resolvedSwipeImage = destination
            if let location = try? await web.callAsyncJavaScript("return window.readerPreviewLocation?.()", arguments: [:], in: nil, contentWorld: .page) as? String {
                var previews = self.swipePreviews[location].flatMap { $0.size == web.bounds.size ? $0.images : nil } ?? [:]
                previews[!advancing] = image
                self.swipePreviews[location] = SwipePreviews(size: web.bounds.size, images: previews)
            }
            self.previewReady = true
            if !self.pinnedIncoming {
                self.incomingImage?.image = destination
                self.pinnedIncoming = true
            }
            self.pose()
            if self.motionFinished { self.settle(restore: self.requestedCommit != true) }
            else { self.resolveTurn() }
        }
    }
    func releaseDrag(velocity: CGFloat, cancelled: Bool = false) {
        launchVelocity = velocity
        requestedCommit = !cancelled && PageSlide.commits(progress: progress, velocity: velocity)
        resolveTurn()
    }
    private func resolveTurn() {
        guard let commit = requestedCommit, !resolvingTurn else { return }
        resolvingTurn = true
        if commit { finish(to: 1) } else { finish(to: 0, restore: true) }
    }
    private func prepareSwipePreviews(source: UIImage) async {
        if let neighborPreparation {
            await neighborPreparation.value
            guard self.neighborPreparation == nil, !preparingTap, !turnInFlight, !stopped else { return }
        }
        guard !stopped, reader.selection == nil, let web else { return }
        let generation = snapshotID
        let operation = Task { [weak self] in
            guard let self else { return }
            defer { self.neighborPreparation = nil }
            guard let location = try? await web.callAsyncJavaScript("return window.readerPreviewLocation?.()", arguments: [:], in: nil, contentWorld: .page) as? String,
                  !Task.isCancelled, !self.stopped, self.snapshotID == generation,
                  let renderer = await self.preloader() else { return }
            await self.preloadPages(renderer: renderer, source: source, location: location, generation: generation)
        }
        neighborPreparation = operation
        await operation.value
    }

    private func cachePreloaded(_ pages: SwipePreviews, at location: String) {
        swipePreviews[location] = pages
        preloadOrder.removeAll { $0 == location }
        preloadOrder.append(location)
        while preloadOrder.count > 10 { swipePreviews[preloadOrder.removeFirst()] = nil }
    }

    private func preloader() async -> EPUBPreloadRenderer? {
        if let preloadRenderer { return preloadRenderer }
        guard let web, let url = web.url, url.isFileURL,
              let arguments = try? await web.callAsyncJavaScript("return window.readerPreloadConfiguration?.()", arguments: [:], in: nil, contentWorld: .page) as? [String: Any],
              !Task.isCancelled, !stopped else { return nil }
        let renderer = EPUBPreloadRenderer(frame: web.frame)
        renderer.web.isOpaque = web.isOpaque
        renderer.web.backgroundColor = web.backgroundColor
        renderer.web.scrollView.bounces = web.scrollView.bounces
        renderer.web.scrollView.contentInsetAdjustmentBehavior = web.scrollView.contentInsetAdjustmentBehavior
        preloadRenderer = renderer
        web.superview?.insertSubview(renderer.web, belowSubview: web)
        do {
            try await renderer.load(url)
            _ = try await renderer.web.callAsyncJavaScript("await window.openBook(base64, location, fonts, theme, bookmarks)", arguments: arguments, in: nil, contentWorld: .page)
            return renderer
        } catch {
            renderer.stop(); preloadRenderer = nil
            return nil
        }
    }

    private func preloadPages(renderer: EPUBPreloadRenderer, source: UIImage, location: String, generation: UUID) async {
        guard let web, !Task.isCancelled, snapshotID == generation, !stopped else { return }
        let preview = renderer.web
        preview.frame = web.frame
        preview.backgroundColor = web.backgroundColor
        let size = web.bounds.size
        do {
            guard let state = try await web.callAsyncJavaScript("return window.readerPreloadState()", arguments: [:], in: nil, contentWorld: .page) as? [String: Any] else { return }
            var retained: Set<String> = [location]
            var states = [true: state, false: state]
            var locations = [true: location, false: location]
            var images = [true: source, false: source]
            var edges: Set<Bool> = []
            // Warm both immediate neighbors before extending the lookahead.
            for advancing in [advances, !advances, advances, advances, !advances, !advances] {
                if edges.contains(advancing) { continue }
                guard !Task.isCancelled, snapshotID == generation, !stopped else { return }
                _ = try await preview.callAsyncJavaScript("await window.readerPreloadRestore(state)", arguments: ["state": states[advancing]!], in: nil, contentWorld: .page)
                let previous = locations[advancing]!
                guard let next = try await preview.callAsyncJavaScript("return await window.readerPreloadStep(advancing)", arguments: ["advancing": advancing], in: nil, contentWorld: .page) as? String else { break }
                if next == previous {
                    edges.insert(advancing)
                    continue
                }
                guard let image = await captureWebImage(hiding: [], from: preview),
                      !Task.isCancelled, snapshotID == generation, !stopped else { return }
                var before = swipePreviews[previous].flatMap { $0.size == size ? $0.images : nil } ?? [:]
                before[advancing] = image
                cachePreloaded(SwipePreviews(size: size, images: before), at: previous)
                var after = swipePreviews[next].flatMap { $0.size == size ? $0.images : nil } ?? [:]
                after[!advancing] = images[advancing]!
                cachePreloaded(SwipePreviews(size: size, images: after), at: next)
                preparedNeighbors = swipePreviews[location]
                retained.insert(next)
                locations[advancing] = next; images[advancing] = image
                guard let nextState = try await preview.callAsyncJavaScript("return window.readerPreloadState()", arguments: [:], in: nil, contentWorld: .page) as? [String: Any] else { return }
                states[advancing] = nextState
            }
            swipePreviews = swipePreviews.filter { retained.contains($0.key) }
            preloadOrder.removeAll { !retained.contains($0) }
        } catch { }
    }

    private func ensureSnapshot() async -> UIImage? {
        if let snapshot { return snapshot }
        return await captureWebImage(hiding: [])
    }
    private func captureWebImage(hiding views: [UIView?], from preview: WKWebView? = nil) async -> UIImage? {
        guard let web = preview ?? self.web else { return nil }
        let hidden = views.compactMap { $0 }.filter { !$0.isHidden }
        hidden.forEach { $0.isHidden = true }
        let configuration = WKSnapshotConfiguration(); configuration.afterScreenUpdates = true
        func capture() async -> UIImage? {
            await withCheckedContinuation { continuation in
                web.takeSnapshot(with: configuration) { image, _ in continuation.resume(returning: image) }
            }
        }
        var image = await capture()
        // A newly displayed WebKit surface can return a uniform bitmap before
        // its remote content layer reaches UIKit, despite afterScreenUpdates.
        // Retry once after another paint; genuinely blank book pages stay valid.
        if let first = image, !Self.hasImageDetail(first) {
            _ = try? await web.callAsyncJavaScript("await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))", arguments: [:], in: nil, contentWorld: .page)
            image = await capture()
        }
        hidden.forEach { $0.isHidden = false }
        return image
    }
    private static func hasImageDetail(_ image: UIImage) -> Bool {
        guard let image = image.cgImage else { return false }
        let side = 64
        var pixels = [UInt8](repeating: 0, count: side * side)
        pixels.withUnsafeMutableBytes { buffer in
            guard let context = CGContext(data: buffer.baseAddress, width: side, height: side, bitsPerComponent: 8,
                bytesPerRow: side, space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue) else { return }
            context.draw(image, in: CGRect(x: 0, y: 0, width: side, height: side))
        }
        return Int(pixels.max() ?? 0) - Int(pixels.min() ?? 0) > 8
    }
    private func installOverlays(image: UIImage?, destination: UIImage?) {
        guard let web else { return }
        let host = web.superview ?? web
        let stage = host.bounds
        let paper = web.backgroundColor ?? LeximoryPalette.paperUI
        let radius = displayCornerRadius(for: web)
        func pageContainer() -> UIView {
            let view = UIView(frame: stage)
            // Each sheet shares the screen's rounded corners as it slides.
            view.backgroundColor = paper
            view.isUserInteractionEnabled = false
            view.layer.cornerRadius = radius
            view.layer.cornerCurve = .continuous
            view.clipsToBounds = radius > 0
            return view
        }
        func pageImage(in container: UIView) -> UIImageView {
            // The whole screen is the paper, so each sheet is full-screen with the
            // book image where the web view sits inside it.
            let imageView = UIImageView(frame: web.convert(web.bounds, to: container))
            imageView.contentMode = .scaleToFill; imageView.isUserInteractionEnabled = false
            container.addSubview(imageView)
            return imageView
        }
        let incoming = pageContainer()
        let incomingImage = pageImage(in: incoming); incomingImage.image = destination
        let outgoing = pageContainer()
        let outgoingImage = pageImage(in: outgoing); outgoingImage.image = image
        if image == nil {
            // A cold first swipe still gets immediate rendered content. Keep
            // WebKit stationary and use its onscreen copies until capture ends.
            for container in [outgoing] {
                if let copy = web.snapshotView(afterScreenUpdates: false) {
                    copy.frame = web.convert(web.bounds, to: container)
                    container.addSubview(copy); sourceCopies.append(copy)
                }
            }
        }
        let incomingVeil = makeVeil(frame: stage, radius: radius)
        let outgoingVeil = makeVeil(frame: stage, radius: radius)
        let incomingShadow = makeShadow(frame: stage, radius: radius)
        let outgoingShadow = makeShadow(frame: stage, radius: radius)
        // The turning leaf always sits above the page it reveals: the current page
        // going forward, the previous page coming back over it. Each leaf casts an
        // extremely soft shadow so its contour reads against the page below.
        let order = advances
            ? [incomingShadow, incoming, incomingVeil, outgoingShadow, outgoing, outgoingVeil]
            : [outgoingShadow, outgoing, outgoingVeil, incomingShadow, incoming, incomingVeil]
        order.forEach { host.addSubview($0) }
        self.incoming = incoming; self.incomingImage = incomingImage
        self.outgoing = outgoing; self.outgoingImage = outgoingImage
        self.incomingVeil = incomingVeil; self.outgoingVeil = outgoingVeil
        self.incomingShadow = incomingShadow; self.outgoingShadow = outgoingShadow
        pose()
    }
    private func makeVeil(frame: CGRect, radius: CGFloat) -> UIView {
        let veil = UIView(frame: frame)
        veil.isUserInteractionEnabled = false
        veil.alpha = 0
        veil.layer.cornerRadius = radius
        veil.layer.cornerCurve = .continuous
        veil.clipsToBounds = radius > 0
        return veil
    }
    private func makeShadow(frame: CGRect, radius: CGFloat) -> UIView {
        let shadow = UIView(frame: frame)
        shadow.isUserInteractionEnabled = false
        shadow.backgroundColor = .clear
        shadow.layer.shadowColor = UIColor.black.cgColor
        shadow.layer.shadowOpacity = 0.06
        shadow.layer.shadowRadius = 12
        shadow.layer.shadowOffset = .zero
        shadow.layer.shadowPath = UIBezierPath(roundedRect: shadow.bounds, cornerRadius: radius).cgPath
        return shadow
    }
    private func displayCornerRadius(for view: UIView) -> CGFloat {
        let selector = NSSelectorFromString("_displayCornerRadius")
        guard let screen = view.window?.screen, screen.responds(to: selector) else { return 0 }
        return (screen.value(forKey: "_displayCornerRadius") as? NSNumber).map { CGFloat($0.doubleValue) } ?? 0
    }
    private func pose() {
        guard let web else { return }
        let width = max(1, web.bounds.width)
        // Both sheets already contain rendered source content, so they can
        // track the finger while the actual destination is still rendering.
        let settled = progress
        let outgoingOffset = PageSlide.outgoingOffset(progress: settled, width: width, forward: forward, advances: advances)
        let incomingOffset = PageSlide.incomingOffset(progress: settled, width: width, forward: forward, advances: advances)
        outgoing?.transform = CGAffineTransform(translationX: outgoingOffset, y: 0)
        outgoingVeil?.transform = outgoing?.transform ?? .identity
        outgoingShadow?.transform = outgoing?.transform ?? .identity
        incoming?.transform = CGAffineTransform(translationX: incomingOffset, y: 0)
        incomingVeil?.transform = incoming?.transform ?? .identity
        incomingShadow?.transform = incoming?.transform ?? .identity
        applyVeil(to: outgoingVeil, offset: outgoingOffset, width: width)
        applyVeil(to: incomingVeil, offset: incomingOffset, width: width)
    }
    private func applyVeil(to veil: UIView?, offset: CGFloat, width: CGFloat) {
        guard let veil, let web else { return }
        let forwardOffset = reader.rightToLeft ? -offset : offset
        let dark = web.traitCollection.userInterfaceStyle == .dark
        // Every page follows the same law: forward shift moves it away from the
        // paper, centre and behind stay at full brightness.
        veil.backgroundColor = (PageSlide.veilDarkens(forwardOffset: forwardOffset) != dark) ? .black : .white
        veil.alpha = PageSlide.veilAlpha(forwardOffset: forwardOffset, width: width)
    }
    private func finish(to target: CGFloat, restore: Bool = false) {
        guard turnInFlight, !stopped else { resetTurn(); return }
        settlementDriver?.stop()
        motionFinished = false
        let from = min(1, max(0, progress))
        // A spring carries the finger's release velocity and eases into the
        // endpoint, so the motion never starts or stops abruptly. Both the leaving
        // and the incoming page ride the same trajectory. The linear correction
        // lands the spring exactly on target, so the last pixels never jump.
        let velocity = max(-8, min(8, launchVelocity))
        let spring = PageTurnSpring(from: from, target: target, velocity: velocity, omega: 9)
        let driver = PageTurnFrames(duration: spring.duration, update: { [weak self] elapsed in
            self?.progress = spring.settledValue(at: elapsed)
            self?.pose()
        }, completion: { [weak self] in
            self?.settlementDriver = nil
            self?.settle(restore: restore)
        })
        settlementDriver = driver
        driver.start()
    }
    private func settle(restore: Bool) {
        motionFinished = true
        // Motion follows the release immediately. Only removing its sheets
        // waits for WebKit to have the committed or cancelled page ready.
        guard previewReady else { return }
        Task { [weak self] in
            guard let self else { return }
            if let web = self.web {
                _ = try? await web.callAsyncJavaScript("return await window.readerTurn(action)",
                    arguments: ["action": restore ? "cancel" : "commit"], in: nil, contentWorld: .page)
            }
            if !restore { self.snapshot = self.resolvedSwipeImage }
            self.resetTurn()
        }
    }
    private func resetTurn() {
        sourceCopies.forEach { $0.removeFromSuperview() }; sourceCopies.removeAll()
        for view in [outgoing, incoming, outgoingVeil, incomingVeil, outgoingShadow, incomingShadow] { view?.removeFromSuperview() }
        outgoing = nil; incoming = nil; outgoingImage = nil; incomingImage = nil
        outgoingVeil = nil; incomingVeil = nil; outgoingShadow = nil; incomingShadow = nil
        progress = 0; dragOrigin = 0; launchVelocity = 0; previewReady = false
        requestedCommit = nil; resolvingTurn = false; motionFinished = false
        resolvedSwipeImage = nil; pinnedIncoming = false
        settlementDriver?.stop(); settlementDriver = nil; turnInFlight = false
        prepare()
        let taps = queuedTurns
        queuedTurns.removeAll()
        for advancing in taps { requestTurn(advancing: advancing) }
    }
}

@MainActor private final class EPUBPreloadRenderer: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
    let web: WKWebView
    private var loaded: CheckedContinuation<Void, Error>?
    init(frame: CGRect) {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        web = WKWebView(frame: frame, configuration: configuration)
        super.init()
        web.isUserInteractionEnabled = false
        web.isAccessibilityElement = false
        web.accessibilityElementsHidden = true
        web.navigationDelegate = self
        configuration.userContentController.add(self, name: "reader")
    }
    func load(_ url: URL) async throws {
        try await withCheckedThrowingContinuation { continuation in
            loaded = continuation
            web.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        }
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        loaded?.resume(); loaded = nil
    }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        loaded?.resume(throwing: error); loaded = nil
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        loaded?.resume(throwing: error); loaded = nil
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) { }
    func stop() {
        loaded?.resume(throwing: CancellationError()); loaded = nil
        web.stopLoading(); web.removeFromSuperview()
        web.configuration.userContentController.removeScriptMessageHandler(forName: "reader")
        web.navigationDelegate = nil
    }
}

@MainActor private final class PageTurnFrames: NSObject {
    private var link: CADisplayLink?
    private var started: CFTimeInterval = 0
    private let duration: CFTimeInterval
    private let update: (CGFloat) -> Void
    private let completion: () -> Void
    init(duration: CFTimeInterval, update: @escaping (CGFloat) -> Void, completion: @escaping () -> Void) {
        self.duration = duration; self.update = update; self.completion = completion
    }
    func start() {
        update(0)
        started = CACurrentMediaTime()
        let link = CADisplayLink(target: self, selector: #selector(tick))
        link.preferredFrameRateRange = CAFrameRateRange(minimum: 60, maximum: 120, preferred: 120)
        self.link = link; link.add(to: .main, forMode: .common)
    }
    @objc private func tick(_ link: CADisplayLink) {
        let t = min(1, max(0, (link.timestamp - started) / duration))
        update(CGFloat(t))
        if t == 1 { stop(); completion() }
    }
    func stop() { link?.invalidate(); link = nil }
}
