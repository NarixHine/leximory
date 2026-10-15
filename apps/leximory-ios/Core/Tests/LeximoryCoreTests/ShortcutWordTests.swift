import Foundation
import Testing
import HTTPTypes
import OpenAPIRuntime
@testable import LeximoryCore

struct ShortcutWordTests {
    @Test func savesWithOneEndpointAndKeepsRetryIdentity() async throws {
        let transport = ShortcutTransport()
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let origin = URL(string: "https://example.com")!
        let store = try LocalReadingStore(root: root, origin: origin, accountID: "reader")
        let client = MobileClient(baseURL: origin, transport: transport, token: { _ in "verified" }, localStore: store)
        let result = try await client.saveShortcutWord("bonjour")
        #expect(result.language == "fr")
        #expect(result.annotation.definition == "**你好**\n\n礼貌的问候。")
        #expect(result.markdown == "bonjour\n\n**你好**\n\n礼貌的问候。\n\n### 语源\n\n来自 *bon* 与 *jour*。\n\n### 同源词\n\n**jour**：一天。")
        #expect(await transport.operations == ["saveShortcutWord", "saveShortcutWord"])
        let requests = await transport.requestIDs
        #expect(requests.count == 2)
        #expect(requests.first == requests.last)
    }

    @Test(arguments: ["quota", "language", "signedOut"])
    func permanentFailuresDoNotRetry(failure: String) async throws {
        let transport = ShortcutTransport(failure: failure)
        let client = MobileClient(baseURL: URL(string: "https://example.com")!, transport: transport, token: { _ in "verified" })
        await #expect(throws: (any Error).self) { try await client.saveShortcutWord("bonjour") }
        #expect(await transport.operations == ["saveShortcutWord"])
    }

    private actor ShortcutTransport: ClientTransport {
        let failure: String?
        var operations: [String] = []
        var requestIDs: [String] = []
        init(failure: String? = nil) { self.failure = failure }

        func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
            operations.append(operationID)
            #expect(operationID == "saveShortcutWord")
            #expect(request.headerFields[.authorization] == "Bearer verified")
            #expect(baseURL.path == "/api/mobile/v1")
            #expect(request.path == "/shortcuts/words")
            let data = try await Data(collecting: #require(body), upTo: 65536)
            let json = try #require(JSONSerialization.jsonObject(with: data) as? [String: String])
            #expect(json["word"] == "bonjour")
            requestIDs.append(try #require(json["requestId"]))
            if let failure {
                let code = failure == "quota" ? "quota_exceeded" : failure == "language" ? "language_unresolved" : "unauthenticated"
                throw MobileFailure(error: .init(code: code, message: "无法保存", retryable: false))
            }
            if requestIDs.count == 1 { throw URLError(.networkConnectionLost) }
            return (HTTPResponse(status: .ok), HTTPBody(#"{"language":"fr","annotation":{"lemma":"bonjour","definition":"**你好**\n\n礼貌的问候。","etymology":"来自 *bon* 与 *jour*。","cognates":"**jour**：一天。"}}"#))
        }
    }
}
