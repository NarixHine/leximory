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

/// The standard WebKit cubic-Bézier solver, so easing matches the curves used
/// across the product rather than an ad-hoc formula.
struct UnitBezier {
    private let ax, bx, cx, ay, by, cy: CGFloat

    init(_ p1x: CGFloat, _ p1y: CGFloat, _ p2x: CGFloat, _ p2y: CGFloat) {
        cx = 3 * p1x; bx = 3 * (p2x - p1x) - cx; ax = 1 - cx - bx
        cy = 3 * p1y; by = 3 * (p2y - p1y) - cy; ay = 1 - cy - by
    }
    func value(_ x: CGFloat) -> CGFloat {
        let x = min(1, max(0, x))
        if x == 0 || x == 1 { return x }
        var t = x
        for _ in 0..<8 {
            let error = sampleX(t) - x
            if abs(error) < 1e-5 { break }
            let derivative = sampleDerivativeX(t)
            if abs(derivative) < 1e-6 { break }
            t -= error / derivative
        }
        var lower: CGFloat = 0, upper: CGFloat = 1
        for _ in 0..<20 {
            let sampled = sampleX(t)
            if abs(sampled - x) < 1e-5 { break }
            if x > sampled { lower = t } else { upper = t }
            t = (lower + upper) / 2
        }
        return sampleY(t)
    }
    private func sampleX(_ t: CGFloat) -> CGFloat { ((ax * t + bx) * t + cx) * t }
    private func sampleY(_ t: CGFloat) -> CGFloat { ((ay * t + by) * t + cy) * t }
    private func sampleDerivativeX(_ t: CGFloat) -> CGFloat { (3 * ax * t + 2 * bx) * t + cx }
}

enum PageTurnCurve {
    /// Temperate ease-in-out (`cubic-bezier(0.25, 0.1, 0.25, 1)`): the page gathers
    /// and settles smoothly instead of snapping violently.
    static let release = UnitBezier(0.25, 0.1, 0.25, 1)
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
    private var outgoing: UIView?
    private var incoming: UIView?
    private var outgoingImage: UIImageView?
    private var incomingImage: UIImageView?
    private var outgoingVeil: UIView?
    private var incomingVeil: UIView?
    private var outgoingShadow: UIView?
    private var incomingShadow: UIView?
    private var progress: CGFloat = 0
    private var forward = true
    private var advances = true
    private var previewReady = false
    private var requestedCommit: Bool?
    private var resolvingTurn = false
    private var launchVelocity: CGFloat = 0
    private var settlementDriver: PageTurnFrames?
    private var queuedTurns: [Bool] = []
    private var turnInFlight = false
    private var preparingTap = false
    private var stopped = false
    private var tapTransition: EPUBTapTransition?
    private var tapPreparation: Task<Void, Never>?
    private var pendingTaps: [(advancing: Bool, request: EPUBTapTransition.Request)] = []
    let pan = UIPanGestureRecognizer()
    private let zoneTap = UITapGestureRecognizer()

    init(web: WKWebView, reader: EbookReaderState) {
        self.web = web; self.reader = reader
        super.init()
        pan.addTarget(self, action: #selector(dragged))
        pan.delegate = self; pan.maximumNumberOfTouches = 1
        web.addGestureRecognizer(pan)
        zoneTap.addTarget(self, action: #selector(zoneTapped))
        zoneTap.delegate = self; zoneTap.cancelsTouchesInView = false
        web.addGestureRecognizer(zoneTap)
    }
    func prepare() {
        guard !stopped, !turnInFlight, !preparingTap, tapTransition?.isAnimating != true, let web, web.bounds.width > 0 else { return }
        let request = UUID(); snapshotID = request
        let location = reader.location
        Task { [weak self] in
            guard let self else { return }
            let image = await self.captureWebImage(hiding: [])
            guard self.snapshotID == request, self.reader.location == location,
                  !self.turnInFlight, !self.preparingTap, !self.stopped else { return }
            self.snapshot = image
        }
    }
    func pageArrived() {
        if !preparingTap, !turnInFlight, tapTransition?.isAnimating != true { tapTransition?.removeAll() }
        prepare()
    }
    func prime() async {
        snapshotID = UUID()
        let image = await captureWebImage(hiding: [])
        if !stopped { snapshot = image }
    }
    /// Drop a captured page so the next turn re-reads the current appearance
    /// (theme, size, or leading changes would otherwise animate a stale sheet).
    func invalidateSnapshot() {
        snapshotID = UUID(); snapshot = nil
        if tapTransition?.isAnimating != true { tapTransition?.removeAll() }
    }

    /// Launch motion synchronously. Only the EPUB renderer processes a queue.
    func requestTurn(advancing: Bool) {
        guard !stopped, reader.ready, reader.selection == nil, let web else { return }
        if turnInFlight {
            queuedTurns.append(advancing)
            return
        }
        if !preparingTap && pendingTaps.isEmpty {
            guard advancing ? !reader.atEnd : !reader.atStart else { return }
        }
        if UIAccessibility.isReduceMotionEnabled {
            tapTransition?.removeAll()
            reader.navigate(advancing ? "next" : "previous")
            return
        }
        if tapTransition == nil {
            tapTransition = EPUBTapTransition(web: web, radius: displayCornerRadius(for: web), onIdle: { [weak self] in self?.prepare() })
        }
        tapTransition?.cover(image: snapshot)
        guard let request = tapTransition?.begin(advancing: advancing, rightToLeft: reader.rightToLeft) else { return }
        pendingTaps.append((advancing, request))
        snapshotID = UUID()
        renderPendingTaps()
    }

    private func renderPendingTaps() {
        guard !preparingTap else { return }
        preparingTap = true
        tapPreparation = Task { [weak self] in
            guard let self, let web = self.web else { return }
            defer { self.preparingTap = false; self.prepare() }
            if self.tapTransition?.needsSourceImage == true {
                guard let image = await self.captureWebImage(hiding: []), !Task.isCancelled else {
                    self.pendingTaps.removeAll(); self.tapTransition?.removeAll(); return
                }
                self.snapshot = image
                self.tapTransition?.seed(image: image)
            }
            var rendering: [EPUBTapTransition.Request] = []
            while !self.pendingTaps.isEmpty && !Task.isCancelled {
                let batch = self.pendingTaps
                self.pendingTaps.removeAll()
                rendering.append(contentsOf: batch.map(\.request))
                do {
                    _ = try await web.callAsyncJavaScript("return await window.readerTap(actions)",
                        arguments: ["actions": batch.map { $0.advancing ? "next" : "previous" }], in: nil, contentWorld: .page)
                    guard !Task.isCancelled else { return }
                    // New input supersedes intermediate presentation. Catch up
                    // before paying for another bitmap or publishing pagination.
                    if !self.pendingTaps.isEmpty { continue }
                    guard let image = await self.captureWebImage(hiding: []), !Task.isCancelled else {
                        throw CocoaError(.coderInvalidValue)
                    }
                    if !self.pendingTaps.isEmpty { continue }
                    _ = try await web.callAsyncJavaScript("return await window.readerTurn('commit')", arguments: [:], in: nil, contentWorld: .page)
                    guard !Task.isCancelled else { return }
                    self.snapshot = image
                    self.tapTransition?.resolve(rendering, image: image)
                    rendering.removeAll()
                } catch {
                    _ = try? await web.callAsyncJavaScript("return await window.readerTurn('cancel')", arguments: [:], in: nil, contentWorld: .page)
                    self.pendingTaps.removeAll()
                    self.invalidateSnapshot()
                    self.tapTransition?.removeAll()
                }
            }
        }
    }
    func stop() {
        stopped = true
        queuedTurns.removeAll(); pendingTaps.removeAll()
        tapPreparation?.cancel(); tapPreparation = nil
        tapTransition?.removeAll()
        settlementDriver?.stop()
        for view in [outgoing, incoming, outgoingVeil, incomingVeil, outgoingShadow, incomingShadow] { view?.removeFromSuperview() }
        invalidateSnapshot()
    }
    @objc private func zoneTapped(_ gesture: UITapGestureRecognizer) {
        guard let web, reader.ready, reader.selection == nil else { return }
        let point = gesture.location(in: web)
        Task { [weak self] in
            guard let self else { return }
            let side = try? await web.callAsyncJavaScript(
                "return window.readerGutter(x, y)",
                arguments: ["x": point.x / max(1, web.bounds.width), "y": point.y / max(1, web.bounds.height)],
                in: nil, contentWorld: .page) as? String
            guard !self.stopped, let side else { return }
            self.requestTurn(advancing: (side == "right") != self.reader.rightToLeft)
        }
    }
    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
        guard let web else { return false }
        return gestureRecognizer === zoneTap || touch.location(in: web).x > 24
    }
    func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
        guard let web, reader.ready, reader.selection == nil else { return false }
        guard gestureRecognizer === pan else { return true }
        guard !turnInFlight, !preparingTap, tapTransition?.isAnimating != true else { return false }
        let velocity = pan.velocity(in: web)
        guard abs(velocity.x) > abs(velocity.y) * 1.5 else { return false }
        let requestingNext = reader.rightToLeft ? velocity.x > 0 : velocity.x < 0
        return requestingNext ? !reader.atEnd : !reader.atStart
    }
    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool {
        // Let the zone tap coexist with the center-tap chrome toggle and pan gestures.
        true
    }
    @objc private func dragged() {
        guard let web else { return }
        switch pan.state {
        case .began:
            forward = pan.velocity(in: web).x < 0
            advances = reader.rightToLeft ? !forward : forward
            launchVelocity = 0
            if !UIAccessibility.isReduceMotionEnabled {
                beginTurn(advancing: advances, forward: forward)
            }
        case .changed:
            guard !UIAccessibility.isReduceMotionEnabled else { return }
            let translation = pan.translation(in: web)
            let travel = max(0, translation.x * (forward ? -1 : 1))
            progress = PageSlide.progress(travel: travel, width: max(1, web.bounds.width))
            if previewReady { pose() }
        case .ended:
            let raw = pan.velocity(in: web).x * (forward ? -1 : 1)
            launchVelocity = raw / max(1, web.bounds.width)
            if UIAccessibility.isReduceMotionEnabled {
                if PageSlide.commits(progress: progress, velocity: launchVelocity) { reader.navigate(advances ? "next" : "previous") }
                return
            }
            if turnInFlight {
                requestedCommit = PageSlide.commits(progress: progress, velocity: launchVelocity)
                resolveTurn()
            } else if PageSlide.commits(progress: progress, velocity: launchVelocity) {
                reader.navigate(advances ? "next" : "previous")
            }
        case .cancelled, .failed:
            requestedCommit = false; resolveTurn()
        default: break
        }
    }
    private func beginTurn(advancing: Bool, forward: Bool) {
        turnInFlight = true
        advances = advancing; self.forward = forward
        progress = 0; launchVelocity = 0
        previewReady = false; requestedCommit = nil; resolvingTurn = false
        Task { [weak self] in
            guard let self, let web = self.web else { return }
            guard let image = await self.ensureSnapshot(), !self.stopped else { self.resetTurn(); return }
            self.installOverlays(image: image)
            do {
                _ = try await web.callAsyncJavaScript("return await window.readerTurn(action)",
                    arguments: ["action": advancing ? "next" : "previous"], in: nil, contentWorld: .page)
            } catch { self.finish(to: 0, restore: true); return }
            // Overlays live outside the web view, so a snapshot never captures them.
            self.incomingImage?.image = await self.captureWebImage(hiding: [])
            guard !self.stopped else { self.resetTurn(); return }
            self.previewReady = true
            self.pose()
            // Let pagination reflect the page we advanced to without waiting for the glide.
            _ = try? await web.callAsyncJavaScript("window.readerProgress && window.readerProgress()", arguments: [:], in: nil, contentWorld: .page)
            self.resolveTurn()
        }
    }
    private func resolveTurn() {
        guard previewReady, let commit = requestedCommit, !resolvingTurn else { return }
        resolvingTurn = true
        if commit { finish(to: 1) } else { finish(to: 0, restore: true) }
    }
    private func ensureSnapshot() async -> UIImage? {
        if let snapshot { return snapshot }
        return await captureWebImage(hiding: [])
    }
    private func captureWebImage(hiding views: [UIView?]) async -> UIImage? {
        guard let web else { return nil }
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
    private func installOverlays(image: UIImage) {
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
        let incomingImage = pageImage(in: incoming)
        let outgoing = pageContainer()
        let outgoingImage = pageImage(in: outgoing); outgoingImage.image = image
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
        // Hold the page flat under the finger until the destination snapshot exists,
        // otherwise the not-yet-advanced web view shows through and tears.
        let settled = previewReady ? progress : 0
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
        }, completion: { [weak self] in self?.settle(restore: restore) })
        settlementDriver = driver
        driver.start()
    }
    private func settle(restore: Bool) {
        Task { [weak self] in
            guard let self else { return }
            if let web = self.web {
                _ = try? await web.callAsyncJavaScript("return await window.readerTurn(action)",
                    arguments: ["action": restore ? "cancel" : "commit"], in: nil, contentWorld: .page)
            }
            if !restore { self.snapshot = self.incomingImage?.image }
            self.resetTurn()
        }
    }
    private func resetTurn() {
        for view in [outgoing, incoming, outgoingVeil, incomingVeil, outgoingShadow, incomingShadow] { view?.removeFromSuperview() }
        outgoing = nil; incoming = nil; outgoingImage = nil; incomingImage = nil
        outgoingVeil = nil; incomingVeil = nil; outgoingShadow = nil; incomingShadow = nil
        progress = 0; launchVelocity = 0; previewReady = false
        requestedCommit = nil; resolvingTurn = false
        settlementDriver = nil; turnInFlight = false
        prepare()
        if !queuedTurns.isEmpty { requestTurn(advancing: queuedTurns.removeFirst()) }
    }
}

/// One interruptible slide owns the visible pixels. Rendering may replace its
/// destination image, but never starts, pauses, or restarts its motion.
@MainActor final class EPUBTapTransition: NSObject {
    struct Request {
        let id = UUID()
        let index: Int
    }
    private weak var web: WKWebView?
    private let radius: CGFloat
    private let onIdle: () -> Void
    private let clock: () -> CFTimeInterval
    private(set) var stage: UIView?
    private var foreground: UIView?
    private var destination: UIView?
    private var destinationImageView: UIImageView?
    private var foregroundVeil: UIView?
    private var destinationVeil: UIView?
    private var rightToLeft = false
    private var sourceImage: UIImage?
    private var renderedImage: UIImage?
    private var cache: [Int: UIImage] = [:]
    private var latest: Request?
    private var pending: Set<UUID> = []
    private var started: CFTimeInterval = 0
    private var spring = PageTurnSpring(from: 0, target: 1, velocity: 1.8)
    private var velocity: CGFloat = 0
    private var direction: CGFloat = -1
    private var progress: CGFloat = 0
    private var link: CADisplayLink?
    var isAnimating: Bool { link != nil || !pending.isEmpty }
    var needsSourceImage: Bool { sourceImage == nil }

    init(web: WKWebView, radius: CGFloat, clock: @escaping () -> CFTimeInterval = { CACurrentMediaTime() }, onIdle: @escaping () -> Void = {}) {
        self.web = web; self.radius = radius; self.clock = clock; self.onIdle = onIdle
        super.init()
    }

    func cover(image: UIImage?) {
        guard stage == nil, let web else { return }
        let host = web.superview ?? web
        let stage = UIView(frame: host.bounds)
        stage.isUserInteractionEnabled = false
        stage.backgroundColor = web.backgroundColor ?? LeximoryPalette.paperUI
        stage.layer.cornerRadius = radius; stage.layer.cornerCurve = .continuous
        stage.clipsToBounds = true
        self.stage = stage
        if let image {
            sourceImage = image; renderedImage = image
            cache[latest?.index ?? 0] = image
            let visible = page(image: image)
            foreground = visible; stage.addSubview(visible)
            host.addSubview(stage)
        } else {
            // Keep WebKit stationary while it captures the initial bitmap.
            // Capturing a WKWebView during a native transform can return white.
            // UIKit's onscreen snapshot supplies immediate visual feedback.
            let visible = UIView(frame: stage.bounds)
            if let copy = web.snapshotView(afterScreenUpdates: false) {
                copy.frame = web.convert(web.bounds, to: host)
                visible.addSubview(copy)
            }
            foreground = visible; stage.addSubview(visible)
            host.addSubview(stage)

        }
    }

    func seed(image: UIImage) {
        guard sourceImage == nil, let stage, let web else { return }
        sourceImage = image; renderedImage = image
        cache[0] = image
        web.transform = .identity
        let visible = page(image: image)
        stage.addSubview(visible); foreground = visible
        foregroundVeil = addVeil(to: visible)
        installDestination(image: latest.flatMap { cache[$0.index] } ?? image)
        (web.superview ?? web).addSubview(stage)
        pose()
    }

    @discardableResult func begin(advancing: Bool, rightToLeft: Bool) -> Request? {
        guard let web, let stage, foreground != nil else { return nil }
        let carriedVelocity = link == nil ? 0 : velocity
        if sourceImage != nil {
            // Freeze precisely what is visible, including an interrupted turn.
            // The next tap moves this foreground, never a sheet hidden below it.
            let format = UIGraphicsImageRendererFormat()
            format.scale = max(1, web.traitCollection.displayScale); format.opaque = true
            format.preferredRange = .standard
            let composition = autoreleasepool {
                UIGraphicsImageRenderer(bounds: stage.bounds, format: format).image { context in
                    // UIImageView can defer uploading its image until the next
                    // Core Animation commit. Draw the known bitmaps directly so
                    // several taps in one display frame cannot flatten to white.
                    let graphics = context.cgContext
                    graphics.setBlendMode(.normal)
                    (stage.backgroundColor ?? .white).setFill(); graphics.fill(stage.bounds)
                    graphics.addPath(UIBezierPath(roundedRect: stage.bounds, cornerRadius: self.radius).cgPath)
                    graphics.clip()
                    (stage.backgroundColor ?? .white).setFill(); graphics.fill(stage.bounds)
                    for sheet in stage.subviews {
                        graphics.saveGState()
                        graphics.concatenate(sheet.transform)
                        graphics.addPath(UIBezierPath(roundedRect: sheet.bounds, cornerRadius: sheet.layer.cornerRadius).cgPath)
                        graphics.clip()
                        sheet.backgroundColor?.setFill()
                        if sheet.backgroundColor != nil { graphics.fill(sheet.bounds) }
                        if let image = (sheet as? UIImageView)?.image { image.draw(in: sheet.bounds) }
                        for child in sheet.subviews {
                            if let image = child as? UIImageView { image.image?.draw(in: image.frame) }
                            else if child.alpha > 0, let color = child.backgroundColor {
                                color.withAlphaComponent(child.alpha).setFill(); graphics.fill(child.frame)
                            }
                        }
                        graphics.restoreGState()
                    }
                }
            }
            stage.subviews.forEach { $0.removeFromSuperview() }
            let visible = UIImageView(image: composition)
            visible.frame = stage.bounds; visible.contentMode = .scaleToFill
            visible.layer.cornerRadius = radius; visible.layer.cornerCurve = .continuous
            visible.clipsToBounds = true
            stage.addSubview(visible); foreground = visible
            foregroundVeil = addVeil(to: visible)
        }
        self.rightToLeft = rightToLeft
        let request = Request(index: (latest?.index ?? 0) + (advancing ? 1 : -1))
        latest = request; pending.insert(request.id)
        direction = (rightToLeft ? !advancing : advancing) ? -1 : 1
        // Match the swipe-release spring. A small launch velocity gives immediate
        // feedback; repeated taps retain momentum instead of restarting from rest.
        // Reversals launch toward the new page without first braking the old turn.
        spring = PageTurnSpring(from: 0, target: 1, velocity: max(1.8, min(8, carriedVelocity * direction)))
        progress = 0; started = clock()
        if let image = cache[request.index] ?? renderedImage {
            installDestination(image: image)
        }
        pose()
        startFrames()
        return request
    }

    func resolve(_ request: Request, image: UIImage, rightToLeft: Bool) {
        resolve([request], image: image)
    }

    func resolve(_ requests: [Request], image: UIImage) {
        for request in requests { pending.remove(request.id) }
        guard let final = requests.last else { return }
        renderedImage = image
        cache[final.index] = image
        if let latest {
            for index in cache.keys.sorted(by: { abs($0 - latest.index) > abs($1 - latest.index) }).prefix(max(0, cache.count - 8)) {
                cache[index] = nil
            }
            destinationImageView?.image = cache[latest.index] ?? image
        }
        finishIfIdle()
    }

    private func installDestination(image: UIImage) {
        guard let stage, let foreground else { return }
        destination?.removeFromSuperview()
        let incoming = page(image: image)
        destination = incoming
        destinationImageView = incoming.subviews.first as? UIImageView
        destinationVeil = addVeil(to: incoming)
        stage.insertSubview(incoming, belowSubview: foreground)
    }

    private func startFrames() {
        guard link == nil else { return }
        let link = CADisplayLink(target: self, selector: #selector(tick))
        link.preferredFrameRateRange = CAFrameRateRange(minimum: 60, maximum: 120, preferred: 120)
        self.link = link; link.add(to: .main, forMode: .common)
    }

    @objc private func tick(_ link: CADisplayLink) { advance(at: clock()) }

    func advance(at now: CFTimeInterval) {
        let time = CGFloat(min(1, max(0, (now - started) / spring.duration)))
        progress = spring.settledValue(at: time)
        velocity = direction * spring.settledVelocity(at: time)
        pose()
        if time == 1 {
            link?.invalidate(); link = nil
            finishIfIdle()
        }
    }

    private func pose() {
        guard let web else { return }
        let width = max(1, web.bounds.width)
        foreground?.transform = CGAffineTransform(translationX: direction * width * progress, y: 0)
        destination?.transform = CGAffineTransform(translationX: -direction * width * PageSlide.incomingInset * (1 - progress), y: 0)
        applyVeil(foregroundVeil, offset: direction * width * progress, width: width)
        applyVeil(destinationVeil, offset: -direction * width * PageSlide.incomingInset * (1 - progress), width: width)
    }

    private func addVeil(to view: UIView) -> UIView {
        let veil = UIView(frame: view.bounds)
        veil.isUserInteractionEnabled = false
        veil.alpha = 0; view.addSubview(veil)
        return veil
    }

    private func applyVeil(_ veil: UIView?, offset: CGFloat, width: CGFloat) {
        let forwardOffset = rightToLeft ? -offset : offset
        let dark = web?.traitCollection.userInterfaceStyle == .dark
        veil?.backgroundColor = (PageSlide.veilDarkens(forwardOffset: forwardOffset) != dark) ? .black : .white
        veil?.alpha = PageSlide.veilAlpha(forwardOffset: forwardOffset, width: width)
    }

    private func page(image: UIImage) -> UIView {
        let view = UIView(frame: stage?.bounds ?? .zero)
        view.backgroundColor = web?.backgroundColor ?? LeximoryPalette.paperUI
        view.layer.cornerRadius = radius; view.layer.cornerCurve = .continuous
        view.clipsToBounds = true
        let imageView = UIImageView(image: image)
        if let web, let stage { imageView.frame = web.convert(web.bounds, to: stage) }
        imageView.contentMode = .scaleToFill
        view.addSubview(imageView)
        return view
    }

    private func finishIfIdle() {
        guard link == nil, pending.isEmpty else { return }
        // The underlying renderer is already on the final page. Keep recent
        // bitmaps across turns so going back can reveal real text immediately.
        clearPresentation(); onIdle()
    }

    private func clearPresentation() {
        web?.transform = .identity
        stage?.removeFromSuperview(); stage = nil
        foreground = nil; destination = nil; destinationImageView = nil
        foregroundVeil = nil; destinationVeil = nil
        sourceImage = nil; renderedImage = nil
        velocity = 0
    }

    func removeAll() {
        link?.invalidate(); link = nil
        clearPresentation()
        cache.removeAll(); pending.removeAll(); latest = nil
    }
}

/// A single trajectory carries the finger's velocity into a stationary endpoint.
struct PageTurnSettlement {
    let start: CGFloat
    let target: CGFloat
    let velocity: CGFloat
    let duration: Double

    init(start: CGFloat, target: CGFloat, velocity: CGFloat) {
        self.start = start; self.target = target; self.velocity = velocity
        // Limit the Hermite tangent to prevent overshooting either page boundary.
        let distance = abs(target - start)
        let available = velocity * (target - start) >= 0 ? distance : min(start, 1 - start)
        let preferred = min(0.5, max(0.22, Double(distance) * 0.5))
        duration = abs(velocity) > 0.001 ? min(preferred, max(0.001, Double(3 * available / abs(velocity)))) : preferred
    }

    func value(at time: CGFloat) -> CGFloat {
        let t = min(1, max(0, time))
        let t2 = t * t, t3 = t2 * t
        return (2 * t3 - 3 * t2 + 1) * start
            + (t3 - 2 * t2 + t) * velocity * CGFloat(duration)
            + (-2 * t3 + 3 * t2) * target
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
    var isRunning: Bool { link != nil }
    func stop() { link?.invalidate(); link = nil }
}
