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
        let bookmark = UIAction(title: "🔖书签", image: UIImage(systemName: "bookmark"), attributes: reader.canBookmark && !reader.savingBookmark && !reader.readOnly ? [] : .disabled) { _ in
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
        if (0.25...0.75).contains(x) { reader.chromeVisible.toggle() }
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
    /// The strip places every page by its distance from the shared position:
    /// pages already passed travel fully off; pages ahead arrive from the short
    /// inset. A decreasing position (retreating) mirrors this automatically.
    static func stripOffset(index: Int, position: CGFloat, width: CGFloat) -> CGFloat {
        let k = CGFloat(index)
        if k <= position { return -width * min(1, position - k) }
        return incomingInset * width * min(1, k - position)
    }

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
    /// Ease-out-quint (`cubic-bezier(0.22, 1, 0.36, 1)`): a tap launches the
    /// page from rest and snaps it off with a fast, decisive start.
    static let tap = UnitBezier(0.22, 1, 0.36, 1)
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
}

@MainActor final class EPUBPageTurn: NSObject, UIGestureRecognizerDelegate {
    private weak var web: WKWebView?
    private let reader: EbookReaderState

    private struct Layer {
        let container: UIView
        let imageView: UIImageView
        let veil: UIView
        let shadow: UIView
    }
    private enum Phase { case idle, dragging, settling, committing }

    private var images: [Int: UIImage] = [:]
    private var layers: [Int: Layer] = [:]
    private var committedIndex = 0
    private var desiredIndex = 0
    private var position: CGFloat = 0
    private var phase: Phase = .idle
    private var dragStep = 1
    private var dragPositionPerX: CGFloat = -1
    private var isEnsuring = false
    private var ensureTask: Task<Void, Never>?
    private var driver: PageSpringDriver?
    private var snapshotID = UUID()
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
        guard phase == .idle, let web, web.bounds.width > 0 else { return }
        let request = UUID(); snapshotID = request
        let location = reader.location
        let configuration = WKSnapshotConfiguration(); configuration.afterScreenUpdates = true
        web.takeSnapshot(with: configuration) { [weak self] image, _ in
            guard let self, self.snapshotID == request, self.reader.location == location,
                  self.phase == .idle, let image else { return }
            self.images[self.committedIndex] = image
        }
    }
    func pageArrived() { prepare() }
    /// Drop captured pages so the next turn re-reads the current appearance
    /// (theme, size, or leading changes would otherwise animate a stale sheet).
    func invalidateSnapshot() {
        snapshotID = UUID()
        guard phase == .idle else { return }
        for index in layers.keys { removeLayer(index) }
        images.removeAll()
        prepare()
    }

    /// A tap in a far edge turns one page in the language's reading direction.
    /// Each tap just moves the shared strip one step; the running spring is
    /// retargeted and every page in flight keeps moving together.
    func requestTurn(advancing: Bool) {
        guard reader.ready, reader.selection == nil else { return }
        if UIAccessibility.isReduceMotionEnabled { reader.navigate(advancing ? "next" : "previous"); return }
        if phase == .idle, advancing ? reader.atEnd : reader.atStart { return }
        desiredIndex += advancing ? 1 : -1
        if phase == .idle {
            phase = .settling
            Task { [weak self] in
                guard let self else { return }
                if self.images[self.committedIndex] == nil { self.images[self.committedIndex] = await self.captureWebImage() }
                if let image = self.images[self.committedIndex] { self.addLayer(index: self.committedIndex, image: image) }
                self.ensureImages()
                self.updateDriverTarget()
            }
        } else {
            ensureImages()
            updateDriverTarget()
        }
    }
    @objc private func zoneTapped(_ gesture: UITapGestureRecognizer) {
        guard let view = gesture.view, reader.ready, reader.selection == nil else { return }
        let x = gesture.location(in: view).x / max(1, view.bounds.width)
        guard x < 0.25 || x > 0.75 else { return }
        requestTurn(advancing: x < 0.25 ? reader.rightToLeft : !reader.rightToLeft)
    }
    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
        guard let web else { return false }
        return touch.location(in: web).x > 24
    }
    func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
        guard let web, reader.ready, reader.selection == nil else { return false }
        guard gestureRecognizer === pan else { return true }
        guard phase == .idle else { return false }
        let velocity = pan.velocity(in: web)
        guard abs(velocity.x) > abs(velocity.y) * 1.5 else { return false }
        let advancing = reader.rightToLeft ? velocity.x > 0 : velocity.x < 0
        return advancing ? !reader.atEnd : !reader.atStart
    }
    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool {
        // Let the zone tap coexist with the center-tap chrome toggle and pan gestures.
        true
    }
    @objc private func dragged() {
        guard let web else { return }
        switch pan.state {
        case .began:
            guard phase == .idle else { return }
            let vx = pan.velocity(in: web).x
            let advancing = reader.rightToLeft ? vx > 0 : vx < 0
            dragStep = advancing ? 1 : -1
            dragPositionPerX = advancing ? (reader.rightToLeft ? 1 : -1) : (reader.rightToLeft ? -1 : 1)
            phase = .dragging
            position = CGFloat(committedIndex)
            desiredIndex = committedIndex + dragStep
            Task { [weak self] in
                guard let self else { return }
                if self.images[self.committedIndex] == nil { self.images[self.committedIndex] = await self.captureWebImage() }
                if let image = self.images[self.committedIndex] { self.addLayer(index: self.committedIndex, image: image) }
                self.ensureImages()
            }
        case .changed:
            guard phase == .dragging else { return }
            let width = max(1, web.bounds.width)
            let raw = CGFloat(committedIndex) + pan.translation(in: web).x * dragPositionPerX / width
            let lower = min(committedIndex, desiredIndex), upper = max(committedIndex, desiredIndex)
            let minLoaded = images.keys.min() ?? committedIndex, maxLoaded = images.keys.max() ?? committedIndex
            position = min(max(raw, CGFloat(max(lower, minLoaded))), CGFloat(min(upper, maxLoaded)))
            render()
        case .ended:
            guard phase == .dragging else { return }
            let positionVelocity = pan.velocity(in: web).x * dragPositionPerX / max(1, web.bounds.width)
            let progress = abs(position - CGFloat(committedIndex))
            let commit = PageSlide.commits(progress: progress, velocity: positionVelocity * CGFloat(dragStep))
            desiredIndex = committedIndex + (commit ? dragStep : 0)
            phase = .settling
            ensureImages()
            startDriver(velocity: positionVelocity)
        case .cancelled, .failed:
            guard phase == .dragging else { return }
            desiredIndex = committedIndex
            phase = .settling
            startDriver(velocity: 0)
        default: break
        }
    }

    // MARK: page strip

    /// Step the web view toward the desired page, capturing a snapshot of each
    /// page as it arrives so the strip always has art for what it reveals.
    private func ensureImages() {
        guard !isEnsuring else { return }
        isEnsuring = true
        ensureTask = Task { [weak self] in
            guard let self else { return }
            while !Task.isCancelled {
                let target = self.desiredIndex
                guard self.committedIndex != target, let web = self.web else { break }
                let step = target > self.committedIndex ? 1 : -1
                do {
                    _ = try await web.callAsyncJavaScript("return await window.readerTurn(action)",
                        arguments: ["action": step > 0 ? "next" : "previous"], in: nil, contentWorld: .page)
                } catch { break }
                self.committedIndex += step
                if let image = await self.captureWebImage() { self.addLayer(index: self.committedIndex, image: image) }
                self.updateDriverTarget()
            }
            self.isEnsuring = false
            self.ensureTask = nil
            if self.committedIndex != self.desiredIndex { self.ensureImages() }
        }
    }
    private func addLayer(index: Int, image: UIImage) {
        images[index] = image
        guard layers[index] == nil, let web else { return }
        let host = web.superview ?? web
        let stage = host.bounds
        let paper = web.backgroundColor ?? LeximoryPalette.paperUI
        let radius = displayCornerRadius(for: web)
        let container = UIView(frame: stage)
        container.backgroundColor = paper
        container.isUserInteractionEnabled = false
        container.layer.cornerRadius = radius
        container.layer.cornerCurve = .continuous
        container.clipsToBounds = radius > 0
        let imageView = UIImageView(frame: web.convert(web.bounds, to: container))
        imageView.image = image; imageView.contentMode = .scaleToFill; imageView.isUserInteractionEnabled = false
        container.addSubview(imageView)
        let veil = UIView(frame: stage)
        veil.isUserInteractionEnabled = false; veil.alpha = 0
        veil.layer.cornerRadius = radius; veil.layer.cornerCurve = .continuous; veil.clipsToBounds = radius > 0
        let shadow = UIView(frame: stage)
        shadow.isUserInteractionEnabled = false; shadow.backgroundColor = .clear
        shadow.layer.shadowColor = UIColor.black.cgColor
        shadow.layer.shadowOpacity = 0.06
        shadow.layer.shadowRadius = 12
        shadow.layer.shadowOffset = .zero
        shadow.layer.shadowPath = UIBezierPath(roundedRect: shadow.bounds, cornerRadius: radius).cgPath
        let z = CGFloat(-index)
        shadow.layer.zPosition = z - 0.5
        container.layer.zPosition = z
        veil.layer.zPosition = z + 0.5
        host.addSubview(shadow); host.addSubview(container); host.addSubview(veil)
        layers[index] = Layer(container: container, imageView: imageView, veil: veil, shadow: shadow)
        render()
    }
    private func removeLayer(_ index: Int) {
        guard let layer = layers.removeValue(forKey: index) else { return }
        layer.container.removeFromSuperview(); layer.veil.removeFromSuperview(); layer.shadow.removeFromSuperview()
    }
    private func render() {
        guard let web else { return }
        let width = max(1, web.bounds.width)
        let dark = web.traitCollection.userInterfaceStyle == .dark
        for (index, layer) in layers {
            let offset = PageSlide.stripOffset(index: index, position: position, width: width)
            let transform = CGAffineTransform(translationX: offset, y: 0)
            layer.container.transform = transform
            layer.veil.transform = transform
            layer.shadow.transform = transform
            let forwardOffset = reader.rightToLeft ? -offset : offset
            layer.veil.backgroundColor = (PageSlide.veilDarkens(forwardOffset: forwardOffset) != dark) ? .black : .white
            layer.veil.alpha = PageSlide.veilAlpha(forwardOffset: forwardOffset, width: width)
        }
    }
    private func clampedDesired() -> CGFloat {
        guard let minimum = images.keys.min(), let maximum = images.keys.max() else { return CGFloat(committedIndex) }
        return CGFloat(min(max(desiredIndex, minimum), maximum))
    }
    private func updateDriverTarget() {
        guard phase == .settling else { return }
        let target = clampedDesired()
        if let driver, driver.isRunning { driver.target = target } else { startDriver(velocity: 0) }
    }
    private func startDriver(velocity: CGFloat) {
        let driver = PageSpringDriver(position: position, velocity: velocity, target: clampedDesired(), omega: 9)
        driver.update = { [weak self] value in self?.position = value; self?.render() }
        driver.canComplete = { [weak self] in
            guard let self else { return true }
            // Only finish once the strip has actually arrived at the wanted page,
            // not merely once the snapshot for it has been captured.
            return self.committedIndex == self.desiredIndex
                && abs(self.position - CGFloat(self.desiredIndex)) < 0.0005
        }
        driver.completion = { [weak self] in self?.completeStrip() }
        self.driver = driver
        driver.start()
    }
    private func completeStrip() {
        guard phase == .settling else { return }
        phase = .committing
        driver?.stop(); driver = nil
        Task { [weak self] in
            guard let self else { return }
            await self.ensureTask?.value
            _ = try? await self.web?.callAsyncJavaScript("return await window.readerTurn('commit')",
                arguments: [:], in: nil, contentWorld: .page)
            self.cleanupAfterSettle()
        }
    }
    private func cleanupAfterSettle() {
        position = CGFloat(committedIndex)
        let keep = Set((committedIndex - 2)...(committedIndex + 2))
        for index in layers.keys where !keep.contains(index) { removeLayer(index) }
        for index in images.keys where !keep.contains(index) { images.removeValue(forKey: index) }
        phase = .idle
        driver = nil
        render()
        prepare()
        // Taps that arrived while committing continue the strip at once.
        if committedIndex != desiredIndex {
            phase = .settling
            ensureImages()
            updateDriverTarget()
        }
    }
    private func captureWebImage() async -> UIImage? {
        guard let web else { return nil }
        let configuration = WKSnapshotConfiguration(); configuration.afterScreenUpdates = true
        return await withCheckedContinuation { continuation in
            web.takeSnapshot(with: configuration) { image, _ in continuation.resume(returning: image) }
        }
    }
    private func displayCornerRadius(for view: UIView) -> CGFloat {
        let selector = NSSelectorFromString("_displayCornerRadius")
        guard let screen = view.window?.screen, screen.responds(to: selector) else { return 0 }
        return (screen.value(forKey: "_displayCornerRadius") as? NSNumber).map { CGFloat($0.doubleValue) } ?? 0
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

/// A retargetable critically damped spring. Setting a new target mid-flight
/// keeps the current position and velocity, so a quick tap only redirects the
/// running motion instead of starting a separate animation.
@MainActor private final class PageSpringDriver: NSObject {
    var target: CGFloat
    private(set) var position: CGFloat
    private var velocity: CGFloat
    private let omega: CGFloat
    var update: ((CGFloat) -> Void)?
    var canComplete: (() -> Bool)?
    var completion: (() -> Void)?
    private var link: CADisplayLink?
    private var last: CFTimeInterval = 0
    private var startPosition: CGFloat

    init(position: CGFloat, velocity: CGFloat, target: CGFloat, omega: CGFloat) {
        self.position = position; self.startPosition = position
        self.velocity = velocity; self.target = target; self.omega = omega
        super.init()
    }
    func start() {
        update?(position)
        last = CACurrentMediaTime()
        let link = CADisplayLink(target: self, selector: #selector(tick))
        link.preferredFrameRateRange = CAFrameRateRange(minimum: 60, maximum: 120, preferred: 120)
        self.link = link; link.add(to: .main, forMode: .common)
    }
    @objc private func tick(_ link: CADisplayLink) {
        let now = link.timestamp
        let dt = CGFloat(min(1.0 / 30.0, max(0, now - last))); last = now
        let acceleration = omega * omega * (target - position) - 2 * omega * velocity
        velocity += acceleration * dt
        position += velocity * dt
        // Never overshoot the endpoints, so a page never reveals an unloaded neighbour.
        let low = min(startPosition, target), high = max(startPosition, target)
        if position > high { position = high; velocity = min(0, velocity) }
        if position < low { position = low; velocity = max(0, velocity) }
        update?(position)
        guard abs(target - position) < 0.0005, abs(velocity) < 0.005 else { return }
        position = target; velocity = 0
        update?(position)
        if canComplete?() ?? true { stop(); completion?() }
    }
    var isRunning: Bool { link != nil }
    func stop() { link?.invalidate(); link = nil }
}
