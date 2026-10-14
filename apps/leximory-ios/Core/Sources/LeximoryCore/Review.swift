import Foundation

public struct ReviewHTTPError: Error, Sendable { public let status: Int }

public enum ReviewStatus: String, Codable, Sendable { case idle, pending, complete, failed }
public struct ReviewCorrection: Codable, Hashable, Sendable {
    public let original: String
    public let improved: String
}
public struct ReviewPraise: Codable, Hashable, Sendable {
    public let original: String
    public let note: String
}
public struct ReviewFeedback: Codable, Sendable {
    public let rationale: String?
    public let badPairs: [ReviewCorrection]
    public let goodPairs: [ReviewPraise]?
}
public struct ReviewTranslation: Codable, Sendable {
    public let prompt: String
    public let answer: String
    public let keyword: String
    public let submission: String?
    public let status: ReviewStatus?
    public let feedback: ReviewFeedback?
}
public struct ReviewConversation: Codable, Sendable {
    public let prompt: String
    public let keywords: [String]
    public let submission: String?
    public let status: ReviewStatus?
    public let feedback: ReviewFeedback?
    public let reply: String?
}
public struct ReviewSnapshot: Codable, Sendable {
    public let exists: Bool
    public let inProgress: Bool
    public let story: String?
    public let storyDocument: ReadingDocument?
    public let translations: [ReviewTranslation]?
    public let conversation: ReviewConversation?
    public var completedTranslations: Int { (translations ?? []).filter { $0.status == .complete }.count }
    public var requiredTranslations: Int { Int(ceil(Double(translations?.count ?? 0) * 0.6)) }
    public var conversationUnlocked: Bool { !(translations ?? []).isEmpty && completedTranslations >= requiredTranslations }
    public var percentage: Int {
        if conversation?.status == .complete { return 100 }
        let total = translations?.count ?? 0
        let translationPercent = total == 0 ? 0 : Int(floor(Double(completedTranslations) / Double(total) * 100))
        return max(story?.isEmpty == false ? 1 : 0, Int(floor(Double(translationPercent) * 0.6)))
    }
    public var needsRefresh: Bool { inProgress || (translations ?? []).contains { $0.status == .pending } || conversation?.status == .pending }
}
public struct ReviewDay: Codable, Identifiable, Sendable {
    public struct Word: Codable, Identifiable, Sendable {
        public let id: String
        public var word: String
        public var fields: VocabularyFields?
        public let lang: String
        public let lib: String
    }
    public struct Progress: Codable, Sendable {
        public let percentage: Int
        public let conversationCompleted: Bool
        public init(percentage: Int, conversationCompleted: Bool) {
            self.percentage = percentage; self.conversationCompleted = conversationCompleted
        }
    }
    public let date: String
    public let displayDate: String
    public let dayOfWeek: String
    public var words: [Word]
    public var count: Int { words.count }
    public var progressByLang: [String: Progress]
    public let isToday: Bool
    public var id: String { date }
}
public struct ReviewStreak: Codable, Sendable {
    public struct Day: Codable, Identifiable, Sendable {
        public let date: String
        public let displayDate: String
        public let dayOfWeek: String
        public let completed: Bool
        public var id: String { date }
    }
    public let total: Int
    public let checkDays: [Day]
    public let threshold: Int
}
public struct ReviewTimeline: Codable, Sendable {
    public let days: [ReviewDay]
    public let nextCursor: String?
    public let streak: ReviewStreak
    public init(days: [ReviewDay], nextCursor: String?, streak: ReviewStreak) {
        self.days = days; self.nextCursor = nextCursor; self.streak = streak
    }
}
public struct ReviewSelection: Hashable, Identifiable, Sendable {
    public let date: String
    public let language: String
    public init(date: String, language: String) { self.date = date; self.language = language }
    public var id: String { "\(date):\(language)" }
}
struct ReviewSubmission: Encodable {
    let date: String
    let lang: String
    var index: Int? = nil
    var submission: String? = nil
}
