import SwiftUI
import UIKit
import CoreText
import ImageIO
import PDFKit
import LeximoryCore
import os

@MainActor enum ReadingSelectionMenu {
    static let lookupTitle = "猫忆查"
    static let searchIdentifier = UIAction.Identifier("com.leximory.selection.web-search")
    static var lookupImage: UIImage? { UIImage(systemName: "pawprint.fill") }

    static func menu(children: [UIMenuElement], options: UIMenu.Options = []) -> UIMenu {
        let menu = UIMenu(options: options, children: children)
        menu.preferredElementSize = .medium
        let preferences = UIMenuDisplayPreferences()
        preferences.maximumNumberOfTitleLines = 1
        menu.displayPreferences = preferences
        return menu
    }

    static func removeUnrelatedActions(from builder: UIMenuBuilder) {
        guard builder.system == .context else { return }
        let native = copyAndLookupActions(builder.menu(for: .root)?.children ?? [])
        builder.remove(menu: .lookup)
        builder.replaceChildren(ofMenu: .root) { _ in native }
    }

    static func insertLearningActions(_ actions: [UIMenuElement], into builder: UIMenuBuilder,
                                      nativeLookupBeforeCopy: Bool = false, trailingActions: [UIMenuElement] = []) {
        guard builder.system == .context else { return }
        builder.replaceChildren(ofMenu: .root) { elements in
            let native = copyAndLookupActions(elements)
            let ordered = nativeLookupBeforeCopy
                ? native.filter { defineTitles.contains(nativeTitle($0)) } + native.filter { !defineTitles.contains(nativeTitle($0)) }
                : native
            return [menu(children: actions + ordered + trailingActions, options: .displayInline)]
        }
    }

    private static let defineTitles: Set<String> = ["辞典", "查询", "查詢", "定义", "定義", "Look Up", "Define"]
    private static let copyTitles: Set<String> = ["拷贝", "拷貝", "复制", "複製", "Copy"]

    static func removingSystemSearchActions(_ elements: [UIMenuElement]) -> [UIMenuElement] {
        elements.flatMap { element -> [UIMenuElement] in
            if let menu = element as? UIMenu {
                if menu.identifier == .lookup { return copyAndLookupActions(menu.children) }
                let children = removingSystemSearchActions(menu.children)
                return children.isEmpty ? [] : [menu.replacingChildren(children)]
            }
            switch nativeTitle(element) {
            case "查找所选内容", "尋找所選內容", "翻译", "翻譯", "搜索网页", "搜尋網頁", "Search Web", "Translate", "Find Selection": return []
            default: return [element]
            }
        }
    }

    private static func nativeTitle(_ element: UIMenuElement) -> String {
        element.title.trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: ".…"))
    }

    static func copyAndLookupActions(_ elements: [UIMenuElement]) -> [UIMenuElement] {
        elements.flatMap { element -> [UIMenuElement] in
            if let menu = element as? UIMenu { return copyAndLookupActions(menu.children) }
            if let command = element as? UICommand, command.action == #selector(UIResponderStandardEditActions.copy(_:)) {
                return [command]
            }
            if defineTitles.contains(nativeTitle(element)) {
                if let action = element as? UIAction { action.title = "辞典" }
                else if let command = element as? UICommand { command.title = "辞典" }
                element.accessibilityLabel = "辞典"
                return [element]
            }
            return copyTitles.contains(nativeTitle(element)) ? [element] : []
        }
    }

    static func nativeLookupActions(in elements: [UIMenuElement]) -> [UIMenuElement] {
        copyAndLookupActions(elements).filter { defineTitles.contains(nativeTitle($0)) }
    }

    static func searchAction(query: String?, engine: BrowserSearchEngine = .selected(), perform: ((String) -> Void)?) -> UIAction {
        let query = query?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return UIAction(title: engine.name, image: UIImage(systemName: "magnifyingglass"), identifier: searchIdentifier, attributes: query.isEmpty || perform == nil ? .disabled : []) { _ in
            guard !query.isEmpty else { return }
            perform?(query)
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
    var annotationReveal: UUID? = nil
    var articleAudio: ArticleAudioButton? = nil
    @Environment(\.browserWorkspace) private var workspace
    var onTitleVisibilityChange: ((Bool) -> Void)? = nil
    let onDefine: (ReadingSelection, Definition?, CGRect) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(self) }
    func makeUIView(context: Context) -> RubyTextView {
        let view = RubyTextView(frame: .zero, textContainer: nil)
        view.tintColor = .systemBlue
        view.isEditable = false
        view.isSelectable = true
        view.contentInsetAdjustmentBehavior = .automatic
        view.backgroundColor = LeximoryPalette.paperUI
        view.textContainerInset = UIEdgeInsets(top: 28, left: 22, bottom: 36, right: 22)
        view.textContainer.lineFragmentPadding = 0
        view.adjustsFontForContentSizeCategory = true
        if let article {
            let header = UIHostingController(rootView: ArticleReadingHeader(article: article, language: language, audio: articleAudio, onTitleFrame: { [weak view, weak coordinator = context.coordinator] rect in
                view?.headerTitleFrame = rect
                if let view { coordinator?.updateTitleVisibility(view) }
            }, onHeightChange: { [weak view] in view?.invalidateReaderGeometry() }))
            header.sizingOptions = .intrinsicContentSize
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
        if let article, let header = coordinator.header,
           header.rootView.article != article || header.rootView.language != language || header.rootView.audio?.presentationID != articleAudio?.presentationID {
            header.rootView = ArticleReadingHeader(article: article, language: language, audio: articleAudio,
                                                  onTitleFrame: header.rootView.onTitleFrame, onHeightChange: header.rootView.onHeightChange)
            header.view.invalidateIntrinsicContentSize()
            view.invalidateReaderGeometry()
        }
        if view.learningReadOnly != readOnly {
            view.learningReadOnly = readOnly
            UIMenuSystem.context.setNeedsRebuild()
        }
        view.contentInset.bottom = bottomObstruction
        view.fixtureScrollsToEnd = jumpToEnd
        let bodySize: CGFloat = context.environment.horizontalSizeClass == .regular ? 20 : 18
        let signature = "\(document.hashValue):\(article?.title ?? ""):\(language):\(context.environment.dynamicTypeSize):\(context.environment.colorScheme):\(bodySize)"
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
        if let annotationReveal, coordinator.lastReveal != annotationReveal {
            coordinator.lastReveal = annotationReveal
            view.layoutIfNeeded()
            view.revealAnnotations()
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
        var lastReveal: UUID?
        var imageTasks: [Task<Void, Never>] = []
        var header: UIHostingController<ArticleReadingHeader>?
        weak var popover: AnnotationPopoverController?
        init(_ parent: ReadingTextView) { self.parent = parent; layout = ReaderLayout(document: parent.document, openingTitleInHeader: parent.article?.title, showsNotices: false) }
        func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
            guard let view = gestureRecognizer.view as? RubyTextView else { return false }
            return popover != nil || view.annotation(at: touch.location(in: view)) != nil
        }
        @objc func annotationTapped(_ gesture: AnnotationTapRecognizer) {
            guard gesture.state == .ended, let view = gesture.reader else { return }
            guard view.annotation(at: gesture.location(in: view)) != nil else {
                popover?.dismiss(animated: true)
                return
            }
            view.activateAnnotation(at: gesture.location(in: view))
        }
        func present(_ occurrence: ReaderLayout.Annotation, at rect: CGRect, in view: RubyTextView) {
            view.highlightAnnotation(occurrence.tag)
            guard view.traitCollection.horizontalSizeClass == .regular,
                  let presenter = view.window?.rootViewController else {
                parent.onDefine(occurrence.selection, occurrence.definition, view.presentationRect(for: occurrence.range))
                view.highlightAnnotation(nil)
                return
            }
            let item = DefinitionPresentation(source: .article(occurrence.selection), definition: occurrence.definition)
            let existing = popover
            let controller = existing ?? AnnotationPopoverController(rootView: AnyView(EmptyView()))
            let content = DefinitionView(item: item, client: parent.client, language: parent.language, isPopover: true,
                closeTray: { [weak controller] in controller?.dismiss(animated: true) })
                .id(item.id)
                .environment(\.nativeSync, parent.sync)
                .environment(\.browserWorkspace, parent.workspace)
            controller.rootView = AnyView(content)
            controller.onDismiss = { [weak self, weak controller, weak view] in
                guard self?.popover === controller else { return }
                self?.popover = nil
                view?.highlightAnnotation(nil)
            }
            controller.modalPresentationStyle = .popover
            controller.sizingOptions = .preferredContentSize
            controller.safeAreaRegions = []
            controller.view.backgroundColor = UIColor(LeximoryPalette.annotationSurface)
            controller.popoverPresentationController?.sourceView = view
            controller.popoverPresentationController?.sourceRect = rect
            controller.popoverPresentationController?.passthroughViews = [view]
            controller.popoverPresentationController?.permittedArrowDirections = [.up, .down]
            controller.popoverPresentationController?.backgroundColor = UIColor(LeximoryPalette.annotationSurface)
            popover = controller
            if existing == nil { presenter.present(controller, animated: true) }
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
        func textView(_ textView: UITextView, primaryActionFor textItem: UITextItem, defaultAction: UIAction) -> UIAction? {
            guard case .link(let url) = textItem.content, parent.workspace != nil,
                  TextBrowserModel.address(url.absoluteString) != nil else { return defaultAction }
            return UIAction(title: "打开") { [weak self] _ in self?.parent.workspace?.openURL(url) }
        }
        func textView(_ textView: UITextView, editMenuForTextIn range: NSRange, suggestedActions: [UIMenuElement]) -> UIMenu? {
            let native = ReadingSelectionMenu.copyAndLookupActions(suggestedActions)
            guard let selection = try? layout.selection(range, document: parent.document, textID: parent.textID) else { return ReadingSelectionMenu.menu(children: native) }
            let search = ReadingSelectionMenu.searchAction(query: selection.text, perform: parent.workspace.map { workspace in
                { [weak workspace] query in workspace?.search(query) }
            })
            guard !parent.readOnly else { return ReadingGlassMenu.present(from: textView, rect: (textView as? RubyTextView)?.boundingRect(for: range) ?? .zero, elements: native + [search]) }
            let action = UIAction(title: ReadingSelectionMenu.lookupTitle, image: ReadingSelectionMenu.lookupImage) { [weak self, weak textView] _ in
                guard let self, let textView else { return }
                self.parent.onDefine(selection, nil, self.rect(range, in: textView))
            }
            return ReadingGlassMenu.present(from: textView, rect: (textView as? RubyTextView)?.boundingRect(for: range) ?? .zero, elements: [action] + native + [search])
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
                    let bold = language == "Chinese" ? LeximoryTypography.proseUI(font.pointSize, language: language, bold: true) : UIFont(descriptor: descriptor, size: 0)
                    output.addAttribute(.font, value: bold, range: target)
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
    var learningReadOnly = false
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
    private var revealLayers: [CAShapeLayer] = []
    private var revealID: UUID?
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
    func revealAnnotations() {
        guard !UIAccessibility.isReduceMotionEnabled, window != nil else { return }
        revealLayers.forEach { $0.removeFromSuperlayer() }
        revealLayers.removeAll()
        let id = UUID(); revealID = id
        let bands = annotationSegments.values.flatMap { $0 }.filter { bounds.intersects($0) }
            .sorted { $0.minY == $1.minY ? $0.minX < $1.minX : $0.minY < $1.minY }
        guard !bands.isEmpty else { return }
        markerLayer.opacity = 0
        for (index, rect) in bands.enumerated() {
            let height = max(3, rect.height * 0.28)
            let band = CGRect(x: rect.minX - 0.5, y: rect.maxY - height - rect.height * 0.08, width: rect.width + 1, height: height)
            let marker = CAShapeLayer()
            marker.bounds = CGRect(origin: .zero, size: band.size)
            marker.anchorPoint = .zero; marker.position = band.origin
            marker.path = UIBezierPath(roundedRect: marker.bounds, cornerRadius: height * 0.18).cgPath
            marker.fillColor = LeximoryPalette.wordHighlightUI.cgColor
            layer.insertSublayer(marker, at: 0); revealLayers.append(marker)
            let animation = CABasicAnimation(keyPath: "transform.scale.x")
            animation.fromValue = 0; animation.toValue = 1; animation.duration = 0.24
            animation.beginTime = CACurrentMediaTime() + Double(index) / Double(max(1, bands.count)) * 0.3
            animation.fillMode = .backwards; animation.timingFunction = CAMediaTimingFunction(name: .easeOut)
            marker.add(animation, forKey: "reveal")
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { [weak self] in
            guard let self, revealID == id else { return }
            markerLayer.opacity = 1
            revealLayers.forEach { $0.removeFromSuperlayer() }; revealLayers.removeAll()
        }
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

/// Owns presentation only; reading adapters retain their captured selection and authorization.
@MainActor final class ReadingGlassMenu: UIView, UIScrollViewDelegate {
    private static weak var current: ReadingGlassMenu?
    private static weak var pendingSource: UIView?
    private static var presentationID = UUID()
    private weak var source: UIView?
    private let panel = UIVisualEffectView()
    private let motionHost = UIView()
    private var glass: UIGlassEffect?
    private var enteredAt: CFTimeInterval?
    private var isClosing = false
    private var sourceBounds: CGRect = .zero
    private var sourceFrame: CGRect = .zero
    private var didDismiss: (() -> Void)?
    private var monitor: Timer?
    private var selectionRange: NSRange?
    private var pdfText: String?
    private var actions: [UIMenuElement] = []
    private var anchor: CGRect = .zero
    private var safeBounds: CGRect = .zero
    private weak var rail: UIScrollView?
    private weak var overflowButton: UIButton?
    private var content: UIView?
    private weak var primarySurface: UIView?
    private var observedScrollViews: [(UIScrollView, CGPoint)] = []

    @discardableResult static func present(from source: UIView, rect: CGRect, elements: [UIMenuElement], onDismiss: (() -> Void)? = nil) -> UIMenu {
        // Keep the native responder and selection handles, suppress only its menu.
        let request = UUID()
        presentationID = request; pendingSource = source
        DispatchQueue.main.async { [weak source] in
            guard presentationID == request, let source, let window = source.window, !rect.isEmpty else { return }
            current?.close(animated: false)
            let menu = ReadingGlassMenu(frame: window.bounds)
            menu.overrideUserInterfaceStyle = source.traitCollection.userInterfaceStyle
            menu.source = source
            menu.didDismiss = onDismiss
            menu.sourceBounds = source.bounds
            menu.selectionRange = (source as? UITextView)?.selectedRange
            menu.pdfText = (source as? PDFView)?.currentSelection?.string
            @MainActor func collectScrolls(_ view: UIView) {
                if let scroll = view as? UIScrollView { menu.observedScrollViews.append((scroll, scroll.contentOffset)) }
                view.subviews.forEach(collectScrolls)
            }
            collectScrolls(source)
            var ancestor = source.superview
            while let view = ancestor {
                if let scroll = view as? UIScrollView { menu.observedScrollViews.append((scroll, scroll.contentOffset)) }
                ancestor = view.superview
            }
            menu.sourceFrame = source.convert(source.bounds, to: window)
            menu.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            menu.configure(elements: elements, anchor: source.convert(rect, to: window), window: window)
            window.addSubview(menu)
            current = menu
            menu.reveal()
        }
        return UIMenu(children: [])
    }

    static func dismiss(from source: UIView) {
        if pendingSource === source { presentationID = UUID(); pendingSource = nil }
        if current?.source === source { current?.close() }
    }

    private func configure(elements: [UIMenuElement], anchor: CGRect, window: UIWindow) {
        if UIAccessibility.isReduceTransparencyEnabled {
            panel.backgroundColor = .secondarySystemBackground
        } else {
            let glass = UIGlassEffect(style: .regular)
            glass.isInteractive = true
            self.glass = glass
        }
        panel.layer.cornerRadius = 26
        panel.clipsToBounds = true
        addSubview(motionHost)
        motionHost.addSubview(panel)
        func flattened(_ elements: [UIMenuElement]) -> [UIMenuElement] {
            elements.flatMap { ($0 as? UIMenu).map { flattened($0.children) } ?? [$0] }
        }
        let all = flattened(elements)
        actions = all.filter { $0.title == ReadingSelectionMenu.lookupTitle }
            + all.filter { $0.title == "荧光笔" }
            + all.filter { $0.title != ReadingSelectionMenu.lookupTitle && $0.title != "荧光笔" }
        self.anchor = anchor
        safeBounds = window.bounds.inset(by: window.safeAreaInsets).insetBy(dx: 16, dy: 10)
        renderRail()
        accessibilityViewIsModal = false
        monitor = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated {
                guard let self else { return }
                guard let source = self.source, source.window != nil,
                      source.bounds == self.sourceBounds,
                      (source as? UITextView)?.selectedRange == self.selectionRange,
                      (source as? PDFView)?.currentSelection?.string == self.pdfText,
                      self.observedScrollViews.allSatisfy({ $0.0.contentOffset == $0.1 }),
                      source.convert(source.bounds, to: source.window) == self.sourceFrame else { self.close(); return }
                if self.overrideUserInterfaceStyle != source.traitCollection.userInterfaceStyle {
                    self.overrideUserInterfaceStyle = source.traitCollection.userInterfaceStyle
                }
            }
        }
    }

    private func renderRail() {
        let endPadding: CGFloat = 4
        let availableWidth = safeBounds.width - endPadding * 2
        let row = makeRow()
        row.spacing = 4
        row.accessibilityIdentifier = "reading-selection-compact"
        let primary = actions.first { $0.title == ReadingSelectionMenu.lookupTitle }
        let trailing = actions.filter { $0 !== primary }
        var primaryWidth: CGFloat = 0
        var height: CGFloat = 44
        if let primary {
            let button = makeButton(primary)
            let size = button.systemLayoutSizeFitting(UIView.layoutFittingCompressedSize)
            primaryWidth = min(size.width, availableWidth * 0.5)
            height = max(height, size.height)
            button.widthAnchor.constraint(equalToConstant: primaryWidth).isActive = true
            row.addArrangedSubview(button)
        }
        let scroller = UIScrollView()
        scroller.accessibilityIdentifier = "reading-selection-rail"
        scroller.showsHorizontalScrollIndicator = false
        scroller.bounces = false
        scroller.delegate = self
        rail = scroller
        let strip = makeRow(); strip.translatesAutoresizingMaskIntoConstraints = false
        scroller.addSubview(strip)
        var total: CGFloat = 0
        for (index, element) in trailing.enumerated() {
            if index > 0 {
                let divider = UIView(); divider.backgroundColor = UIColor.separator.withAlphaComponent(0.3)
                divider.widthAnchor.constraint(equalToConstant: 0.5).isActive = true
                divider.heightAnchor.constraint(equalToConstant: 18).isActive = true
                strip.addArrangedSubview(divider); total += 0.5
            }
            let button = makeButton(element)
            let measured = button.systemLayoutSizeFitting(UIView.layoutFittingCompressedSize)
            total += measured.width; height = max(height, measured.height)
            button.widthAnchor.constraint(equalToConstant: measured.width).isActive = true
            strip.addArrangedSubview(button)
        }
        let gap: CGFloat = primary == nil || trailing.isEmpty ? 0 : 4
        let overflow = primaryWidth + gap + total > availableWidth
        let arrowWidth: CGFloat = overflow ? 40 : 0
        let viewport = max(0, min(total, availableWidth - primaryWidth - gap - arrowWidth))
        if !trailing.isEmpty {
            row.addArrangedSubview(scroller)
            NSLayoutConstraint.activate([
                scroller.widthAnchor.constraint(equalToConstant: viewport),
                scroller.heightAnchor.constraint(equalToConstant: height),
                strip.leadingAnchor.constraint(equalTo: scroller.contentLayoutGuide.leadingAnchor),
                strip.trailingAnchor.constraint(equalTo: scroller.contentLayoutGuide.trailingAnchor),
                strip.topAnchor.constraint(equalTo: scroller.contentLayoutGuide.topAnchor),
                strip.bottomAnchor.constraint(equalTo: scroller.contentLayoutGuide.bottomAnchor),
                strip.heightAnchor.constraint(equalTo: scroller.frameLayoutGuide.heightAnchor)
            ])
        }
        if overflow {
            let more = makeButton(UIAction(title: "更多", image: UIImage(systemName: "chevron.right")) { [weak self] _ in self?.advanceRail() }, dismisses: false, iconOnly: true)
            more.widthAnchor.constraint(equalToConstant: 36).isActive = true
            more.heightAnchor.constraint(equalToConstant: 36).isActive = true
            row.addArrangedSubview(more); overflowButton = more
        }
        let size = CGSize(width: primaryWidth + gap + viewport + arrowWidth + endPadding * 2, height: height)
        let above = anchor.minY - size.height - 10
        let y = above >= safeBounds.minY ? above : min(safeBounds.maxY - size.height, anchor.maxY + 10)
        panel.frame = CGRect(x: min(max(safeBounds.minX, anchor.midX - size.width / 2), safeBounds.maxX - size.width), y: max(safeBounds.minY, y), width: size.width, height: size.height)
        motionHost.frame = panel.frame
        motionHost.layer.shadowColor = UIColor.black.cgColor
        motionHost.layer.shadowOpacity = 0.14
        motionHost.layer.shadowRadius = 20
        motionHost.layer.shadowOffset = CGSize(width: 0, height: 6)
        motionHost.layer.shadowPath = UIBezierPath(roundedRect: motionHost.bounds, cornerRadius: size.height / 2).cgPath
        panel.frame = motionHost.bounds
        panel.layer.cornerRadius = size.height / 2
        row.frame = panel.bounds.insetBy(dx: endPadding, dy: 0)
        panel.contentView.addSubview(row); content = row
        row.layoutIfNeeded()
        primarySurface?.layer.cornerRadius = max(0, (height - 8) / 2)
        scrollViewDidScroll(scroller)
    }

    private func advanceRail() {
        guard let rail else { return }
        let end = max(0, rail.contentSize.width - rail.bounds.width)
        let target: CGFloat
        if rail.contentOffset.x >= end - 1 { target = 0 }
        else {
            target = min(end, rail.contentOffset.x + rail.bounds.width)
        }
        rail.setContentOffset(CGPoint(x: target, y: 0), animated: !UIAccessibility.isReduceMotionEnabled)
    }

    func scrollViewDidScroll(_ scrollView: UIScrollView) {
        guard let button = overflowButton else { return }
        let atEnd = scrollView.contentOffset.x >= scrollView.contentSize.width - scrollView.bounds.width - 1
        button.accessibilityLabel = atEnd ? "返回" : "更多"
        button.accessibilityIdentifier = atEnd ? "reading-selection-返回" : "reading-selection-更多"
        let icon = button.subviews.compactMap { $0 as? UIStackView }.first?.arrangedSubviews.compactMap { $0 as? UIImageView }.first
        icon?.image = UIImage(systemName: atEnd ? "chevron.left" : "chevron.right")
    }

    private func makeRow() -> UIStackView {
        let row = UIStackView()
        row.axis = .horizontal; row.spacing = 0; row.alignment = .center
        return row
    }

    private func makeButton(_ element: UIMenuElement, dismisses: Bool = true, iconOnly: Bool = false) -> UIButton {
        let primary = element.title == ReadingSelectionMenu.lookupTitle
        let button = SelectionGlassButton(type: .custom)
        if let action = element as? UIAction {
            button.addAction(action, for: .touchUpInside)
            button.isEnabled = !action.attributes.contains(.disabled)
        } else if let command = element as? UICommand {
            button.isEnabled = !command.attributes.contains(.disabled)
            button.addAction(UIAction { [weak self] _ in
                guard let source = self?.source else { return }
                UIApplication.shared.sendAction(command.action, to: nil, from: source, for: nil)
            }, for: .touchUpInside)
        }
        let destructive = (element as? UIAction)?.attributes.contains(.destructive) == true
        let ink: UIColor = destructive ? .systemRed : primary ? .white : .label
        let content = UIStackView()
        content.axis = .horizontal; content.alignment = .center; content.spacing = 6
        content.isUserInteractionEnabled = false
        content.translatesAutoresizingMaskIntoConstraints = false
        let utilitySymbol = ["辞典", "查询", "查詢", "定义", "定義", "Look Up", "Define"].contains(element.title) ? "character.book.closed" : "doc.on.doc"
        let image = element.image ?? UIImage(systemName: element.title == "搜索" ? "magnifyingglass" : utilitySymbol)
        let icon = UIImageView(image: image)
        icon.preferredSymbolConfiguration = UIImage.SymbolConfiguration(pointSize: 15, weight: .regular)
        icon.contentMode = .scaleAspectFit; icon.tintColor = ink
        icon.widthAnchor.constraint(equalToConstant: element.title.isEmpty ? 24 : 17).isActive = true
        icon.heightAnchor.constraint(equalToConstant: element.title.isEmpty ? 24 : 17).isActive = true
        if primary || element.title == "荧光笔" || iconOnly || element.title.isEmpty {
            content.addArrangedSubview(icon)
        }
        if !iconOnly && !element.title.isEmpty {
            let label = ReadingMenuLabel()
            label.text = element.title
            let learningAction = primary || element.title == "荧光笔"
            let face = learningAction ? ReadingMenuTypography.learningFont() : LeximoryTypography.interfaceUI(15)
            label.font = UIFontMetrics(forTextStyle: .subheadline).scaledFont(for: face)
            label.numberOfLines = 1
            if primary { label.adjustsFontSizeToFitWidth = true; label.minimumScaleFactor = 0.8 }
            label.textColor = ink
            label.setContentCompressionResistancePriority(primary ? .defaultHigh : .required, for: .horizontal)
            content.addArrangedSubview(label)

        }
        if primary {
            let wash = UIView()
            wash.isUserInteractionEnabled = false
            primarySurface = wash
            wash.backgroundColor = UIColor(red: 67 / 255, green: 73 / 255, blue: 67 / 255, alpha: 1)
            wash.layer.borderWidth = 0.5
            wash.layer.borderColor = UIColor.white.withAlphaComponent(0.18).cgColor
            wash.layer.cornerRadius = 18
            wash.translatesAutoresizingMaskIntoConstraints = false
            button.addSubview(wash)
            NSLayoutConstraint.activate([
                wash.leadingAnchor.constraint(equalTo: button.leadingAnchor),
                wash.trailingAnchor.constraint(equalTo: button.trailingAnchor),
                wash.topAnchor.constraint(equalTo: button.topAnchor, constant: 4),
                wash.bottomAnchor.constraint(equalTo: button.bottomAnchor, constant: -4)
            ])
        }
        if element.title == "荧光笔" {
            content.removeArrangedSubview(icon); icon.removeFromSuperview()
            let well = UIView()
            well.backgroundColor = UIColor { traits in
                EbookHighlightColor.sage.ink.withAlphaComponent(traits.userInterfaceStyle == .dark ? 0.3 : 0.65)
            }
            well.layer.cornerRadius = 6
            well.widthAnchor.constraint(equalToConstant: 23).isActive = true
            well.heightAnchor.constraint(equalToConstant: 23).isActive = true
            icon.translatesAutoresizingMaskIntoConstraints = false
            well.addSubview(icon)
            NSLayoutConstraint.activate([
                icon.centerXAnchor.constraint(equalTo: well.centerXAnchor),
                icon.centerYAnchor.constraint(equalTo: well.centerYAnchor)
            ])
            content.insertArrangedSubview(well, at: 0)
        }
        button.addSubview(content)
        NSLayoutConstraint.activate([
            content.leadingAnchor.constraint(equalTo: button.leadingAnchor, constant: iconOnly ? 0 : primary ? 14 : 10),
            content.trailingAnchor.constraint(equalTo: button.trailingAnchor, constant: iconOnly ? 0 : primary ? -14 : -10),
            content.topAnchor.constraint(equalTo: button.topAnchor, constant: iconOnly ? 0 : 8),
            content.bottomAnchor.constraint(equalTo: button.bottomAnchor, constant: iconOnly ? 0 : -8),
            button.heightAnchor.constraint(greaterThanOrEqualToConstant: iconOnly ? 36 : 44),
            button.widthAnchor.constraint(greaterThanOrEqualToConstant: iconOnly ? 36 : 44)
        ])
        button.backgroundColor = iconOnly ? UIColor.tertiaryLabel.withAlphaComponent(0.08) : .clear
        button.layer.cornerRadius = 22
        content.alpha = button.isEnabled ? 1 : 0.3
        button.isAccessibilityElement = true
        button.accessibilityIdentifier = (element as? UIAction)?.identifier == ReadingSelectionMenu.searchIdentifier
            ? "reading-selection-web-search"
            : "reading-selection-" + (element.title.isEmpty ? ((element as? UIAction)?.discoverabilityTitle ?? "color") : element.title)
        button.accessibilityLabel = element.accessibilityLabel ?? (element.title.isEmpty ? (element as? UIAction)?.discoverabilityTitle : element.title)
        if dismisses {
            button.addAction(UIAction { [weak self] _ in
                self?.close()
            }, for: .touchUpInside)
        }
        return button
    }

    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        guard motionHost.frame.contains(point) else {
            if event?.type == .touches { close() }
            return nil
        }
        return super.hitTest(point, with: event)
    }

    override func accessibilityPerformEscape() -> Bool { close(); return true }

    private func reveal() {
        panel.effect = glass
        content?.alpha = 1
        let frame = motionHost.frame
        let pivot = CGPoint(x: min(1, max(0, (anchor.midX - frame.minX) / frame.width)),
                            y: anchor.midY < frame.midY ? 0 : 1)
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        motionHost.layer.anchorPoint = pivot
        motionHost.layer.position = CGPoint(x: frame.minX + frame.width * pivot.x,
                                       y: frame.minY + frame.height * pivot.y)
        motionHost.layer.opacity = 1
        motionHost.layer.setAffineTransform(.identity)
        CATransaction.commit()
        enteredAt = CACurrentMediaTime()
        motionHost.layer.add(ReadingMenuMotion.animation(entering: true, reduceMotion: UIAccessibility.isReduceMotionEnabled),
                        forKey: "selection-menu-transition")
    }

    private func close(animated: Bool = true) {
        if isClosing {
            if !animated { motionHost.layer.removeAllAnimations(); removeFromSuperview() }
            return
        }
        isClosing = true
        monitor?.invalidate(); monitor = nil
        if Self.current === self { Self.current = nil }
        let completion = didDismiss; didDismiss = nil; completion?()
        guard animated else { motionHost.layer.removeAllAnimations(); removeFromSuperview(); return }
        isUserInteractionEnabled = false
        let presentation = motionHost.layer.presentation()
        let scale = presentation.map { Double($0.transform.m11) } ?? 1
        let opacity = presentation.map { Double($0.opacity) } ?? 1
        let elapsed = enteredAt.map { CACurrentMediaTime() - $0 } ?? 1
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        CATransaction.setCompletionBlock { [weak self] in self?.removeFromSuperview() }
        motionHost.layer.removeAnimation(forKey: "selection-menu-transition")
        motionHost.layer.opacity = 0
        motionHost.layer.add(ReadingMenuMotion.animation(entering: false, fromScale: scale, fromOpacity: opacity,
            velocity: elapsed < 0.4 ? ReadingMenuMotion.entranceVelocity(at: elapsed) : 0,
            reduceMotion: UIAccessibility.isReduceMotionEnabled), forKey: "selection-menu-transition")
        CATransaction.commit()
    }

}

@MainActor enum ReadingMenuTypography {
    private static let learningSample = "猫忆查荧光笔"
    private static let utilitySample = "辞典拷贝"

    static func learningFont() -> UIFont {
        // Cascade descriptors discard the display face's scale matrix. Use the fixed
        // Chinese face directly and match its ink height to the utility face.
        let reference = LeximoryTypography.interfaceUI(15)
        let face = LeximoryTypography.face("Fontquan-XinYiJiXiangSong-Regular", size: 15)
        let ratio = inkBounds(text: utilitySample, font: reference).height
            / inkBounds(text: learningSample, font: face).height
        return face.withSize(15 * ratio)
    }

    static func inkBounds(text: String, font: UIFont) -> CGRect {
        CTLineGetBoundsWithOptions(line(text: text, font: font), [.useGlyphPathBounds])
    }

    private static func line(text: String, font: UIFont) -> CTLine {
        CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: [.font: font]))
    }
}

/// Centers visible ink rather than the unrelated line boxes of the two font families.
final class ReadingMenuLabel: UILabel {
    override var intrinsicContentSize: CGSize {
        guard let text, let font else { return .zero }
        let ink = ReadingMenuTypography.inkBounds(text: text, font: font)
        return CGSize(width: ceil(ink.width), height: ceil(ink.height))
    }

    override func drawText(in rect: CGRect) {
        guard let text, let font, let context = UIGraphicsGetCurrentContext() else { return }
        let ink = ReadingMenuTypography.inkBounds(text: text, font: font)
        guard ink.width > 0, ink.height > 0 else { return }
        let scale = adjustsFontSizeToFitWidth ? min(1, max(minimumScaleFactor, bounds.width / ink.width)) : 1
        let color = textColor.resolvedColor(with: traitCollection).cgColor
        let attributed = NSAttributedString(string: text, attributes: [
            .font: font,
            NSAttributedString.Key(kCTForegroundColorAttributeName as String): color
        ])
        let line = CTLineCreateWithAttributedString(attributed)
        context.saveGState()
        context.textMatrix = .identity
        context.translateBy(x: bounds.midX - ink.midX * scale,
                            y: bounds.midY + ink.midY * scale)
        context.scaleBy(x: scale, y: -scale)
        context.textPosition = .zero
        CTLineDraw(line, context)
        context.restoreGState()
    }
}

// Fitted to the supplied ScreenRecording_10-31-2026 18-25-33_1.mov using its frame timestamps.
// Scale and opacity have separate tracks; the pivot is the selection's nearest menu edge.
private enum ReadingMenuMotion {
    static func entranceVelocity(at time: Double) -> Double {
        let damping = 0.8485596031
        let frequency = 23.3779488791
        let damped = frequency * sqrt(1 - damping * damping)
        return (1 - 0.2505451395) * exp(-damping * frequency * time)
            * frequency * frequency / damped * sin(damped * time)
    }

    static func animation(entering: Bool, fromScale: Double = 1, fromOpacity: Double = 1,
                          velocity: Double = 0, reduceMotion: Bool) -> CAAnimationGroup {
        let duration = reduceMotion ? 0.12 : entering ? 0.4 : 0.25
        let opacity = CAKeyframeAnimation(keyPath: "opacity")
        let times: [Double]
        let values: [Double]
        if reduceMotion {
            times = [0, duration]; values = entering ? [0, 1] : [fromOpacity, 0]
        } else if entering {
            times = [0, 0.01389, 0.03056, 0.04723, 0.06389, 0.08056, 0.09723, 0.11389,
                     0.13056, 0.14723, 0.16389, 0.18056, 0.19723, duration]
            values = [0, 0.004, 0.255, 0.424, 0.569, 0.694, 0.8, 0.859, 0.914, 0.937, 0.98, 0.996, 1, 1]
        } else {
            times = [0, 0.01667, 0.03333, 0.05, 0.06667, 0.08333, 0.1, 0.11667,
                     0.13333, 0.15, 0.16667, 0.18333, 0.2, 0.21667, 0.23333, duration]
            values = [1, 0.976, 0.91, 0.796, 0.69, 0.561, 0.455, 0.345,
                      0.247, 0.184, 0.118, 0.078, 0.059, 0.031, 0.008, 0].map { $0 * fromOpacity }
        }
        opacity.keyTimes = times.map { NSNumber(value: $0 / duration) }
        opacity.values = values
        opacity.calculationMode = .linear
        opacity.duration = duration
        var tracks: [CAAnimation] = [opacity]
        if !reduceMotion {
            let damping = entering ? 0.8485596031 : 0.8102735550
            let frequency = entering ? 23.3779488791 : 19.2726324483
            let start = entering ? 0.2505451395 : fromScale
            let target = entering ? 1 : 0.2264864855
            let spring = CASpringAnimation(keyPath: "transform.scale")
            spring.mass = 1
            spring.stiffness = frequency * frequency
            spring.damping = 2 * damping * frequency
            spring.initialVelocity = abs(target - start) > 0.0001 ? velocity / (target - start) : 0
            spring.fromValue = start
            spring.toValue = target
            spring.duration = duration
            spring.timingFunction = CAMediaTimingFunction(name: .linear)
            tracks.append(spring)
        }
        let group = CAAnimationGroup()
        group.animations = tracks
        group.duration = duration
        group.timingFunction = CAMediaTimingFunction(name: .linear)
        return group
    }
}

private final class SelectionGlassButton: UIButton {
    override var isHighlighted: Bool {
        didSet {
            guard !UIAccessibility.isReduceMotionEnabled else { return }
            UIView.animate(withDuration: 0.12, delay: 0, options: [.beginFromCurrentState, .allowUserInteraction]) {
                self.transform = self.isHighlighted ? CGAffineTransform(scaleX: 0.96, y: 0.96) : .identity
            }
        }
    }
}
