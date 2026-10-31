import Foundation
import Testing
import UIKit
import PDFKit
import LeximoryCore
@testable import Leximory

@Suite(.serialized)
@MainActor struct ReadingMenuTests {
    @Test(arguments: [false, true]) func articleKeepsNativeDefineAfterLeximoryActions(offline: Bool) throws {
        let document = try JSONDecoder().decode(ReadingDocument.self, from: Data(#"{"version":1,"revision":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","source":"bank","blocks":[{"id":"block","kind":"paragraph","sourceRange":{"location":0,"length":4},"displayText":"bank","spans":[]}]}"#.utf8))
        let parent = ReadingTextView(document: document, textID: TextID(rawValue: "text"), jumpToEnd: false,
            readOnly: offline, onDefine: { _, _, _ in })
        let copy = UIAction(title: "Copy") { _ in }
        let nativeDefine = UIAction(title: "Define") { _ in }
        let define = UIMenu(title: "Define", identifier: .lookup, children: [nativeDefine])
        let menu = try #require(parent.makeCoordinator().textView(UITextView(),
            editMenuForTextIn: NSRange(location: 0, length: 4), suggestedActions: [copy, define]))
        #expect(menu.children.isEmpty)
    }

    @Test func customMenuRendersPrimaryActionAndDispatchesCapturedAction() async throws {
        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 390, height: 844))
        let source = UIView(frame: window.bounds)
        window.addSubview(source)
        var invoked = false
        let lookup = UIAction(title: ReadingSelectionMenu.lookupTitle, image: ReadingSelectionMenu.lookupImage) { _ in invoked = true }
        let highlight = UIAction(title: "荧光笔", image: UIImage(systemName: "highlighter"), attributes: .disabled) { _ in }
        let native = ReadingGlassMenu.present(from: source, rect: CGRect(x: 30, y: 200, width: 120, height: 24), elements: [highlight, lookup, UIAction(title: "查询") { _ in }, UIAction(title: "拷贝") { _ in }, UIAction(title: "搜索") { _ in }])
        #expect(native.children.isEmpty)
        await withCheckedContinuation { continuation in
            DispatchQueue.main.async { continuation.resume() }
        }
        let overlay = try #require(window.subviews.first { $0 is ReadingGlassMenu })
        func buttons(in view: UIView) -> [UIButton] {
            (view as? UIButton).map { [$0] } ?? view.subviews.flatMap { buttons(in: $0) }
        }
        let controls = buttons(in: overlay)
        #expect(controls.first?.accessibilityLabel == "猫忆查")
        #expect(controls.first?.subviews.contains { $0 is UIStackView } == true)
        overlay.layoutIfNeeded()
        #expect(controls.first?.bounds.width ?? 0 > 70)
        #expect(controls.first { $0.accessibilityLabel == "荧光笔" }?.isEnabled == false)
        controls.first?.sendActions(for: .touchUpInside)
        #expect(invoked)
        ReadingGlassMenu.dismiss(from: source)
    }

    @Test(arguments: [280.0, 600.0]) func fittingActionsStayVisibleAndOverflowExpands(width: Double) async throws {
        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: width, height: 844))
        let source = UIView(frame: window.bounds); source.overrideUserInterfaceStyle = .dark; window.addSubview(source)
        let titles = ["猫忆查", "荧光笔", "拷贝", "查询", "搜索"]
        ReadingGlassMenu.present(from: source, rect: CGRect(x: 30, y: 300, width: 100, height: 24),
            elements: titles.map { UIAction(title: $0) { _ in } })
        await withCheckedContinuation { continuation in DispatchQueue.main.async { continuation.resume() } }
        let menu = try #require(window.subviews.first { $0 is ReadingGlassMenu })
        menu.layoutIfNeeded()
        #expect(menu.traitCollection.userInterfaceStyle == .dark)
        func controls(_ view: UIView) -> [UIButton] {
            (view as? UIButton).map { [$0] } ?? view.subviews.flatMap(controls)
        }
        let buttons = controls(menu)
        let more = buttons.first { $0.accessibilityIdentifier == "reading-selection-更多" }
        if width == 600 {
            #expect(more == nil)
            #expect(buttons.map(\.accessibilityLabel).compactMap { $0 } == titles)
        } else {
            let expand = try #require(more)
            expand.sendActions(for: .touchUpInside)
            #expect(controls(menu).filter { $0.accessibilityLabel == "搜索" }.isEmpty == false)

        }
        ReadingGlassMenu.dismiss(from: source)
    }

    @Test(arguments: [false, true]) func ebookHidesLookupAndPreservesDisabledBookmarkOffline(offline: Bool) {
        let reader = EbookReaderState()
        reader.readOnly = offline
        let actions = EbookLearningMenu.actions(reader: reader)
        #expect(actions.contains { $0.title == ReadingSelectionMenu.lookupTitle } == !offline)
        let bookmark = actions.first { $0.title == "荧光笔" }
        #expect(bookmark != nil)
        if offline { #expect((bookmark as? UIAction)?.attributes.contains(.disabled) == true) }
    }
    @Test(arguments: EbookHighlightColor.allCases)
    func pdfHighlightActionsUseSavedBookmarkAfterCreatingAndRecoloring(color: EbookHighlightColor) throws {
        let reader = EbookReaderState()
        reader.format = "pdf"; reader.canBookmark = true
        let selection = EbookSelection(quote: "river", context: "The river flows.", offset: 4, location: "3")
        reader.selection = selection; reader.menuSelection = selection
        let highlighter = try #require(EbookLearningMenu.actions(reader: reader).first { $0.title == "荧光笔" } as? UIAction)
        UIButton(primaryAction: highlighter).sendActions(for: .touchUpInside)
        let action = try #require(reader.selectionAction)
        guard case .bookmark = action.kind else { Issue.record("Expected a highlight action"); return }
        let pending = reader.beginBookmark(action.selection)
        #expect(reader.selection == nil)
        #expect(reader.menuSelection == nil)
        reader.menuSelection = selection
        let menu = EbookLearningMenu.actions(reader: reader)
        #expect(menu.contains { $0.title == "荧光笔" } == false)
        let palette = try #require(menu.first as? UIMenu)
        let swatch = try #require(palette.children.compactMap { $0 as? UIAction }.first { $0.accessibilityLabel == color.title })
        #expect(swatch.attributes.contains(.disabled) == false)
        UIButton(primaryAction: swatch).sendActions(for: .touchUpInside)
        let request = try #require(reader.bookmarkColorRequest)
        #expect(request.bookmarkID == pending.id && request.color == color)
        _ = reader.beginBookmarkColorChange(request)
        let reopened = EbookLearningMenu.actions(reader: reader)
        let reopenedPalette = try #require(reopened.first as? UIMenu)
        #expect(reopenedPalette.children.compactMap { $0 as? UIAction }.allSatisfy { !$0.attributes.contains(.disabled) })
        let remove = try #require(reopened.first { $0.title == "移除" } as? UIAction)
        #expect(remove.attributes.contains(.disabled) == false)
        UIButton(primaryAction: remove).sendActions(for: .touchUpInside)
        #expect(reader.bookmarkRemovalRequest == pending.id)
    }

    @Test func pdfHighlightActionsStayEditableWhilePendingAndRespectReadOnlyAccess() throws {
        let reader = EbookReaderState()
        reader.format = "pdf"; reader.canBookmark = true
        let selection = EbookSelection(quote: "river", context: "river", offset: 0, location: "1")
        reader.selection = selection
        let pending = reader.beginBookmark(selection)
        reader.menuSelection = selection
        func removeAction() throws -> UIAction {
            try #require(EbookLearningMenu.actions(reader: reader).first { $0.title == "移除" } as? UIAction)
        }
        #expect(pending.id < 0)
        #expect(try removeAction().attributes.contains(.disabled) == false)
        let savedAction = try removeAction()
        #expect(savedAction.attributes.contains(.disabled) == false)
        reader.readOnly = true
        #expect(try removeAction().attributes.contains(.disabled))
        UIButton(primaryAction: savedAction).sendActions(for: .touchUpInside)
        #expect(reader.bookmarkRemovalRequest == nil)
    }
    @Test func offlineHighlightsRemainEditable() throws {
        let reader = EbookReaderState()
        reader.format = "pdf"; reader.canBookmark = true
        reader.readOnly = true; reader.offline = true
        let selection = EbookSelection(quote: "river", context: "river", offset: 0, location: "1")
        let pending = reader.beginBookmark(selection)
        reader.menuSelection = selection
        let actions = EbookLearningMenu.highlightActions(reader: reader, selection: selection)
        #expect(!actions.contains { $0.title == ReadingSelectionMenu.lookupTitle })
        let palette = try #require(actions.first as? UIMenu)
        #expect(palette.children.compactMap { $0 as? UIAction }.allSatisfy { !$0.attributes.contains(.disabled) })
        #expect(reader.beginBookmarkColorChange(.init(bookmarkID: pending.id, color: .pink)) != nil)
        #expect(reader.bookmarks.first?.color == .pink)
    }

    @Test(arguments: [false, true])
    func pdfKeepsDisabledHighlighterWhenEditingIsUnavailable(offline: Bool) throws {
        let reader = EbookReaderState()
        reader.format = "pdf"; reader.readOnly = offline; reader.canBookmark = offline
        let action = try #require(EbookLearningMenu.actions(reader: reader).first { $0.title == "荧光笔" } as? UIAction)
        #expect(action.attributes.contains(.disabled))
    }
    @Test func tappingAndReopeningPDFHighlightDoesNotCreateANativeTextSelection() throws {
        let data = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: 400, height: 600)).pdfData { context in
            context.beginPage()
            ("A river flows." as NSString).draw(at: CGPoint(x: 30, y: 80), withAttributes: [.font: UIFont.systemFont(ofSize: 20)])
        }
        let reader = EbookReaderState()
        reader.format = "pdf"; reader.canBookmark = true
        reader.bookmarks = [EbookBookmark(id: 42, quote: "river", chapter: nil, location: "1")]
        let pdf = LearningPDFView(frame: CGRect(x: 0, y: 0, width: 400, height: 600))
        pdf.reader = reader; pdf.document = PDFDocument(data: data)
        let scene = try #require(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let previous = scene.windows.first { $0.isKeyWindow }
        let window = UIWindow(windowScene: scene)
        let host = UIViewController(); host.view = pdf
        window.rootViewController = host; window.makeKeyAndVisible()
        defer { pdf.dismissSelection(); window.isHidden = true; window.rootViewController = nil; previous?.makeKey() }
        pdf.layoutIfNeeded()
        let coordinator = PDFReaderView.Coordinator(reader: reader)
        let page = try #require(pdf.document?.page(at: 0))
        for color in [EbookHighlightColor.sage, .blue, .pink] {
            reader.bookmarks = [EbookBookmark(id: 42, quote: "river", chapter: nil, location: "1", color: color)]
            coordinator.updateBookmarks(in: pdf)
            let marker = try #require(page.annotations.first as? EbookPDFHighlight)
            let point = pdf.convert(CGPoint(x: marker.bounds.midX, y: marker.bounds.midY), from: page)
            #expect(pdf.presentHighlightMenu(at: point))
            #expect(pdf.currentSelection == nil)
            #expect(reader.menuSelection?.quote == "river")
            #expect(reader.menuSelection?.context == "A river flows.")
            #expect(reader.menuSelection?.offset == 2)
            pdf.dismissSelection()
            #expect(pdf.currentSelection == nil)
        }
    }

    @Test func browserFilteringPreservesNativeDefineAndItsOriginalAction() throws {
        let native = UIAction(title: "Define") { _ in }
        let extras = ["查找所选内容", "翻译", "搜索网页"].map { UIAction(title: $0) { _ in } }
        let lookup = UIMenu(title: "", identifier: .lookup, children: [native] + extras)
        let copy = UICommand(title: "Copy", action: #selector(UIResponderStandardEditActions.copy(_:)))
        let selectAll = UICommand(title: "Select All", action: #selector(UIResponderStandardEditActions.selectAll(_:)))
        let children = ReadingSelectionMenu.copyAndLookupActions([copy, selectAll, lookup])
        #expect(children.count == 2)
        #expect(children.last === native)
        #expect(native.title == "辞典")
        let nested = UIMenu(children: [lookup])
        let nativeActions = ReadingSelectionMenu.nativeLookupActions(in: [copy, nested])
        #expect(nativeActions.count == 1)
        #expect(nativeActions.first === native)
    }

    @Test(arguments: [(BrowserSearchEngine.bing, "Bing"), (.google, "Google"), (.duckDuckGo, "DuckDuckGo"), (.baidu, "百度")])
    func selectionSearchUsesConfiguredEngine(engine: BrowserSearchEngine, title: String) throws {
        let domain = "selection-search-" + UUID().uuidString
        let defaults = try #require(UserDefaults(suiteName: domain))
        defer { defaults.removePersistentDomain(forName: domain) }
        defaults.set(engine.rawValue, forKey: "browser.searchEngine")
        let selected = BrowserSearchEngine.selected(in: defaults)
        var query: String?
        let action = ReadingSelectionMenu.searchAction(query: " river ", engine: selected) { query = $0 }
        #expect(action.title == title)
        #expect(action.identifier == ReadingSelectionMenu.searchIdentifier)
        UIButton(primaryAction: action).sendActions(for: .touchUpInside)
        #expect(query == "river")
    }

    @Test func learningActionGlyphsMatchUtilityInkHeight() {
        let font = ReadingMenuTypography.learningFont()
        #expect(font.fontName == "Fontquan-XinYiJiXiangSong-Regular")
        let height = ReadingMenuTypography.inkBounds(text: "猫忆查荧光笔", font: font).height
        #expect(abs(height - 14.52) < 0.1)
    }

    @Test(arguments: ["猫忆查", "荧光笔", "辞典", "拷贝", "Bing"])
    func renderedGlyphsShareTheControlCenter(text: String) throws {
        let label = ReadingMenuLabel()
        label.text = text
        label.font = ["猫忆查", "荧光笔"].contains(text) ? ReadingMenuTypography.learningFont() : LeximoryTypography.interfaceUI(15)
        label.textColor = .black
        label.frame = CGRect(origin: .zero, size: label.intrinsicContentSize)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 3; format.opaque = false
        let image = try #require(UIGraphicsImageRenderer(bounds: label.bounds, format: format).image { _ in
            label.drawText(in: label.bounds)
        }.cgImage)
        let width = image.width, height = image.height
        var pixels = [UInt8](repeating: 0, count: width * height * 4)
        let rows = try pixels.withUnsafeMutableBytes { buffer -> [Int] in
            let context = try #require(CGContext(data: buffer.baseAddress, width: width, height: height,
                bitsPerComponent: 8, bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue))
            context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
            let bytes = buffer.bindMemory(to: UInt8.self)
            return (0..<height).filter { y in (0..<width).contains { x in bytes[(y * width + x) * 4 + 3] > 32 } }
        }
        let top = try #require(rows.first), bottom = try #require(rows.last)
        #expect(abs(Double(top + bottom + 1) / 2 - Double(height) / 2) <= 1)
    }

    @Test func existingPDFHighlightOmitsAddHighlight() {
        let actions = EbookLearningMenu.actions(reader: EbookReaderState(), includeBookmark: false)
        #expect(actions.map(\.title) == [ReadingSelectionMenu.lookupTitle, BrowserSearchEngine.selected().name])
    }

}
