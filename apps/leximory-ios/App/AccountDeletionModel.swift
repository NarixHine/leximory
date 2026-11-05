import Foundation
import Observation
import Security
import Auth
import LeximoryCore

@MainActor @Observable final class AccountDeletionModel {
    private struct Intent: Codable {
        let requestID: String
        let receiptToken: String
        let userID: String
        var status: AccountDeletionReceipt.Status?
        var queued = false
        var localCleaned = false
    }
    private var intent: Intent?
    private let baseURL: URL
    private let keychain = KeychainLocalStorage(service: "com.leximory.reader.deletion")
    private let key: String
    var presented = false
    private(set) var busy = false
    private(set) var needsAuthentication = false
    private(set) var failure: String?
    var localCleanupFailed = false
    var accepted: Bool { intent?.status != nil }
    var status: AccountDeletionReceipt.Status? { intent?.status }
    var userID: String? { intent?.userID }
    var localCleaned: Bool { intent?.localCleaned == true }

    init(baseURL: URL) {
        self.baseURL = baseURL; key = "deletion.\(baseURL.absoluteString)"
        if let data = try? keychain.retrieve(key: key) { intent = try? JSONDecoder().decode(Intent.self, from: data) }
    }
    private func receiptClient(_ intent: Intent) -> MobileClient {
        MobileClient(baseURL: baseURL, token: { _ in intent.receiptToken })
    }
    private func save(_ value: Intent) throws {
        try keychain.store(key: key, value: JSONEncoder().encode(value))
        intent = value
    }
    private func record(_ receipt: AccountDeletionReceipt, queued: Bool = false) throws {
        guard var intent, intent.requestID == receipt.requestId else { throw URLError(.cannotParseResponse) }
        intent.status = receipt.status
        intent.queued = intent.queued || queued || receipt.status == .completed
        try save(intent)
    }
    func prepare(userID: String) {
        guard let intent, intent.userID != userID else { return }
        // The previous account's worker does not depend on this device receipt.
        self.intent = nil; needsAuthentication = false; failure = nil; localCleanupFailed = false
        try? keychain.remove(key: key)
    }
    func submit(client: MobileClient, userID: String) async {
        guard !busy, !accepted else { return }
        busy = true; failure = nil; needsAuthentication = false
        defer { busy = false }
        do {
            if intent == nil {
                var bytes = [UInt8](repeating: 0, count: 32)
                guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else { throw URLError(.unknown) }
                try save(Intent(requestID: UUID().uuidString, receiptToken: bytes.map { String(format: "%02x", $0) }.joined(), userID: userID))
            }
            guard let intent, intent.userID == userID else { throw URLError(.userAuthenticationRequired) }
            do { try record(try await client.deleteAccount(requestID: intent.requestID, receiptToken: intent.receiptToken, expectedUserID: userID), queued: true) }
            catch {
                if (MobileClient.cause(of: error) as? MobileFailure)?.error.code == "reauthentication_required" {
                    needsAuthentication = true; return
                }
                // The account may already be frozen even if the request response was lost.
                let receipt = try await receiptClient(intent).accountDeletionStatus(requestID: intent.requestID)
                try record(receipt)
                if receipt.status == .pending {
                    try record(try await receiptClient(intent).retryAccountDeletion(requestID: intent.requestID), queued: true)
                }
            }
        } catch {
            if !accepted { failure = "删除未能完成，请重试。" }
        }
    }
    func resume() async {
        guard intent != nil else { return }
        await refresh()
        if status != .completed { presented = true }
    }
    func refresh() async {
        guard let intent, !busy, status != .completed else { return }
        busy = true; failure = nil
        defer { busy = false }
        do {
            let receipt = try await MutationRetry.run { [self] in
                try await receiptClient(intent).accountDeletionStatus(requestID: intent.requestID)
            }
            try record(receipt)
            if !intent.queued && receipt.status == .pending {
                try record(try await receiptClient(intent).retryAccountDeletion(requestID: intent.requestID), queued: true)
            }
        } catch { }
    }
    func retry() async {
        guard let intent, !busy else { return }
        busy = true; failure = nil
        defer { busy = false }
        do { try record(try await receiptClient(intent).retryAccountDeletion(requestID: intent.requestID), queued: true) }
        catch { failure = "删除尚未完成，请稍后重试或联系支持。" }
    }
    func markLocalCleaned() throws {
        guard var intent else { return }
        intent.localCleaned = true
        try save(intent)
        localCleanupFailed = false
    }
}
