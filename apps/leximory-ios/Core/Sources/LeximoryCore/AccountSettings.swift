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
        public enum Provider: String, Codable, Sendable { case appStore, legacy }
        public enum Status: String, Codable, Sendable { case active, gracePeriod, billingRetry, expired, revoked }
        public let provider: Provider
        public let plan: String?
        public let status: Status
        public let expiresAt: String?
        public let autoRenews: Bool?
    }
    public struct AppleBilling: Codable, Sendable {
        public struct Product: Codable, Sendable {
            public let plan: String
            public let productId: String
        }
        public let enabled: Bool
        public let purchaseEligible: Bool
        public let products: [Product]
    }
    public let appleBilling: AppleBilling?
    public let memberships: [Membership]?
    public let membership: Membership?
    public let today: String
}
