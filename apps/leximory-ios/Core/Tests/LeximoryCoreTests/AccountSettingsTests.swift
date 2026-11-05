import Foundation
import Testing
import OpenAPIRuntime
import HTTPTypes
@testable import LeximoryCore

@Suite struct AccountSettingsTests {
    @Test func replacingAvatarAtTheSameStorageURLRefreshesItsCacheIdentity() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let origin = URL(string: "https://account.example")!
        let store = try LocalReadingStore(root: root, origin: origin, accountID: "reader")
        let client = MobileClient(baseURL: origin, transport: SettingsTransport(), token: { _ in "verified" }, localStore: store)
        let firstImage = Data([0xff, 0xd8, 1])
        let secondImage = Data([0xff, 0xd8, 2])
        let firstURL = try await client.uploadAccountAvatar(firstImage)
        let secondURL = try await client.uploadAccountAvatar(secondImage)
        #expect(firstURL != secondURL)
        #expect(secondURL.scheme == "https")
        #expect(secondURL.host == "avatars.example")
        #expect(secondURL.path == "/reader")
        let reopened = try LocalReadingStore(root: root, origin: origin, accountID: "reader")
        #expect(await reopened.data(for: "image/\(firstURL.absoluteString)") == firstImage)
        #expect(await reopened.data(for: "image/\(secondURL.absoluteString)") == secondImage)
    }

    @Test func generatedClientPreservesFractionalQuotasAndAccountDetails() async throws {
        let transport = SettingsTransport()
        let client = MobileClient(baseURL: URL(string: "https://account.example")!, transport: transport, token: { _ in "verified" })
        let account = try await client.accountSettings()
        #expect(account.username == "猫忆读者")
        #expect(account.definitions.used == 3.75)
        #expect(account.audio.used == 1.5)
        #expect(account.accent == "BrE")
        #expect(account.subscriptionPlans.map(\.id) == ["beginner", "bilingual", "polyglot"])
        #expect(account.activity.last?.count == 36)
        try await client.setAccountAccent("AmE")
        #expect(await transport.accent == "AmE")
        #expect(try await client.accountToken() == "private-token")
        try await client.revokeAccountToken()
        #expect(try await client.accountBilling().absoluteString == "https://billing.example/portal")
        #expect(try await client.accountCheckout(plan: "bilingual").absoluteString == "https://billing.example/checkout")
    }
    @Test func appleDeliveryUsesTheAuthenticatedGeneratedClientAndReturnsItsAcknowledgement() async throws {
        let client = MobileClient(baseURL: URL(string: "https://account.example")!, transport: SettingsTransport(), token: { _ in "verified" })
        let delivery = try await client.deliverAppleTransaction("signed.apple.transaction")
        #expect(delivery.acknowledgedTransactionId == "123456")
        #expect(delivery.plan == "bilingual")
    }
    private actor SettingsTransport: ClientTransport {
        var accent: String?
        func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
            #expect(request.headerFields[.authorization] == "Bearer verified")
            let payload: Data
            switch operationID {
            case "accountSettings":
                let url = try #require(Bundle.module.url(forResource: "account-settings", withExtension: "json", subdirectory: "Fixtures"))
                payload = try Data(contentsOf: url)
            case "accountAccent":
                struct Input: Decodable { let accent: String }
                let data = try await Data(collecting: #require(body), upTo: 1024)
                accent = try JSONDecoder().decode(Input.self, from: data).accent
                payload = Data(#"{"saved":true}"#.utf8)
            case "accountToken": payload = Data(#"{"token":"private-token"}"#.utf8)
            case "accountRevokeToken": payload = Data(#"{"saved":true}"#.utf8)
            case "accountBilling": payload = Data(#"{"url":"https://billing.example/portal"}"#.utf8)
            case "accountCheckout": payload = Data(#"{"url":"https://billing.example/checkout"}"#.utf8)
            case "appleTransaction":
                struct Input: Decodable { let signedTransaction: String }
                let data = try await Data(collecting: #require(body), upTo: 33000)
                #expect(try JSONDecoder().decode(Input.self, from: data).signedTransaction == "signed.apple.transaction")
                payload = Data(#"{"acknowledgedTransactionId":"123456","plan":"bilingual"}"#.utf8)
            case "accountAvatar": payload = Data(#"{"url":"https://avatars.example/reader"}"#.utf8)
            default: throw URLError(.unsupportedURL)
            }
            return (HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]), HTTPBody(payload))
        }
    }
}
