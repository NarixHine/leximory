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
    func pdfColorPaletteKeepsTheSelectionWhenChoosingAColor(color: EbookHighlightColor) throws {
        let reader = EbookReaderState()
        reader.format = "pdf"; reader.canBookmark = true
        reader.selection = EbookSelection(quote: "river", context: "The river flows.", offset: 4, location: "3")
        let menu = try #require(EbookLearningMenu.actions(reader: reader).first { $0.title == "🖍️荧光笔" } as? UIMenu)
        #expect(menu.options.contains(.displayAsPalette))
        let action = try #require(menu.children.compactMap { $0 as? UIAction }.first { $0.title == color.title })
        reader.selection = nil
        let button = UIButton(primaryAction: action)
        button.sendActions(for: .touchUpInside)
        let selectionAction = try #require(reader.selectionAction)
        guard case .bookmark(let selectedColor) = selectionAction.kind else { Issue.record("Expected a highlight action"); return }
        #expect(selectedColor == color)
        #expect(selectionAction.selection.quote == "river")
        #expect(selectionAction.selection.location == "3")
        let pending = reader.beginBookmark(selectionAction.selection, color: selectedColor)
        #expect(reader.bookmarks.first?.color == color)
        let saved = EbookBookmark(id: 42, quote: pending.quote, chapter: pending.chapter, location: pending.location, color: color)
        reader.finishBookmark(pending, saved: saved)
        #expect(reader.bookmarks == [saved])
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
