import Foundation

public struct AccountDeletionReceipt: Codable, Sendable {
    public enum Status: String, Codable, Sendable { case pending, completed, failed }
    public let requestId: String
    public let status: Status
}
