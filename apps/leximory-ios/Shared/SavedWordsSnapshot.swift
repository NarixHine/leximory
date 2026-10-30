import Foundation

struct SavedWordsSnapshot: Codable, Equatable, Sendable {
    struct Day: Codable, Equatable, Identifiable, Sendable {
        let date: Date
        let count: Int
        var id: Date { date }
    }

    let days: [Day]
    var total: Int { days.reduce(0) { $0 + $1.count } }
    func count(on date: Date) -> Int {
        days.first { Self.calendar.isDate($0.date, inSameDayAs: date) }?.count ?? 0
    }

    func ending(on date: Date) -> Self {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = Self.calendar.timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        return Self(activity: days.map { (formatter.string(from: $0.date), $0.count) },
                    endingOn: formatter.string(from: date))
    }
    var cumulativeDays: [Day] {
        var total = 0
        return days.map { day in
            total += day.count
            return Day(date: day.date, count: total)
        }
    }

    static var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Asia/Shanghai")!
        return calendar
    }

    init(activity: [(date: String, count: Int)], endingOn today: String) {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Self.calendar
        formatter.timeZone = Self.calendar.timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        guard let end = formatter.date(from: today) else { days = []; return }
        let counts = Dictionary(activity.map { ($0.date, max(0, $0.count)) }, uniquingKeysWith: +)
        days = (-29...0).compactMap { offset in
            guard let date = Self.calendar.date(byAdding: .day, value: offset, to: end) else { return nil }
            return Day(date: date, count: counts[formatter.string(from: date)] ?? 0)
        }
    }

    static func sample(endingOn date: Date = .now) -> Self {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = calendar.timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        let counts = [3, 5, 4, 0, 8, 12, 9, 6, 0, 4, 7, 16, 21, 15, 10, 7, 0, 6, 11, 18, 24, 19, 13, 8, 5, 9, 14, 22, 17, 12]
        let activity = counts.enumerated().map { index, count in
            (date: formatter.string(from: calendar.date(byAdding: .day, value: index - 29, to: date)!), count: count)
        }
        return Self(activity: activity, endingOn: formatter.string(from: date))
    }
}

struct SavedWordsWidgetStore {
    static let appGroup = "group.com.leximory.reader"
    static let kind = "LeximorySavedWords"
    private static let key = "saved-words-widget.v1"
    private let defaults: UserDefaults?

    struct Session: Codable, Equatable, Sendable {
        let origin: URL
        let accountID: String
        let id: UUID
    }
    private struct Cache: Codable {
        let session: Session
        var snapshot: SavedWordsSnapshot?
    }

    init(defaults: UserDefaults? = UserDefaults(suiteName: Self.appGroup)) {
        self.defaults = defaults
    }

    var session: Session? { cache?.session }
    var snapshot: SavedWordsSnapshot? { cache?.snapshot }
    private var cache: Cache? {
        defaults?.data(forKey: Self.key).flatMap { try? JSONDecoder().decode(Cache.self, from: $0) }
    }

    @discardableResult func activate(origin: URL, accountID: String) -> Session {
        if let session, session.origin == origin, session.accountID == accountID { return session }
        let session = Session(origin: origin, accountID: accountID, id: UUID())
        write(Cache(session: session, snapshot: nil))
        return session
    }

    @discardableResult func publish(_ snapshot: SavedWordsSnapshot, for session: Session) -> Bool {
        guard var cache, cache.session == session, cache.snapshot != snapshot else { return false }
        cache.snapshot = snapshot
        write(cache)
        return true
    }

    func clear() { defaults?.removeObject(forKey: Self.key) }

    private func write(_ cache: Cache) {
        guard let data = try? JSONEncoder().encode(cache) else { return }
        defaults?.set(data, forKey: Self.key)
    }
}

enum SavedWordsWidgetLink {
    static let home = URL(string: "leximory://home")!

    static func opensHome(_ url: URL) -> Bool {
        url.scheme == "leximory" && (url.host == "home" || url.host == "account")
    }
}
