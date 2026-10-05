import SwiftUI
import UIKit
import CoreText
import ImageIO
import LeximoryCore
import os

@MainActor enum ReadingSelectionMenu {
    static let lookupTitle = "🐈 猫忆查"
    static var lookupImage: UIImage? { UIImage(systemName: "magnifyingglass") }

    static func removeUnrelatedActions(from builder: UIMenuBuilder) {
        guard builder.system == .context else { return }
        builder.remove(menu: .share)
        builder.remove(menu: .replace)
        builder.remove(menu: .find)
        builder.remove(menu: .lookup)
        builder.replaceChildren(ofMenu: .standardEdit) { withoutSelectAll($0) }
    }

    static func withoutSelectAll(_ elements: [UIMenuElement]) -> [UIMenuElement] {
        elements.compactMap { element in
            if let command = element as? UICommand,
               command.action == #selector(UIResponderStandardEditActions.selectAll(_:)) { return nil }
            if let menu = element as? UIMenu { return menu.replacingChildren(withoutSelectAll(menu.children)) }
            return element
        }
    }
}

@MainActor
struct ReadingTextView: UIViewRepresentable {
    let document: ReadingDocument
    var article: FixtureArticle? = nil
    var language = "English"
    let textID: TextID
    let jumpToEnd: Bool
    var bottomObstruction: CGFloat = 0
    var localStore: LocalReadingStore? = nil
    var client: MobileClient? = nil
    var sync: NativeSync? = nil
    var readOnly = false
    var onTitleVisibilityChange: ((Bool) -> Void)? = nil
    let onDefine: (ReadingSelection, Definition?, CGRect) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(self) }
    func makeUIView(context: Context) -> RubyTextView {
        let view = RubyTextView(frame: .zero, textContainer: nil)
        view.isEditable = false
        view.isSelectable = true
        view.contentInsetAdjustmentBehavior = .automatic
        view.backgroundColor = LeximoryPalette.paperUI
        view.textContainerInset = UIEdgeInsets(top: 28, left: 22, bottom: 36, right: 22)
        view.textContainer.lineFragmentPadding = 0
        view.adjustsFontForContentSizeCategory = true
        if let article {
            let header = UIHostingController(rootView: ArticleReadingHeader(article: article, language: language, onTitleFrame: { [weak view, weak coordinator = context.coordinator] rect in
                view?.headerTitleFrame = rect
                if let view { coordinator?.updateTitleVisibility(view) }
            }))
            header.view.backgroundColor = .clear
            header.safeAreaRegions = []
            context.coordinator.header = header
            view.headerView = header.view
            view.addSubview(header.view)
        }
        view.delegate = context.coordinator
        let tap = AnnotationTapRecognizer(target: context.coordinator, action: #selector(Coordinator.annotationTapped(_:)))
        tap.reader = view
        tap.delegate = context.coordinator
        view.addGestureRecognizer(tap)
        view.openAnnotation = { [weak coordinator = context.coordinator, weak view] occurrence, rect in
            guard let coordinator, let view else { return }
            coordinator.present(occurrence, at: rect, in: view)
        }
        view.accessibilityIdentifier = "reading-document"
        view.isAccessibilityElement = false
        view.accessibleDefine = { [weak coordinator = context.coordinator, weak view] selection, definition, range in
            guard let coordinator, let view else { return }
            if let occurrence = view.annotations.first(where: { $0.range == range }), let rect = view.segments(for: range).first {
                coordinator.present(occurrence, at: rect, in: view)
            }
        }
        view.linkTextAttributes = [.foregroundColor: UIColor(LeximoryPalette.sage), .underlineStyle: NSUnderlineStyle.single.rawValue]
        return view
    }
    func updateUIView(_ view: RubyTextView, context: Context) {
        let coordinator = context.coordinator
        coordinator.parent = self
        view.contentInset.bottom = bottomObstruction
        view.fixtureScrollsToEnd = jumpToEnd
        let bodySize: CGFloat = context.environment.horizontalSizeClass == .regular ? 20 : 18
        let signature = "\(document.hashValue):\(context.environment.dynamicTypeSize):\(context.environment.colorScheme):\(bodySize)"
        if coordinator.signature != signature {
            let selection = view.selectedRange
            let offset = view.contentOffset
            coordinator.signature = signature
            coordinator.layout = ReaderLayout(document: document, openingTitleInHeader: article?.title, showsNotices: false)
            view.readingLayout = coordinator.layout
            view.annotations = coordinator.layout.annotations(textID: textID, revision: document.revision)
            let start = ContinuousClock.now
            coordinator.imageTasks.forEach { $0.cancel() }
            coordinator.imageTasks.removeAll()
            view.attributedText = ReaderAttributes.build(layout: coordinator.layout, language: language, bodySize: bodySize)
            view.invalidateReaderGeometry()
            coordinator.loadImages(in: view)
            view.rubySpans = coordinator.layout.entries.flatMap { entry in
                entry.block.spans.compactMap { span in
                    guard case .ruby(let pronunciation) = span.style else { return nil }
                    return RubyTextView.Ruby(range: NSRange(location: entry.documentRange.location + span.range.location, length: span.range.length), pronunciation: pronunciation)
                }
            }
            if NSMaxRange(selection) <= view.textStorage.length { view.selectedRange = selection }
            view.setContentOffset(offset, animated: false)
            Logger(subsystem: "com.leximory.reader", category: "render").info("Attributed reader build: \(document.blocks.count) blocks, \(coordinator.layout.text.utf16.count) UTF-16 units, \(String(describing: start.duration(to: .now)), privacy: .public)")
        }
        if coordinator.lastJump != jumpToEnd {
            coordinator.lastJump = jumpToEnd
            if jumpToEnd { view.pendingFinalScroll = true; view.setNeedsLayout() }
        }
    }

    static func dismantleUIView(_ view: RubyTextView, coordinator: Coordinator) {
        coordinator.imageTasks.forEach { $0.cancel() }
        coordinator.popover?.dismiss(animated: false)
        view.openAnnotation = nil
        view.delegate = nil
    }

    @MainActor final class Coordinator: NSObject, UITextViewDelegate, UIGestureRecognizerDelegate {
        var parent: ReadingTextView
        var layout: ReaderLayout
        var signature = ""
        var lastJump = false
        var imageTasks: [Task<Void, Never>] = []
        var header: UIHostingController<ArticleReadingHeader>?
        weak var popover: AnnotationPopoverController?
        init(_ parent: ReadingTextView) { self.parent = parent; layout = ReaderLayout(document: parent.document, openingTitleInHeader: parent.article?.title, showsNotices: false) }
        func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
            guard let view = gestureRecognizer.view as? RubyTextView else { return false }
            return view.annotation(at: touch.location(in: view)) != nil
        }
        @objc func annotationTapped(_ gesture: AnnotationTapRecognizer) {
            guard gesture.state == .ended, let view = gesture.reader else { return }
            view.activateAnnotation(at: gesture.location(in: view))
        }
        func present(_ occurrence: ReaderLayout.Annotation, at rect: CGRect, in view: RubyTextView) {
            guard popover == nil else { return }
            view.highlightAnnotation(occurrence.tag)
            guard view.traitCollection.horizontalSizeClass == .regular,
                  let presenter = view.window?.rootViewController else {
                parent.onDefine(occurrence.selection, occurrence.definition, view.presentationRect(for: occurrence.range))
                view.highlightAnnotation(nil)
                return
            }
            let item = DefinitionPresentation(source: .article(occurrence.selection), definition: occurrence.definition)
            let controller = AnnotationPopoverController(rootView: AnyView(EmptyView()))
            let content = DefinitionView(item: item, client: parent.client, language: parent.language, isPopover: true,
                closeTray: { [weak controller] in controller?.dismiss(animated: true) })
                .environment(\.nativeSync, parent.sync)
            controller.rootView = AnyView(content)
            controller.onDismiss = { [weak view] in view?.highlightAnnotation(nil) }
            controller.modalPresentationStyle = .popover
            controller.sizingOptions = .preferredContentSize
            controller.safeAreaRegions = []
            controller.view.backgroundColor = UIColor(LeximoryPalette.annotationSurface)
            controller.popoverPresentationController?.sourceView = view
            controller.popoverPresentationController?.sourceRect = rect
            controller.popoverPresentationController?.permittedArrowDirections = [.up, .down]
            controller.popoverPresentationController?.backgroundColor = UIColor(LeximoryPalette.annotationSurface)
            popover = controller
            presenter.present(controller, animated: true)
        }
        func loadImages(in view: RubyTextView) {
            let revision = parent.document.revision
            for entry in layout.entries {
                for span in entry.block.spans {
                    guard case .image(let url, _) = span.style,
                          let attachment = view.textStorage.attribute(.attachment, at: entry.documentRange.location + span.range.location, effectiveRange: nil) as? NSTextAttachment else { continue }
                    imageTasks.append(Task { [weak self, weak view] in
                        guard let image = try? await ReaderImage.load(url, store: self?.parent.localStore), !Task.isCancelled,
                              let self, let view, self.parent.document.revision == revision else { return }
                        attachment.image = image
                        if self.parent.jumpToEnd { view.pendingFinalScroll = true }
                        view.invalidateReaderGeometry()
                        view.setNeedsDisplay()
                    })
                }
            }
        }
        var lastTitleVisible: Bool?
        func updateTitleVisibility(_ view: RubyTextView) {
            guard view.headerTitleFrame.height > 0 else { return }
            let visible = view.headerTitleFrame.maxY - view.contentOffset.y > view.adjustedContentInset.top + 4
            guard visible != lastTitleVisible else { return }
            lastTitleVisible = visible
            Task { @MainActor [parent] in parent.onTitleVisibilityChange?(visible) }
        }
        func scrollViewDidScroll(_ scrollView: UIScrollView) {
            if let view = scrollView as? RubyTextView { updateTitleVisibility(view) }
        }
        func textView(_ textView: UITextView, editMenuForTextIn range: NSRange, suggestedActions: [UIMenuElement]) -> UIMenu? {
            guard let selection = try? layout.selection(range, document: parent.document, textID: parent.textID) else { return UIMenu(children: suggestedActions) }
            let action = UIAction(title: ReadingSelectionMenu.lookupTitle, image: ReadingSelectionMenu.lookupImage, attributes: parent.readOnly ? .disabled : []) { [weak self, weak textView] _ in
                guard let self, let textView else { return }
                self.parent.onDefine(selection, nil, self.rect(range, in: textView))
            }
            return UIMenu(children: [UIMenu(options: .displayInline, children: [action])] + suggestedActions)
        }
        private func rect(_ range: NSRange, in view: UITextView) -> CGRect {
            view.presentationRect(for: range)
        }
    }
}

@MainActor enum ReaderAttributes {
    static func build(layout: ReaderLayout, language: String = "English", bodySize: CGFloat = 18) -> NSAttributedString {
        let output = NSMutableAttributedString(string: layout.text)
        let body = UIFontMetrics(forTextStyle: .body).scaledFont(for: LeximoryTypography.proseUI(bodySize, language: language))
        let paragraph = NSMutableParagraphStyle()
        paragraph.lineSpacing = bodySize < 20 ? 5 : 7
        output.addAttributes([.font: body, .foregroundColor: language == "Chinese" || language == "Japanese" ? LeximoryPalette.readingInkUI : UIColor.label, .paragraphStyle: paragraph], range: NSRange(location: 0, length: output.length))
        for notice in layout.notices {
            output.addAttributes([.font: UIFontMetrics(forTextStyle: .caption1).scaledFont(for: LeximoryTypography.interfaceUI(12)), .foregroundColor: UIColor.secondaryLabel], range: notice.range)
        }
        for entry in layout.entries {
            let range = entry.documentRange
            let block = entry.block
            let style = NSMutableParagraphStyle()
            style.lineSpacing = block.spans.contains(where: { if case .ruby = $0.style { true } else { false } }) ? body.pointSize * 0.65 : paragraph.lineSpacing
            style.paragraphSpacing = body.pointSize * 0.8
            let font: UIFont
            switch block.kind {
            case .heading1: font = LeximoryPalette.serif(.largeTitle)
            case .heading2: font = LeximoryPalette.serif(.title2)
            case .heading3, .heading4, .heading5, .heading6: font = LeximoryPalette.serif(.headline)
            case .code, .fallback: font = UIFontMetrics(forTextStyle: .body).scaledFont(for: LeximoryTypography.face("SourceCodePro-Medium", size: 16))
            default: font = body
            }
            if block.kind == .quote { style.firstLineHeadIndent = 14; style.headIndent = 14 }
            if block.kind == .divider || block.kind == .heading1 { style.alignment = .center }
            if block.kind == .heading1 { style.paragraphSpacing = body.pointSize * 1.2 }
            if block.kind.rawValue.hasPrefix("heading"), block.kind != .heading1 { style.paragraphSpacingBefore = body.pointSize * 0.6 }
            output.addAttributes([.font: font, .paragraphStyle: style], range: range)
            if block.kind == .quote || block.kind == .divider { output.addAttribute(.foregroundColor, value: UIColor.secondaryLabel, range: range) }
            for span in block.spans {
                let target = NSRange(location: range.location + span.range.location, length: span.range.length)
                switch span.style {
                case .strong:
                    let descriptor = font.fontDescriptor.withSymbolicTraits(.traitBold) ?? font.fontDescriptor
                    output.addAttribute(.font, value: UIFont(descriptor: descriptor, size: 0), range: target)
                case .emphasis:
                    let italic = language == "Japanese" || language == "Chinese" ? UIFont(descriptor: font.fontDescriptor.withSymbolicTraits(.traitItalic) ?? font.fontDescriptor, size: 0) : LeximoryTypography.face("LibreBaskerville-Italic", size: font.pointSize)
                    output.addAttribute(.font, value: italic, range: target)
                case .code: output.addAttribute(.font, value: font.withMonospacedDesign(), range: target)
                case .smallcaps:
                    let descriptor = font.fontDescriptor.addingAttributes([.featureSettings: [[UIFontDescriptor.FeatureKey.type: kLowerCaseType, .selector: kLowerCaseSmallCapsSelector]]])
                    output.addAttribute(.font, value: UIFont(descriptor: descriptor, size: 0), range: target)
                case .link(let url): output.addAttribute(.link, value: url, range: target)
                case .definition, .ruby: break
                case .image(_, let alt):
                    let attachment = NSTextAttachment()
                    attachment.image = UIImage(systemName: "photo")
                    attachment.accessibilityLabel = alt
                    attachment.bounds = CGRect(x: 0, y: 0, width: 280, height: 180)
                    output.addAttribute(.attachment, value: attachment, range: target)
                }
            }
        }
        return output
    }
}

@MainActor final class RubyTextView: UITextView {
    override func buildMenu(with builder: UIMenuBuilder) {
        super.buildMenu(with: builder)
        ReadingSelectionMenu.removeUnrelatedActions(from: builder)
    }

    var pendingFinalScroll = false
    var fixtureScrollsToEnd = false
    var headerTitleFrame = CGRect.zero
    struct Ruby { let range: NSRange; let pronunciation: String }
    var headerView: UIView?
    var rubySpans: [Ruby] = [] { didSet { setNeedsLayout() } }
    private var pronunciationLabels: [Int: UILabel] = [:]
    private let markerLayer = CAShapeLayer()
    private let pressedAnnotationLayer = CAShapeLayer()
    var openAnnotation: ((ReaderLayout.Annotation, CGRect) -> Void)?
    var annotations: [ReaderLayout.Annotation] = [] {
        didSet {
            annotationsByTag = Dictionary(annotations.map { ($0.tag, $0) }, uniquingKeysWith: { first, _ in first })
            annotationSegments.removeAll(); markerViewport = nil
        }
    }
    private var annotationsByTag: [String: ReaderLayout.Annotation] = [:]
    private var annotationSegments: [String: [CGRect]] = [:]
    private var markerViewport: NSRange?
    private var headerWidth: CGFloat?
    private var attachmentWidth: CGFloat?
    private var attachments: [NSTextAttachment] = []
    private var updatingPronunciations = false
    private var paragraphElements: [String: UIAccessibilityElement] = [:]
    var readingLayout: ReaderLayout? { didSet { paragraphElements.removeAll() } }
    var accessibleDefine: ((ReadingSelection, Definition, NSRange) -> Void)?
    override var accessibilityElements: [Any]? {
        get {
            guard let layout = readingLayout,
                  let manager = textLayoutManager, let storage = manager.textContentManager,
                  let viewport = manager.textViewportLayoutController.viewportRange else { return [] }
            let start = storage.offset(from: storage.documentRange.location, to: viewport.location)
            let end = storage.offset(from: storage.documentRange.location, to: viewport.endLocation)
            guard start >= 0, end >= start else { return [] }
            let visible = NSRange(location: start, length: end - start)
            let paragraphs = layout.entries(intersecting: visible).compactMap { entry -> UIAccessibilityElement? in
                let element = paragraphElements[entry.block.id] ?? UIAccessibilityElement(accessibilityContainer: self)
                paragraphElements[entry.block.id] = element
                element.accessibilityLabel = entry.block.displayText.replacingOccurrences(of: "\u{FFFC}", with: "")
                if let notice = entry.block.notice, layout.notices.contains(where: { $0.text == notice }) {
                    element.accessibilityLabel = notice + ". " + (element.accessibilityLabel ?? "")
                }
                element.accessibilityTraits = entry.block.kind.rawValue.hasPrefix("heading") ? [.header, .staticText] : .staticText
                element.accessibilityFrameInContainerSpace = self.boundingRect(for: entry.documentRange)
                element.accessibilityCustomActions = entry.block.spans.compactMap { span in
                    guard case .definition = span.style,
                          let occurrence = annotationsByTag["definition:\(entry.block.id):\(span.range.location)"] else { return nil }
                    let selection = occurrence.selection
                    return UIAccessibilityCustomAction(name: "查看释义 \(selection.text)") { [weak self] _ in
                        self?.accessibleDefine?(selection, occurrence.definition, occurrence.range)
                        return true
                    }
                }
                return element
            }
            if let headerView, headerView.frame.intersects(bounds) { return [headerView] + paragraphs }
            return paragraphs
        }
        set { }
    }
    override func accessibilityScroll(_ direction: UIAccessibilityScrollDirection) -> Bool {
        let delta: CGFloat
        switch direction {
        case .down, .next: delta = bounds.height * 0.8
        case .up, .previous: delta = -bounds.height * 0.8
        default: return false
        }
        let next = min(max(-adjustedContentInset.top, contentOffset.y + delta), max(0, contentSize.height - bounds.height + adjustedContentInset.bottom))
        guard next != contentOffset.y else { return false }
        setContentOffset(CGPoint(x: 0, y: next), animated: false)
        UIAccessibility.post(notification: .pageScrolled, argument: nil)
        return true
    }

    override func layoutSubviews() {
        if attachmentWidth != bounds.width {
            annotationSegments.removeAll(); markerViewport = nil
            if fixtureScrollsToEnd { pendingFinalScroll = true }
        }
        if let headerView, bounds.width > 0, headerWidth != bounds.width {
            let size = headerView.systemLayoutSizeFitting(CGSize(width: bounds.width, height: UIView.layoutFittingCompressedSize.height),
                withHorizontalFittingPriority: .required, verticalFittingPriority: .fittingSizeLevel)
            headerView.frame = CGRect(x: 0, y: 0, width: bounds.width, height: size.height)
            if textContainerInset.top != size.height + 28 { textContainerInset.top = size.height + 28 }
            headerWidth = bounds.width
        }
        let side = max(22, (bounds.width - LeximoryLayout.readingMeasure) / 2)
        if textContainerInset.left != side {
            textContainerInset.left = side
            textContainerInset.right = side
            annotationSegments.removeAll(); markerViewport = nil
        }
        if attachmentWidth != bounds.width {
            for attachment in attachments {
                guard let image = attachment.image, image.size.width > 0 else { continue }
                let ratio = image.size.height / image.size.width
                let width = min(560, bounds.width - side * 2, 600 / max(ratio, 0.1))
                let next = CGRect(x: 0, y: 0, width: width, height: width * ratio)
                if attachment.bounds != next { attachment.bounds = next }
            }
            attachmentWidth = bounds.width
        }
        super.layoutSubviews()
        if pendingFinalScroll, bounds.width > 0, bounds.height > 0, textStorage.length > 0 {
            pendingFinalScroll = false
            scrollRangeToVisible(NSRange(location: textStorage.length - 1, length: 1))
        }
        updatePronunciations()
        updateMarkers()
    }
    private func updateMarkers() {
        guard let layout = readingLayout, let manager = textLayoutManager,
              let storage = manager.textContentManager, let viewport = manager.textViewportLayoutController.viewportRange else {
            markerLayer.path = nil; markerViewport = nil; return
        }
        let start = storage.offset(from: storage.documentRange.location, to: viewport.location)
        let end = storage.offset(from: storage.documentRange.location, to: viewport.endLocation)
        guard start >= 0, end >= start else { return }
        let visible = NSRange(location: start, length: end - start)
        guard markerViewport != visible else { return }
        markerViewport = visible
        if markerLayer.superlayer == nil { layer.insertSublayer(markerLayer, at: 0) }
        let path = UIBezierPath()
        var visibleTags = Set<String>()
        for entry in layout.entries(intersecting: visible) {
            for span in entry.block.spans {
                let tag = "definition:\(entry.block.id):\(span.range.location)"
                guard let occurrence = annotationsByTag[tag], NSIntersectionRange(occurrence.range, visible).length > 0 else { continue }
                visibleTags.insert(tag)
                let segments = annotationSegments[tag] ?? segments(for: occurrence.range)
                annotationSegments[tag] = segments
                for rect in segments {
                    let height = max(3, rect.height * 0.28)
                    let band = CGRect(x: rect.minX - 0.5, y: rect.maxY - height - rect.height * 0.08, width: rect.width + 1, height: height)
                    path.append(UIBezierPath(roundedRect: band, cornerRadius: height * 0.18))
                }
            }
        }
        annotationSegments = annotationSegments.filter { visibleTags.contains($0.key) }
        CATransaction.begin(); CATransaction.setDisableActions(true)
        markerLayer.fillColor = LeximoryPalette.wordHighlightUI.cgColor
        markerLayer.path = path.cgPath
        CATransaction.commit()
    }
    func annotation(tag: String) -> ReaderLayout.Annotation? { annotationsByTag[tag] }
    func annotation(at point: CGPoint) -> (occurrence: ReaderLayout.Annotation, rect: CGRect)? {
        for (tag, segments) in annotationSegments {
            if let rect = segments.first(where: { $0.insetBy(dx: -2, dy: -2).contains(point) }),
               let occurrence = annotationsByTag[tag] { return (occurrence, rect) }
        }
        // TextKit may not have published a viewport on the first painted frame.
        // Resolve only the touched block, then retain its word geometry for subsequent taps.
        guard let position = closestPosition(to: point), let layout = readingLayout else { return nil }
        let offset = offset(from: beginningOfDocument, to: position)
        for entry in layout.entries(intersecting: NSRange(location: offset, length: 1)) {
            for span in entry.block.spans {
                let tag = "definition:\(entry.block.id):\(span.range.location)"
                guard let occurrence = annotationsByTag[tag], NSLocationInRange(offset, occurrence.range) else { continue }
                let rectangles = segments(for: occurrence.range)
                annotationSegments[tag] = rectangles
                if let rect = rectangles.first(where: { $0.insetBy(dx: -2, dy: -2).contains(point) }) { return (occurrence, rect) }
            }
        }
        return nil
    }
    func activateAnnotation(at point: CGPoint) {
        guard let hit = annotation(at: point) else { return }
        highlightAnnotation(hit.occurrence.tag)
        openAnnotation?(hit.occurrence, hit.rect)
    }
    func highlightAnnotation(_ tag: String?) {
        if pressedAnnotationLayer.superlayer == nil { layer.insertSublayer(pressedAnnotationLayer, at: 0) }
        let path = UIBezierPath()
        if let tag {
            for rect in annotationSegments[tag] ?? [] {
                path.append(UIBezierPath(roundedRect: rect.insetBy(dx: -2, dy: -1), cornerRadius: 3))
            }
        }
        CATransaction.begin(); CATransaction.setDisableActions(true)
        pressedAnnotationLayer.fillColor = UIColor(LeximoryPalette.sage).withAlphaComponent(0.15).cgColor
        pressedAnnotationLayer.path = path.cgPath
        CATransaction.commit()
    }
    func invalidateReaderGeometry() {
        headerWidth = nil; attachmentWidth = nil; markerViewport = nil
        annotationSegments.removeAll(); attachments.removeAll()
        textStorage.enumerateAttribute(.attachment, in: NSRange(location: 0, length: textStorage.length)) { value, _, _ in
            if let attachment = value as? NSTextAttachment { attachments.append(attachment) }
        }
        setNeedsLayout()
    }
    func segments(for range: NSRange) -> [CGRect] {
        guard let manager = textLayoutManager, let storage = manager.textContentManager,
              let start = storage.location(storage.documentRange.location, offsetBy: range.location),
              let end = storage.location(start, offsetBy: range.length),
              let textRange = NSTextRange(location: start, end: end) else { return [] }
        var rectangles: [CGRect] = []
        manager.enumerateTextSegments(in: textRange, type: .standard, options: .rangeNotRequired) { _, frame, _, _ in
            if !frame.isEmpty {
                rectangles.append(frame.offsetBy(dx: self.textContainerInset.left, dy: self.textContainerInset.top))
            }
            return true
        }
        return rectangles
    }
    private func updatePronunciations() {
        guard !updatingPronunciations else { return }
        updatingPronunciations = true
        defer { updatingPronunciations = false }
        guard let manager = textLayoutManager, let storage = manager.textContentManager,
              let viewport = manager.textViewportLayoutController.viewportRange else { return }
        let start = storage.offset(from: storage.documentRange.location, to: viewport.location)
        let end = storage.offset(from: storage.documentRange.location, to: viewport.endLocation)
        guard start >= 0, end >= start else { return }
        let visible = NSRange(location: start, length: end - start)
        var displayed = Set<Int>()
        for ruby in rubySpans where NSIntersectionRange(ruby.range, visible).length > 0 {
            let base = rect(for: ruby.range)
            guard !base.isEmpty, base.intersects(bounds) else { continue }
            let label = pronunciationLabels[ruby.range.location] ?? UILabel()
            if label.superview == nil {
                label.isUserInteractionEnabled = false
                label.isAccessibilityElement = false
                label.textAlignment = .center
                label.textColor = .secondaryLabel
                addSubview(label)
            }
            label.text = ruby.pronunciation
            label.font = LeximoryTypography.face("ChillDuanHeiSongProJP_Regular", size: LeximoryPalette.readingFont.pointSize * 0.48)
            let width = max(base.width, label.sizeThatFits(.zero).width)
            label.frame = CGRect(x: base.midX - width / 2, y: base.minY - label.font.lineHeight + 1,
                                 width: width, height: label.font.lineHeight)
            pronunciationLabels[ruby.range.location] = label
            displayed.insert(ruby.range.location)
        }
        for key in pronunciationLabels.keys.filter({ !displayed.contains($0) }) {
            pronunciationLabels.removeValue(forKey: key)?.removeFromSuperview()
        }
    }

}

@MainActor final class AnnotationTapRecognizer: UITapGestureRecognizer {
    weak var reader: RubyTextView?
    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
        if let reader, let touch = touches.first {
            reader.highlightAnnotation(reader.annotation(at: touch.location(in: reader))?.occurrence.tag)
        }
        super.touchesBegan(touches, with: event)
    }
    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent) {
        super.touchesMoved(touches, with: event)
        if state == .failed || state == .cancelled { reader?.highlightAnnotation(nil) }
    }
    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent) {
        reader?.highlightAnnotation(nil)
        super.touchesCancelled(touches, with: event)
    }
}

@MainActor final class AnnotationPopoverController: UIHostingController<AnyView> {
    var onDismiss: (() -> Void)?
    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        onDismiss?()
    }
}

private extension UIFont {
    func withMonospacedDesign() -> UIFont {
        LeximoryTypography.face("SourceCodePro-Medium", size: pointSize)
    }
}

@MainActor private extension UITextView {
    func presentationRect(for range: NSRange) -> CGRect {
        let rect = rect(for: range).offsetBy(dx: -bounds.minX, dy: -bounds.minY)
        guard !rect.isEmpty else { return .zero }
        return CGRect(x: min(max(0, rect.minX), max(0, bounds.width - rect.width)),
                      y: min(max(0, rect.minY), max(0, bounds.height - rect.height)),
                      width: min(rect.width, bounds.width), height: min(rect.height, bounds.height))
    }
    func boundingRect(for range: NSRange) -> CGRect {
        guard let start = position(from: beginningOfDocument, offset: range.location),
              let end = position(from: start, offset: range.length),
              let selection = textRange(from: start, to: end) else { return .zero }
        let result = selectionRects(for: selection).reduce(CGRect.null) { $0.union($1.rect) }
        return result.isNull ? firstRect(for: selection) : result
    }
    func rect(for range: NSRange) -> CGRect {
        guard let start = position(from: beginningOfDocument, offset: range.location),
              let end = position(from: start, offset: range.length),
              let selection = textRange(from: start, to: end) else { return .zero }
        return firstRect(for: selection)
    }
}
