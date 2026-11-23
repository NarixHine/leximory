import CoreGraphics
import Testing
@testable import Leximory

struct BrowserHomeShortcutLayoutTests {
    @Test(arguments: [264.0, 267.0, 346.0] as [CGFloat])
    func smallSetsStayOnOneRowAndLargerSetsBalance(width: CGFloat) {
        let layout = BrowserHomeShortcutLayout(accessibility: false)
        let expectedRows = [[1], [2], [3], [4], [3, 2], [3, 3], [4, 3], [4, 4]]
        for (index, expected) in expectedRows.enumerated() {
            #expect(layout.rows(for: width, count: index + 1).map(\.count) == expected)
        }
    }

    @Test func narrowSidePanelHasRoomForTwoPinsOnOneRow() {
        let layout = BrowserHomeShortcutLayout(accessibility: false)
        #expect(layout.columnCapacity(for: 123) == 2)
        #expect(layout.rows(for: 123, count: 2) == [0..<2])
    }
}
