import CoreGraphics
import Foundation
import Testing
@testable import Leximory

struct BrowserHomeActivityGridTests {
    @Test func chartBeginsOnAMondayAndKeepsSlotsForTheCurrentWeek() throws {
        let grid = BrowserHomeActivityGrid(width: 346, height: 96, weekday: 2)
        let squares = (0..<grid.slotCount).map(grid.rect(for:))
        let columns = Dictionary(grouping: squares, by: \.minX)
            .sorted { $0.key < $1.key }
            .map(\.value)

        try #require(columns.count == 14)
        #expect(columns.map(\.count) == Array(repeating: 7, count: 14))
        let fullWeekRows = columns[0].map(\.minY)
        #expect(fullWeekRows.first == 0)
        #expect(columns.allSatisfy { $0.map(\.minY) == fullWeekRows })
        #expect(grid.dayCount == 94)
        #expect(grid.rect(for: 93) == columns[13][2])
        #expect(grid.rect(for: 94) == columns[13][3])
    }

    @Test func availableWidthFitsWeeksAndHeightSizesSquares() {
        let compact = BrowserHomeActivityGrid(width: 181, height: 72, weekday: 2)
        let taller = BrowserHomeActivityGrid(width: 181, height: 96, weekday: 2)
        let wider = BrowserHomeActivityGrid(width: 346, height: 72, weekday: 2)

        #expect(compact.dayCount == 80)
        #expect(taller.dayCount == 80)
        #expect(wider.dayCount == 94)
        #expect(compact.rect(for: 0).height < taller.rect(for: 0).height)
        let first = wider.rect(for: 0)
        let last = wider.rect(for: wider.dayCount - 1)
        #expect(abs(first.minX - (346 - last.maxX)) < 0.01)
        #expect(abs(wider.rect(for: 7).minX - first.maxX - 3) < 0.01)
        #expect(abs(wider.rect(for: 1).minY - first.maxY - 3) < 0.01)
    }

    @Test func monthStartsIncludeTheUpcomingNewYearInTheFinalWeek() throws {
        let calendar = SavedWordsSnapshot.calendar
        let today = try #require(calendar.date(from: DateComponents(year: 2025, month: 12, day: 30)))
        let grid = BrowserHomeActivityGrid(width: 181, height: 96, weekday: 1)
        let dates = grid.dates(through: today, calendar: calendar)
        let monthStarts = grid.monthStarts(in: dates, calendar: calendar)

        #expect(dates.count == 84)
        #expect(dates[grid.dayCount - 1] == today)
        #expect(monthStarts.map(\.offset) == [19, 49, 80])
        #expect(monthStarts.map { calendar.component(.month, from: $0.element) } == [11, 12, 1])
        #expect(grid.rect(for: 80).minX == grid.rect(for: 78).minX)
    }

    @Test(arguments: 0...6) func wideHeatmapKeepsTheSameMeasureAllWeek(weekday: Int) {
        let grid = BrowserHomeActivityGrid(width: 379, height: .infinity, weekday: weekday)
        let monday = grid.rect(for: 0)
        let tuesday = grid.rect(for: 1)
        let nextMonday = grid.rect(for: 7)

        #expect(abs(tuesday.minY - monday.maxY - 3) < 0.01)
        #expect(abs(nextMonday.minX - monday.maxX - 3) < 0.01)
        #expect(abs(monday.width - 24.2857) < 0.01)
        #expect(abs(grid.height - 188) < 0.01)
        #expect(grid.dayCount == 92 + weekday)
        #expect(grid.slotCount == 98)
        #expect(abs(grid.rect(for: 97).maxX - 379) < 0.01)
    }
}
