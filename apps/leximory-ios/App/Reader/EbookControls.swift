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

struct PageCurlGeometry {
    let angle: CGFloat
    let axisX: CGFloat
    let axisY: CGFloat

    init(progress: CGFloat, fraction: CGFloat, touch: CGPoint, travelY: CGFloat, forward: Bool, motion: CGVector = .zero) {
        let phase = sin(progress * .pi)
        let focus = forward ? touch.x : 1 - touch.x
        let proximity = exp(-pow((fraction - focus) * 2.6, 2))
        let pull = max(-1, min(1, motion.dx * (forward ? -1 : 1)))
        let tension = 1 + pull * 0.18
        let bend = sin(fraction * .pi) * phase * (0.36 + proximity * 0.35) * tension
        let verticalMotion = max(-1, min(1, motion.dy))
        let tilt = ((0.5 - touch.y) * 0.45 + max(-0.5, min(0.5, travelY)) * 0.35 + verticalMotion * 0.12) * phase
        angle = (progress * .pi + bend) * (forward ? -1 : 1)
        axisX = sin(tilt)
        axisY = cos(tilt)
    }
}

enum PageCurlFacet {
    static func transform(angle: CGFloat, slope: CGFloat) -> CATransform3D {
        var transform = CATransform3DMakeRotation(angle, 0, 1, 0)
        transform.m12 = slope * cos(angle)
        return transform
    }
}

enum IncomingPageCurl {
    static func phase(_ progress: CGFloat) -> CGFloat {
        acos(min(1, max(0, progress))) / .pi
    }
    static func angle(progress: CGFloat, curvedAngle: CGFloat) -> CGFloat {
        let hinge = phase(progress) * .pi
        let availableBend = (.pi / 2 - hinge) * 0.25
        guard availableBend > 0.000001 else { return -hinge }
        return -hinge - availableBend * tanh(max(0, curvedAngle - hinge) / availableBend)
    }
}

@MainActor final class EPUBPageTurn: NSObject, UIGestureRecognizerDelegate {
    private weak var web: WKWebView?
    private let reader: EbookReaderState
    private var snapshot: UIImage?
    private var snapshotID = UUID()
    private var paper: UIView?
    private var underneath: UIImageView?
    private var strips: [CALayer] = []
    private var backs: [CALayer] = []
    private var shades: [CALayer] = []
    private var backShades: [CALayer] = []
    private var progress: CGFloat = 0
    private var touchOrigin = CGPoint(x: 0.5, y: 0.5)
    private var travelY: CGFloat = 0
    private var motion = CGVector.zero
    private var releaseVelocity: CGFloat = 0
    private var castShadow: CAGradientLayer?
    private var forward = true
    private var previewReady = false
    private var requestedCommit: Bool?
    private var resolvingTurn = false
    private var settlementDriver: PageTurnFrames?
    let pan = UIPanGestureRecognizer()

    init(web: WKWebView, reader: EbookReaderState) {
        self.web = web; self.reader = reader
        super.init()
        pan.addTarget(self, action: #selector(dragged))
        pan.delegate = self; pan.maximumNumberOfTouches = 1
        web.addGestureRecognizer(pan)
    }
    func prepare() {
        guard paper == nil, let web, web.bounds.width > 0 else { return }
        snapshot = nil
        let request = UUID(); snapshotID = request
        let location = reader.location
        let configuration = WKSnapshotConfiguration(); configuration.afterScreenUpdates = true
        web.takeSnapshot(with: configuration) { [weak self] image, _ in
            guard let self, self.snapshotID == request, self.reader.location == location,
                  self.paper == nil, self.settlementDriver == nil else { return }
            self.snapshot = image
        }
    }
    func pageArrived() {
        prepare()
    }
    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
        guard let web else { return false }
        return touch.location(in: web).x > 24
    }
    func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
        guard let web, reader.ready, reader.selection == nil, settlementDriver == nil, paper == nil else { return false }
        let velocity = pan.velocity(in: web)
        guard abs(velocity.x) > abs(velocity.y) * 1.5 else { return false }
        return velocity.x < 0 ? !reader.atEnd : !reader.atStart
    }
    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool { other is UIPanGestureRecognizer }
    @objc private func dragged() {
        guard let web else { return }
        switch pan.state {
        case .began:
            forward = pan.velocity(in: web).x < 0
            let translation = pan.translation(in: web)
            let point = pan.location(in: web)
            touchOrigin = CGPoint(x: min(1, max(0, (point.x - translation.x) / web.bounds.width)),
                                  y: min(1, max(0, (point.y - translation.y) / web.bounds.height)))
            travelY = 0; releaseVelocity = 0; motion = .zero
            if !UIAccessibility.isReduceMotionEnabled { makePaper() }
            if paper != nil { beginPreview() }
        case .changed:
            progress = min(1, max(0, pan.translation(in: web).x * (forward ? -1 : 1) / (web.bounds.width * 0.9)))
            travelY = pan.translation(in: web).y / max(1, web.bounds.height)
            let velocity = pan.velocity(in: web)
            motion = CGVector(dx: motion.dx * 0.65 + velocity.x / max(1, web.bounds.width) * 0.35,
                              dy: motion.dy * 0.65 + velocity.y / max(1, web.bounds.height) * 0.35)
            if previewReady { pose(progress) }
        case .ended:
            let velocity = pan.velocity(in: web).x * (forward ? -1 : 1)
            releaseVelocity = velocity
            let projected = progress + velocity / web.bounds.width * 0.16
            let commit = velocity >= -180 && (projected > 0.22 || (progress > 0.04 && velocity > 450))
            if paper == nil {
                if commit { reader.navigate(forward ? "next" : "previous") }
                progress = 0
            } else { requestedCommit = commit; resolveTurn() }
        case .cancelled, .failed:
            requestedCommit = false; resolveTurn()
        default: break
        }
    }
    private func beginPreview() {
        previewReady = false; requestedCommit = nil; resolvingTurn = false
        Task { [weak self] in
            guard let self, let web else { return }
            do {
                _ = try await web.callAsyncJavaScript("return await window.readerTurn(action)",
                    arguments: ["action": forward ? "next" : "previous"], in: nil, contentWorld: .page)
                if !forward {
                    let configuration = WKSnapshotConfiguration()
                    configuration.afterScreenUpdates = true
                    let image: UIImage? = await withCheckedContinuation { continuation in
                        web.takeSnapshot(with: configuration) { image, _ in continuation.resume(returning: image) }
                    }
                    guard let image = image?.cgImage else { finish(to: 0, restore: true); return }
                    for index in strips.indices {
                        strips[index].contents = image
                        backs[index].sublayers?.first?.contents = image
                    }
                    paper?.isHidden = false
                }
                previewReady = true
                pose(progress)
                resolveTurn()
            } catch { finish(to: 0) }
        }
    }
    private func resolveTurn() {
        guard previewReady, let commit = requestedCommit, !resolvingTurn else { return }
        resolvingTurn = true
        if !commit { finish(to: 0, restore: true); return }
        finish(to: 1)
    }
    private func makePaper() {
        guard let web, let image = snapshot?.cgImage else { return }
        let host = forward ? web : (web.superview ?? web)
        let frame = web.convert(web.bounds, to: host)
        let paper = UIView(frame: frame); paper.isUserInteractionEnabled = false
        if !forward {
            let underneath = UIImageView(image: snapshot)
            underneath.frame = frame; underneath.isUserInteractionEnabled = false
            // Keep the current-page cover outside the view being captured.
            // Otherwise the incoming snapshot can capture the cover itself.
            host.addSubview(underneath); self.underneath = underneath
            paper.isHidden = true
        }
        paper.layer.sublayerTransform = CATransform3DIdentity
        paper.layer.sublayerTransform.m34 = -1 / (web.bounds.width * 4)
        let shadow = CAGradientLayer()
        shadow.colors = [UIColor.clear.cgColor, UIColor.black.withAlphaComponent(0.22).cgColor, UIColor.clear.cgColor]
        shadow.startPoint = CGPoint(x: 0, y: 0.5); shadow.endPoint = CGPoint(x: 1, y: 0.5)
        web.layer.addSublayer(shadow); castShadow = shadow
        for index in 0..<24 {
            let strip = CALayer()
            strip.contents = image
            strip.contentsRect = CGRect(x: CGFloat(index) / 24, y: 0, width: 1.0 / 24, height: 1)
            strip.bounds = CGRect(x: 0, y: 0, width: web.bounds.width / 24 + 0.5, height: web.bounds.height)
            strip.anchorPoint = CGPoint(x: 0, y: 0.5)
            strip.isDoubleSided = true
            let shade = CALayer(); shade.frame = strip.bounds
            shade.backgroundColor = UIColor.black.cgColor; shade.opacity = 0
            strip.addSublayer(shade)
            let back = CALayer(); back.bounds = strip.bounds; back.anchorPoint = strip.anchorPoint
            back.backgroundColor = web.backgroundColor?.resolvedColor(with: web.traitCollection).cgColor; back.isDoubleSided = true
            let bleed = CALayer(); bleed.frame = back.bounds
            bleed.contents = image; bleed.contentsRect = strip.contentsRect
            bleed.transform = CATransform3DMakeScale(-1, 1, 1); bleed.opacity = 0.055
            back.addSublayer(bleed)
            let backShade = CALayer(); backShade.frame = back.bounds
            backShade.backgroundColor = UIColor.black.cgColor; backShade.opacity = 0
            back.addSublayer(backShade)
            shades.append(shade); backShades.append(backShade)
            paper.layer.addSublayer(back); paper.layer.addSublayer(strip)
            strips.append(strip); backs.append(back)
        }
        host.addSubview(paper); self.paper = paper
        pose(0)
    }
    private func pose(_ value: CGFloat, motionScale: CGFloat = 1) {
        guard let paper else { return }
        CATransaction.begin(); CATransaction.setDisableActions(true)
        let width = paper.bounds.width / 24
        let scaledMotion = CGVector(dx: motion.dx * motionScale, dy: motion.dy * motionScale)
        let orientation = PageCurlGeometry(progress: value, fraction: 0, touch: touchOrigin,
                                           travelY: travelY, forward: forward, motion: scaledMotion)
        // The binding is fixed. Finger tilt deforms the free sheet away from
        // that edge, rather than rotating the entire page about its centre.
        var perspective = CATransform3DIdentity
        perspective.m34 = -1 / (paper.bounds.width * 4)
        paper.layer.sublayerTransform = perspective
        let slope = orientation.axisX * 0.35
        var x: CGFloat = 0, z: CGFloat = 0
        for order in 0..<24 {
            let index = order
            let curl = PageCurlGeometry(progress: forward ? value : IncomingPageCurl.phase(value), fraction: CGFloat(order) / 24,
                                        touch: touchOrigin, travelY: travelY, forward: forward,
                                        motion: scaledMotion)
            let angle = forward ? curl.angle : IncomingPageCurl.angle(progress: value, curvedAngle: curl.angle)
            for layer in [strips[index], backs[index]] {
                layer.position = CGPoint(x: x, y: paper.bounds.midY + slope * x); layer.zPosition = z
            }
            let shade = Float(abs(sin(angle)) * 0.16)
            shades[index].opacity = shade; backShades[index].opacity = shade * 0.8
            let transform = PageCurlFacet.transform(angle: angle, slope: slope)
            strips[index].transform = transform
            backs[index].transform = transform
            // Both faces occupy the same facet. Rotating the back by an extra π
            // about its leading edge moved it into its neighbour's space.
            strips[index].isHidden = cos(angle) < 0
            backs[index].isHidden = cos(angle) >= 0
            x += width * cos(angle)
            z += -width * sin(angle)
        }
        let shadowWidth = paper.bounds.width * (0.08 + sin(value * .pi) * 0.12)
        castShadow?.frame = CGRect(x: max(0, min(paper.bounds.width - shadowWidth, x - shadowWidth / 2)),
                                  y: 0, width: shadowWidth, height: paper.bounds.height)
        castShadow?.opacity = Float(sin(value * .pi))
        CATransaction.commit()
    }
    private func finish(to target: CGFloat, restore: Bool = false) {
        guard paper != nil, let web else { progress = 0; prepare(); return }
        let trajectory = PageTurnSettlement(start: progress, target: target,
            velocity: releaseVelocity / (web.bounds.width * 0.9))
        let driver = PageTurnFrames(duration: trajectory.duration, update: { [weak self] elapsed in
            self?.pose(trajectory.value(at: elapsed), motionScale: 1 - elapsed * elapsed * (3 - 2 * elapsed))
        }, completion: { [weak self] in
            Task { [weak self] in
                guard let self else { return }
                if let web = self.web {
                    let action = restore ? "cancel" : "commit"
                    _ = try? await web.callAsyncJavaScript("return await window.readerTurn(action)",
                        arguments: ["action": action], in: nil, contentWorld: .page)
                }
                paper?.removeFromSuperview(); paper = nil
                underneath?.removeFromSuperview(); underneath = nil
                castShadow?.removeFromSuperlayer(); castShadow = nil
                strips = []; backs = []; shades = []; backShades = []
                progress = 0; settlementDriver = nil; previewReady = false
                requestedCommit = nil; resolvingTurn = false
                prepare()
            }
        })
        settlementDriver = driver
        driver.start()
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
    func stop() { link?.invalidate(); link = nil }
}
