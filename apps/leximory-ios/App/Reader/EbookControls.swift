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
    func colors(dark: Bool) -> (paper: String, ink: String) {
        switch self {
        case .automatic: dark ? ("#100f0f", "#f1f3ef") : ("#ffffff", "#192024")
        case .paper: ("#ffffff", "#192024")
        case .sepia: ("#f5f0e5", "#37372e")
        case .night: ("#100f0f", "#f1f3ef")
        }
    }
}

@MainActor enum EbookLearningMenu {
    static func insert(into builder: UIMenuBuilder, reader: EbookReaderState) {
        guard builder.system == .context else { return }
        let selection = reader.selection
        let define = UIAction(title: "查词", image: UIImage(systemName: "text.magnifyingglass"), attributes: reader.readOnly ? .disabled : []) { _ in
            if let selection = selection ?? reader.menuSelection { reader.selectionAction = EbookSelectionAction(kind: .define, selection: selection) }
        }
        let bookmark = UIAction(title: "收藏", image: UIImage(systemName: "bookmark"), attributes: reader.canBookmark && !reader.savingBookmark && !reader.readOnly ? [] : .disabled) { _ in
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

@MainActor final class EPUBPageTurn: NSObject, UIGestureRecognizerDelegate {
    private weak var web: WKWebView?
    private let reader: EbookReaderState
    private var snapshot: UIImage?
    private var snapshotID = UUID()
    private var paper: UIView?
    private var strips: [CALayer] = []
    private var backs: [CALayer] = []
    private var shades: [CALayer] = []
    private var backShades: [CALayer] = []
    private var progress: CGFloat = 0
    private var forward = true
    private var previewReady = false
    private var requestedCommit: Bool?
    private var resolvingTurn = false
    private var animator: UIViewPropertyAnimator?
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
                  self.paper == nil, self.animator == nil else { return }
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
        guard let web, reader.ready, reader.selection == nil, animator == nil, paper == nil else { return false }
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
            if !UIAccessibility.isReduceMotionEnabled { makePaper() }
            if paper != nil { beginPreview() }
        case .changed:
            progress = min(0.85, max(0, pan.translation(in: web).x * (forward ? -1 : 1) / web.bounds.width))
            if previewReady { pose(progress) }
        case .ended:
            let velocity = pan.velocity(in: web).x * (forward ? -1 : 1)
            let commit = progress > 0.2 || velocity > 350
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
        Task { [weak self] in
            guard let self, let web else { return }
            do {
                _ = try await web.callAsyncJavaScript("return await window.readerTurn('commit')",
                    arguments: [:], in: nil, contentWorld: .page)
                finish(to: 1)
            } catch { finish(to: 0, restore: true) }
        }
    }
    private func makePaper() {
        guard let web, let image = snapshot?.cgImage else { return }
        let paper = UIView(frame: web.bounds); paper.isUserInteractionEnabled = false
        paper.layer.sublayerTransform = CATransform3DIdentity
        paper.layer.sublayerTransform.m34 = -1 / (web.bounds.width * 4)
        for index in 0..<16 {
            let strip = CALayer()
            strip.contents = image
            strip.contentsRect = CGRect(x: CGFloat(index) / 16, y: 0, width: 1.0 / 16, height: 1)
            strip.bounds = CGRect(x: 0, y: 0, width: web.bounds.width / 16 + 0.5, height: web.bounds.height)
            strip.anchorPoint = CGPoint(x: forward ? 0 : 1, y: 0.5)
            strip.isDoubleSided = false
            let shade = CALayer(); shade.frame = strip.bounds
            shade.backgroundColor = UIColor.black.cgColor; shade.opacity = 0
            strip.addSublayer(shade)
            let back = CALayer(); back.bounds = strip.bounds; back.anchorPoint = strip.anchorPoint
            back.backgroundColor = web.backgroundColor?.cgColor; back.isDoubleSided = false
            let backShade = CALayer(); backShade.frame = back.bounds
            backShade.backgroundColor = UIColor.black.cgColor; backShade.opacity = 0
            back.addSublayer(backShade)
            shades.append(shade); backShades.append(backShade)
            paper.layer.addSublayer(back); paper.layer.addSublayer(strip)
            strips.append(strip); backs.append(back)
        }
        web.addSubview(paper); self.paper = paper
        pose(0)
    }
    private func pose(_ value: CGFloat) {
        guard let paper else { return }
        CATransaction.begin(); CATransaction.setDisableActions(true)
        let width = paper.bounds.width / 16
        var x: CGFloat = forward ? 0 : paper.bounds.width, z: CGFloat = 0
        for order in 0..<16 {
            let index = forward ? order : 15 - order
            let bend = sin(CGFloat(order) / 16 * .pi) * sin(value * .pi) * 0.55
            let angle = (value * .pi + bend) * (forward ? -1 : 1)
            for layer in [strips[index], backs[index]] {
                layer.position = CGPoint(x: x, y: paper.bounds.midY); layer.zPosition = z
            }
            let shadow = Float(abs(sin(angle)) * 0.09)
            shades[index].opacity = shadow; backShades[index].opacity = shadow
            strips[index].transform = CATransform3DMakeRotation(angle, 0, 1, 0)
            backs[index].transform = CATransform3DMakeRotation(angle + .pi, 0, 1, 0)
            x += width * cos(angle) * (forward ? 1 : -1)
            z += -width * sin(angle) * (forward ? 1 : -1)
        }
        CATransaction.commit()
    }
    private func finish(to target: CGFloat, restore: Bool = false) {
        guard paper != nil else { progress = 0; prepare(); return }
        let start = progress
        let animation = UIViewPropertyAnimator(duration: 0.28, curve: .easeOut)
        // A display link advances the curved strips alongside the native animator.
        let driver = PageTurnFrames(duration: 0.28) { [weak self] fraction in
            self?.pose(start + (target - start) * fraction)
        }
        animation.addAnimations { self.paper?.alpha = target == 1 ? 0.99 : 1 }
        animation.addCompletion { [weak self, driver] _ in
            driver.stop()
            Task { [weak self] in
                guard let self else { return }
                if restore, let web {
                    _ = try? await web.callAsyncJavaScript("return await window.readerTurn('cancel')",
                        arguments: [:], in: nil, contentWorld: .page)
                }
                paper?.removeFromSuperview(); paper = nil
                strips = []; backs = []; shades = []; backShades = []
                progress = 0; animator = nil; previewReady = false
                requestedCommit = nil; resolvingTurn = false
                prepare()
            }
        }
        animator = animation; driver.start(); animation.startAnimation()
    }
}

@MainActor private final class PageTurnFrames: NSObject {
    private var link: CADisplayLink?
    private var started: CFTimeInterval = 0
    private let duration: CFTimeInterval
    private let update: (CGFloat) -> Void
    init(duration: CFTimeInterval, update: @escaping (CGFloat) -> Void) { self.duration = duration; self.update = update }
    func start() { started = CACurrentMediaTime(); let link = CADisplayLink(target: self, selector: #selector(tick)); self.link = link; link.add(to: .main, forMode: .common) }
    @objc private func tick() {
        let t = min(1, (CACurrentMediaTime() - started) / duration)
        update(CGFloat(1 - pow(1 - t, 3)))
        if t == 1 { stop() }
    }
    func stop() { link?.invalidate(); link = nil }
}
