import Foundation
import Testing
import UIKit
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
        let defineGroup = try #require(menu.children.compactMap { $0 as? UIMenu }.first { $0.identifier == ReadingSelectionMenu.nativeDefineMenuID })
        #expect(defineGroup.children.first === nativeDefine)
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
        let bookmark = actions.first { $0.title == "🖍️荧光笔" }
        #expect(bookmark != nil)
        if offline { #expect((bookmark as? UIAction)?.attributes.contains(.disabled) == true) }
    }
    @Test(arguments: EbookHighlightColor.allCases)
    func pdfRetainedSelectionUsesSavedHighlightActionsAfterCreatingAndRecoloring(color: EbookHighlightColor) throws {
        let reader = EbookReaderState()
        reader.format = "pdf"; reader.canBookmark = true
        let selection = EbookSelection(quote: "river", context: "The river flows.", offset: 4, location: "3")
        reader.selection = selection; reader.menuSelection = selection
        let highlighter = try #require(EbookLearningMenu.actions(reader: reader).first { $0.title == "🖍️荧光笔" } as? UIAction)
        UIButton(primaryAction: highlighter).sendActions(for: .touchUpInside)
        let action = try #require(reader.selectionAction)
        guard case .bookmark = action.kind else { Issue.record("Expected a highlight action"); return }
        let pending = reader.beginBookmark(action.selection)
        #expect(reader.selection == selection)
        let saved = EbookBookmark(id: 42, quote: "river", chapter: nil, location: "3")
        reader.finishBookmark(pending, saved: saved)
        // PDFKit can rebuild its own menu while retaining the same native selection.
        reader.selection = nil
        let menu = EbookLearningMenu.actions(reader: reader)
        #expect(menu.contains { $0.title == "🖍️荧光笔" } == false)
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
        let action = try #require(EbookLearningMenu.actions(reader: reader).first { $0.title == "🖍️荧光笔" } as? UIAction)
        #expect(action.attributes.contains(.disabled))
    }
    @Test func browserFilteringPreservesNativeDefineAndItsOriginalAction() throws {
        let native = UIAction(title: "Define") { _ in }
        let extras = ["查找所选内容", "翻译", "搜索网页"].map { UIAction(title: $0) { _ in } }
        let lookup = UIMenu(title: "", identifier: .lookup, children: [native] + extras)
        let copy = UICommand(title: "Copy", action: #selector(UIResponderStandardEditActions.copy(_:)))
        let selectAll = UICommand(title: "Select All", action: #selector(UIResponderStandardEditActions.selectAll(_:)))
        let children = ReadingSelectionMenu.copyAndLookupActions([copy, selectAll, lookup])
        #expect(children.count == 2)
        let retained = try #require(children.last as? UIMenu)
        #expect(retained.identifier != .lookup)
        #expect(retained.children.count == 1)
        #expect(retained.children.first === native)
        let nested = UIMenu(children: [lookup])
        let nativeMenus = ReadingSelectionMenu.nativeLookupMenus(in: [copy, nested])
        #expect((nativeMenus.first as? UIMenu)?.identifier != .lookup)
        #expect((nativeMenus.first as? UIMenu)?.children.count == 1)
        #expect((nativeMenus.first as? UIMenu)?.children.first === native)
    }

    @Test func existingPDFHighlightOmitsAddHighlight() {
        let actions = EbookLearningMenu.actions(reader: EbookReaderState(), includeBookmark: false)
        #expect(actions.map(\.title) == [ReadingSelectionMenu.lookupTitle, "搜索"])
    }

}
