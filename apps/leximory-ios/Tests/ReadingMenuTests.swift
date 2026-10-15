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
        let define = UIMenu(title: "Define", identifier: .lookup, children: [UIAction(title: "Define") { _ in }])
        let menu = try #require(parent.makeCoordinator().textView(UITextView(),
            editMenuForTextIn: NSRange(location: 0, length: 4), suggestedActions: [copy, define]))
        #expect(menu.children.contains { $0 === copy })
        #expect(menu.children.contains { $0 === define })
        let actions = menu.children.flatMap { ($0 as? UIMenu)?.children ?? [$0] }
        #expect(actions.contains { $0.title == ReadingSelectionMenu.lookupTitle } == !offline)
        if !offline { #expect(actions.first?.title == ReadingSelectionMenu.lookupTitle) }
        #expect(actions.last?.title == "Define")
    }
    @Test(arguments: [false, true]) func ebookHidesLookupAndPreservesDisabledBookmarkOffline(offline: Bool) {
        let reader = EbookReaderState()
        reader.readOnly = offline
        let actions = EbookLearningMenu.actions(reader: reader)
        #expect(actions.contains { $0.title == ReadingSelectionMenu.lookupTitle } == !offline)
        let bookmark = actions.first { $0.title == "🖍️荧光笔" }
        #expect(bookmark != nil)
        if offline { #expect(bookmark?.attributes.contains(.disabled) == true) }
    }
    @Test func browserFilteringPreservesNativeDefineAndItsOriginalAction() throws {
        let native = UIAction(title: "Define") { _ in }
        let lookup = UIMenu(title: "", identifier: .lookup, children: [native])
        let copy = UICommand(title: "Copy", action: #selector(UIResponderStandardEditActions.copy(_:)))
        let selectAll = UICommand(title: "Select All", action: #selector(UIResponderStandardEditActions.selectAll(_:)))
        let children = ReadingSelectionMenu.copyAndLookupActions([copy, selectAll, lookup])
        #expect(children.count == 2)
        #expect(children.last === lookup)
        #expect((children.last as? UIMenu)?.children.first === native)
        let nested = UIMenu(children: [lookup])
        #expect(ReadingSelectionMenu.nativeLookupMenus(in: [copy, nested]).first === lookup)
    }

    @Test func existingPDFHighlightOmitsAddHighlight() {
        let actions = EbookLearningMenu.actions(reader: EbookReaderState(), includeBookmark: false)
        #expect(actions.map(\.title) == [ReadingSelectionMenu.lookupTitle])
    }

}
