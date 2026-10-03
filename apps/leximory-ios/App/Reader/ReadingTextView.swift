import SwiftUI
import UIKit
import CoreText
import ImageIO
import LeximoryCore
import os

@MainActor
struct ReadingTextView: UIViewRepresentable {
    let document: ReadingDocument
    var article: FixtureArticle? = nil
    var language = "English"
    let textID: TextID
    let jumpToEnd: Bool
    var onTitleVisibilityChange: ((Bool) -> Void)? = nil
    let onDefine: (ReadingSelection, Definition?, CGRect) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(self) }
    func makeUIView(context: Context) -> RubyTextView {
        let view = RubyTextView(frame: .zero, textContainer: nil)
        view.isEditable = false
        view.isSelectable = true
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
            context.coordinator.header = header
            view.headerView = header.view
            view.addSubview(header.view)
        }
        view.delegate = context.coordinator
        view.accessibilityIdentifier = "reading-document"
        view.isAccessibilityElement = false
        view.accessibleDefine = { [weak coordinator = context.coordinator, weak view] selection, definition, range in
            guard let coordinator, let view else { return }
            coordinator.parent.onDefine(selection, definition, view.presentationRect(for: range))
        }
        view.linkTextAttributes = [.foregroundColor: UIColor(LeximoryPalette.sage), .underlineStyle: NSUnderlineStyle.single.rawValue]
        return view
    }
    func updateUIView(_ view: RubyTextView, context: Context) {
        let coordinator = context.coordinator
        coordinator.parent = self
        let bodySize: CGFloat = context.environment.horizontalSizeClass == .regular ? 20 : 18
        let signature = "\(document.revision):\(context.environment.dynamicTypeSize):\(context.environment.colorScheme):\(bodySize)"
        if coordinator.signature != signature {
            let selection = view.selectedRange
            let offset = view.contentOffset
            coordinator.signature = signature
            coordinator.layout = ReaderLayout(document: document, openingTitleInHeader: article?.title)
            view.readingLayout = coordinator.layout
            view.readingDocument = document
            view.readingTextID = textID
            let start = ContinuousClock.now
            coordinator.imageTasks.forEach { $0.cancel() }
            coordinator.imageTasks.removeAll()
            view.attributedText = ReaderAttributes.build(layout: coordinator.layout, language: language, bodySize: bodySize)
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
        view.delegate = nil
    }

    @MainActor final class Coordinator: NSObject, UITextViewDelegate {
        var parent: ReadingTextView
        var layout: ReaderLayout
        var signature = ""
        var lastJump = false
        var imageTasks: [Task<Void, Never>] = []
        var header: UIHostingController<ArticleReadingHeader>?
        init(_ parent: ReadingTextView) { self.parent = parent; layout = ReaderLayout(document: parent.document, openingTitleInHeader: parent.article?.title) }
        func loadImages(in view: RubyTextView) {
            let revision = parent.document.revision
            for entry in layout.entries {
                for span in entry.block.spans {
                    guard case .image(let url, _) = span.style,
                          let attachment = view.textStorage.attribute(.attachment, at: entry.documentRange.location + span.range.location, effectiveRange: nil) as? NSTextAttachment else { continue }
                    imageTasks.append(Task { [weak self, weak view] in
                        guard let image = try? await ReaderImage.load(url), !Task.isCancelled,
                              let self, let view, self.parent.document.revision == revision else { return }
                        attachment.image = image
                        if self.parent.jumpToEnd { view.pendingFinalScroll = true }
                        view.setNeedsLayout()
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
            (scrollView as? RubyTextView)?.setNeedsLayout()
        }
        func textView(_ textView: UITextView, editMenuForTextIn range: NSRange, suggestedActions: [UIMenuElement]) -> UIMenu? {
            guard let selection = try? layout.selection(range, document: parent.document, textID: parent.textID) else { return UIMenu(children: suggestedActions) }
            let action = UIAction(title: "查词", image: UIImage(systemName: "text.magnifyingglass")) { [weak self, weak textView] _ in
                guard let self, let textView else { return }
                self.parent.onDefine(selection, nil, self.rect(range, in: textView))
            }
            return UIMenu(children: [UIMenu(options: .displayInline, children: [action])] + suggestedActions)
        }
        func textView(_ textView: UITextView, primaryActionFor textItem: UITextItem, defaultAction: UIAction) -> UIAction? {
            if case .tag(let tag) = textItem.content, tag.hasPrefix("definition:") {
                return UIAction { [weak self, weak textView] _ in
                    guard let self, let textView,
                          let selection = try? self.layout.selection(textItem.range, document: self.parent.document, textID: self.parent.textID),
                          let block = self.parent.document.blocks.first(where: { $0.id == selection.blockID }),
                          let span = block.spans.first(where: { $0.range == selection.range }),
                          case .definition(let definition) = span.style else { return }
                    self.parent.onDefine(selection, definition, self.rect(textItem.range, in: textView))
                }
            }
            return defaultAction
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
        output.addAttributes([.font: body, .foregroundColor: UIColor.label, .paragraphStyle: paragraph], range: NSRange(location: 0, length: output.length))
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
                case .definition:
                    output.addAttribute(.textItemTag, value: "definition:\(block.id):\(span.range.location)", range: target)
                case .ruby: break
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
    var pendingFinalScroll = false
    var headerTitleFrame = CGRect.zero
    struct Ruby { let range: NSRange; let pronunciation: String }
    var headerView: UIView?
    var rubySpans: [Ruby] = [] { didSet { setNeedsLayout() } }
    private var pronunciationLabels: [Int: UILabel] = [:]
    private let markerLayer = CAShapeLayer()
    private var updatingPronunciations = false
    private var paragraphElements: [String: UIAccessibilityElement] = [:]
    var readingLayout: ReaderLayout? { didSet { paragraphElements.removeAll() } }
    var readingDocument: ReadingDocument?
    var readingTextID: TextID?
    var accessibleDefine: ((ReadingSelection, Definition, NSRange) -> Void)?
    override var accessibilityElements: [Any]? {
        get {
            guard let layout = readingLayout, let document = readingDocument, let textID = readingTextID,
                  let manager = textLayoutManager, let storage = manager.textContentManager,
                  let viewport = manager.textViewportLayoutController.viewportRange else { return [] }
            let start = storage.offset(from: storage.documentRange.location, to: viewport.location)
            let end = storage.offset(from: storage.documentRange.location, to: viewport.endLocation)
            guard start >= 0, end >= start else { return [] }
            let visible = NSRange(location: start, length: end - start)
            let paragraphs = layout.entries.compactMap { entry -> UIAccessibilityElement? in
                guard NSIntersectionRange(entry.documentRange, visible).length > 0 else { return nil }
                let element = paragraphElements[entry.block.id] ?? UIAccessibilityElement(accessibilityContainer: self)
                paragraphElements[entry.block.id] = element
                element.accessibilityLabel = entry.block.displayText.replacingOccurrences(of: "\u{FFFC}", with: "")
                if let notice = entry.block.notice { element.accessibilityLabel = notice + ". " + (element.accessibilityLabel ?? "") }
                element.accessibilityTraits = entry.block.kind.rawValue.hasPrefix("heading") ? [.header, .staticText] : .staticText
                element.accessibilityFrameInContainerSpace = self.boundingRect(for: entry.documentRange)
                element.accessibilityCustomActions = entry.block.spans.compactMap { span in
                    guard case .definition(let definition) = span.style,
                          let selection = try? document.selection(textID: textID, blockID: entry.block.id, range: span.range) else { return nil }
                    let globalRange = NSRange(location: entry.documentRange.location + span.range.location, length: span.range.length)
                    return UIAccessibilityCustomAction(name: "查看释义 \(selection.text)") { [weak self] _ in
                        self?.accessibleDefine?(selection, definition, globalRange)
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
        if let headerView, bounds.width > 0 {
            let size = headerView.systemLayoutSizeFitting(CGSize(width: bounds.width, height: UIView.layoutFittingCompressedSize.height),
                withHorizontalFittingPriority: .required, verticalFittingPriority: .fittingSizeLevel)
            headerView.frame = CGRect(x: 0, y: 0, width: bounds.width, height: size.height)
            if textContainerInset.top != size.height + 28 { textContainerInset.top = size.height + 28 }
        }
        let side = max(22, (bounds.width - LeximoryLayout.readingMeasure) / 2)
        if textContainerInset.left != side {
            textContainerInset.left = side
            textContainerInset.right = side
        }
        textStorage.enumerateAttribute(.attachment, in: NSRange(location: 0, length: textStorage.length)) { value, _, _ in
            guard let attachment = value as? NSTextAttachment, let image = attachment.image, image.size.width > 0 else { return }
            let ratio = image.size.height / image.size.width
            let width = min(560, bounds.width - side * 2, 600 / max(ratio, 0.1))
            let next = CGRect(x: 0, y: 0, width: width, height: width * ratio)
            if attachment.bounds != next { attachment.bounds = next }
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
              let storage = manager.textContentManager, let viewport = manager.textViewportLayoutController.viewportRange else { markerLayer.path = nil; return }
        let start = storage.offset(from: storage.documentRange.location, to: viewport.location)
        let end = storage.offset(from: storage.documentRange.location, to: viewport.endLocation)
        guard start >= 0, end >= start else { return }
        let visible = NSRange(location: start, length: end - start)
        if markerLayer.superlayer == nil { layer.insertSublayer(markerLayer, at: 0) }
        let path = UIBezierPath()
        for entry in layout.entries where NSIntersectionRange(entry.documentRange, visible).length > 0 {
            for span in entry.block.spans {
                guard case .definition = span.style,
                      let start = position(from: beginningOfDocument, offset: entry.documentRange.location + span.range.location),
                      let end = position(from: start, offset: span.range.length),
                      let range = textRange(from: start, to: end) else { continue }
                for selection in selectionRects(for: range) where !selection.rect.isEmpty {
                    let rect = selection.rect
                    let band = CGRect(x: rect.minX - 1, y: rect.minY + rect.height * 0.47, width: rect.width + 2, height: rect.height * 0.40)
                    path.append(UIBezierPath(roundedRect: band, cornerRadius: band.height * 0.3))
                }
            }
        }
        CATransaction.begin(); CATransaction.setDisableActions(true)
        markerLayer.fillColor = LeximoryPalette.wordHighlightUI.cgColor
        markerLayer.path = path.cgPath
        CATransaction.commit()
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
            label.font = LeximoryTypography.face("NotoSerifJP-Regular", size: LeximoryPalette.readingFont.pointSize * 0.48)
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
