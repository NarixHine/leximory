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
    public var image: String?
    public let email: String?
    public let createdAt: String
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
    }
    public let subscriptionPlans: [SubscriptionPlan]
    public struct Membership: Codable, Sendable {
        public enum Provider: String, Codable, Sendable { case appStore, web, complimentary }
        public enum Status: String, Codable, Sendable { case active, gracePeriod, billingRetry, expired, revoked }
        public let provider: Provider
        public let status: Status
        public let expiresAt: String?
        public let autoRenews: Bool?
    }
    public let membership: Membership?
    public let today: String
}
