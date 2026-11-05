import Foundation
import Testing
@testable import Leximory

struct SavedWordsWidgetTests {
    @Test func widgetLinksOpenHomeIncludingPreviouslyArchivedAccountLinks() throws {
        #expect(SavedWordsWidgetLink.home.absoluteString == "leximory://home")
        #expect(SavedWordsWidgetLink.opensHome(SavedWordsWidgetLink.home))
        #expect(SavedWordsWidgetLink.opensHome(try #require(URL(string: "leximory://account"))))
        #expect(!SavedWordsWidgetLink.opensHome(try #require(URL(string: "leximory://read/article"))))
        #expect(!SavedWordsWidgetLink.opensHome(try #require(URL(string: "https://example.test/home"))))
    }

    @Test func todayAndRollingPeriodAdvanceAtShanghaiMidnight() throws {
        let snapshot = SavedWordsSnapshot(activity: [("2026-10-01", 5), ("2026-10-30", 12)], endingOn: "2026-10-30")
        let midnight = try #require(ISO8601DateFormatter().date(from: "2026-10-30T16:00:00Z"))
        #expect(snapshot.count(on: midnight.addingTimeInterval(-1)) == 12)
        #expect(snapshot.count(on: midnight) == 0)
        let next = snapshot.ending(on: midnight)
        #expect(next.total == 12)
        #expect(next.days.last?.count == 0)
        #expect(next.days.count == 30)
    }

    @Test func activityUsesThirtyCompleteShanghaiCalendarDays() throws {
        let snapshot = SavedWordsSnapshot(activity: [
            ("2026-10-01", 9), ("2026-10-30", 4), ("2026-10-30", 3),
            ("2026-09-30", 100), ("2026-10-31", 50)
        ], endingOn: "2026-10-30")
        #expect(snapshot.days.count == 30)
        #expect(snapshot.total == 16)
        #expect(snapshot.days.last?.count == 7)
        let first = try #require(snapshot.days.first)
        #expect(first.date == Date(timeIntervalSince1970: 1_790_784_000))
        #expect(snapshot.days.dropFirst().dropLast().allSatisfy { $0.count == 0 })
    }

    @Test func growthChartAccumulatesOnlyWordsSavedWithinThePeriod() {
        let snapshot = SavedWordsSnapshot(activity: [
            ("2026-09-30", 100), ("2026-10-01", 3), ("2026-10-03", 2)
        ], endingOn: "2026-10-30")
        #expect(snapshot.cumulativeDays.prefix(4).map(\.count) == [3, 3, 5, 5])
        #expect(snapshot.cumulativeDays.last?.count == 5)
        #expect(snapshot.total == 5)
    }

    @Test func emptyHistoryRemainsAnHonestFlatZeroAcrossMonthBoundary() {
        let snapshot = SavedWordsSnapshot(activity: [], endingOn: "2026-03-01")
        #expect(snapshot.days.count == 30)
        #expect(snapshot.total == 0)
        #expect(snapshot.days.allSatisfy { $0.count == 0 })
        #expect(SavedWordsSnapshot.calendar.component(.month, from: snapshot.days[0].date) == 1)
        #expect(SavedWordsSnapshot.calendar.component(.day, from: snapshot.days[0].date) == 31)
    }

    @Test func accountSwitchAndSignOutRejectLateSnapshots() throws {
        let suite = "widget-tests.\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        let store = SavedWordsWidgetStore(defaults: defaults)
        let origin = URL(string: "https://leximory.test")!
        let first = store.activate(origin: origin, accountID: "first")
        let snapshot = SavedWordsSnapshot(activity: [("2026-10-30", 12)], endingOn: "2026-10-30")
        #expect(store.publish(snapshot, for: first))
        #expect(SavedWordsWidgetStore(defaults: defaults).snapshot?.total == 12)
        #expect(store.activate(origin: origin, accountID: "first") == first)
        #expect(store.snapshot?.total == 12)
        #expect(store.publish(snapshot, for: first) == false)

        let second = store.activate(origin: origin, accountID: "second")
        #expect(store.snapshot == nil)
        #expect(store.publish(snapshot, for: first) == false)
        #expect(store.publish(snapshot, for: second))
        store.clear()
        #expect(store.snapshot == nil)
        #expect(store.session == nil)
        #expect(store.publish(snapshot, for: second) == false)
        let reopened = store.activate(origin: origin, accountID: "second")
        #expect(reopened != second)
        #expect(store.publish(snapshot, for: second) == false)
    }

    @Test func changingBackendCannotReuseAnotherOriginsWords() throws {
        let suite = "widget-tests.\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        let store = SavedWordsWidgetStore(defaults: defaults)
        let previous = store.activate(origin: URL(string: "https://one.test")!, accountID: "reader")
        let snapshot = SavedWordsSnapshot(activity: [("2026-10-30", 8)], endingOn: "2026-10-30")
        #expect(store.publish(snapshot, for: previous))
        _ = store.activate(origin: URL(string: "https://two.test")!, accountID: "reader")
        #expect(store.snapshot == nil)
        #expect(store.publish(snapshot, for: previous) == false)
    }
}
