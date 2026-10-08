import Testing
import UIKit
import LeximoryCore
@testable import Leximory

@MainActor struct EbookEnhancementTests {
    @Test func concurrentBookmarksReconcileIndependently() {
        let reader = EbookReaderState()
        reader.location = "3"; reader.chapter = "Chapter"
        let first = reader.beginBookmark(EbookSelection(quote: "First", context: "First", offset: 0, location: "2"))
        let second = reader.beginBookmark(EbookSelection(quote: "Second", context: "Second", offset: 0))
        #expect(reader.bookmarks.map(\.quote) == ["First", "Second"])
        #expect(first.location == "2"); #expect(second.location == "3")
        #expect(first.id != second.id)
        reader.finishBookmark(second, saved: EbookBookmark(id: 42, quote: second.quote, chapter: second.chapter, location: second.location))
        reader.finishBookmark(first, saved: nil)
        #expect(reader.bookmarks.map(\.id) == [42])
        #expect(reader.bookmarkNotice != nil)
    }

    @Test func pageBoundsIdentifyOuterMarginsForChrome() {
        let reader = EbookReaderState()
        #expect(reader.gutterSide(at: CGPoint(x: 5, y: 200)) == nil)
        reader.pageBounds = CGRect(x: 24, y: 56, width: 342, height: 700)
        #expect(reader.gutterSide(at: CGPoint(x: 5, y: 200)) == false)
        #expect(reader.gutterSide(at: CGPoint(x: 380, y: 200)) == true)
        for x in [24, 60, 97, 195, 293, 340, 366] {
            #expect(reader.gutterSide(at: CGPoint(x: x, y: 200)) == nil)
        }
        #expect(reader.gutterSide(at: CGPoint(x: 5, y: 20)) == nil)
        #expect(reader.gutterSide(at: CGPoint(x: 380, y: 780)) == nil)
    }
}
