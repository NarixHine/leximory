import Foundation
import Testing
import UIKit
import PDFKit
import LeximoryCore
@testable import Leximory

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
        #expect(menu.children.contains { $0 === copy })
        #expect(!menu.children.contains { $0 === define })
        #expect(menu.children.contains { $0 === nativeDefine })
        #expect(menu.children.contains { $0 is UIMenu } == false)
        #expect(menu.preferredElementSize == .medium)
        let actions = menu.children.flatMap { ($0 as? UIMenu)?.children ?? [$0] }
        #expect(actions.contains { $0.title == ReadingSelectionMenu.lookupTitle } == !offline)
        if !offline { #expect(actions.first?.title == ReadingSelectionMenu.lookupTitle) }
        #expect(actions.contains { $0.title == "Define" })
        #expect(actions.last?.title == "搜索")
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
        let saved = EbookBookmark(id: 42, quote: "river", chapter: nil, location: "3")
        reader.finishBookmark(pending, saved: saved)
        reader.menuSelection = selection
        let menu = EbookLearningMenu.actions(reader: reader)
        #expect(menu.contains { $0.title == "荧光笔" } == false)
        let palette = try #require(menu.first as? UIMenu)
        let swatch = try #require(palette.children.compactMap { $0 as? UIAction }.first { $0.accessibilityLabel == color.title })
        #expect(swatch.attributes.contains(.disabled) == false)
        UIButton(primaryAction: swatch).sendActions(for: .touchUpInside)
        let request = try #require(reader.bookmarkColorRequest)
        #expect(request.bookmarkID == 42 && request.color == color)
        if let previous = reader.beginBookmarkColorChange(request) {
            reader.finishBookmarkColorChange(previous, saved: EbookBookmark(id: 42, quote: "river", chapter: nil, location: "3", color: color))
        }
        let reopened = EbookLearningMenu.actions(reader: reader)
        let reopenedPalette = try #require(reopened.first as? UIMenu)
        #expect(reopenedPalette.children.compactMap { $0 as? UIAction }.allSatisfy { !$0.attributes.contains(.disabled) })
        let remove = try #require(reopened.first { $0.title == "移除" } as? UIAction)
        #expect(remove.attributes.contains(.disabled) == false)
        UIButton(primaryAction: remove).sendActions(for: .touchUpInside)
        #expect(reader.bookmarkRemovalRequest == 42)
    }

    @Test func pdfHighlightActionsRespectPendingSavesAndReadOnlyAccess() throws {
        let reader = EbookReaderState()
        reader.format = "pdf"; reader.canBookmark = true
        let selection = EbookSelection(quote: "river", context: "river", offset: 0, location: "1")
        reader.selection = selection
        let pending = reader.beginBookmark(selection)
        reader.menuSelection = selection
        func removeAction() throws -> UIAction {
            try #require(EbookLearningMenu.actions(reader: reader).first { $0.title == "移除" } as? UIAction)
        }
        #expect(try removeAction().attributes.contains(.disabled))
        reader.finishBookmark(pending, saved: EbookBookmark(id: 42, quote: "river", chapter: nil, location: "1"))
        let savedAction = try removeAction()
        #expect(savedAction.attributes.contains(.disabled) == false)
        reader.readOnly = true
        #expect(try removeAction().attributes.contains(.disabled))
        UIButton(primaryAction: savedAction).sendActions(for: .touchUpInside)
        #expect(reader.bookmarkRemovalRequest == nil)
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
        let nested = UIMenu(children: [lookup])
        let nativeActions = ReadingSelectionMenu.nativeLookupActions(in: [copy, nested])
        #expect(nativeActions.count == 1)
        #expect(nativeActions.first === native)
    }

    @Test func existingPDFHighlightOmitsAddHighlight() {
        let actions = EbookLearningMenu.actions(reader: EbookReaderState(), includeBookmark: false)
        #expect(actions.map(\.title) == [ReadingSelectionMenu.lookupTitle, "搜索"])
    }

}
