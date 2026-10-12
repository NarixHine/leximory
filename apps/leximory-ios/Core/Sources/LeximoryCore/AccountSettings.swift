import Foundation

public struct AccountSettings: Codable, Sendable {
    public struct Activity: Codable, Identifiable, Sendable {
        public let date: String
        public let count: Int
        public var id: String { date }
    }
    public let userId: String
    public let plan: String
    public let planLabel: String
    public let username: String?
    public let image: String?
    public let email: String?
    public let createdAt: String
    public let balance: Double
    public let dailyAmount: Double
    public let hasClaimed: Bool
    public let accent: String
    public let definitions: Account.Allowance
    public let audio: Account.Allowance
    public let activity: [Activity]
    public struct SubscriptionPlan: Codable, Identifiable, Sendable {
        public let id: String
        public let name: String
        public let price: String
        public let definitions: Double
        public let audio: Double
        public let dailyAmount: Double
    }
    public let subscriptionPlans: [SubscriptionPlan]
    public let today: String
}
