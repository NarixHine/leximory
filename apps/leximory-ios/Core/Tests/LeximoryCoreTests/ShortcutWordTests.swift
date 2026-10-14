import Foundation
import Testing
import HTTPTypes
import OpenAPIRuntime
@testable import LeximoryCore

struct ShortcutWordTests {
    @Test func savesOnlyTheCompletedDefinitionAndKeepsRetryIdentity() async throws {
        let transport = ShortcutTransport()
        let client = MobileClient(baseURL: URL(string: "https://example.com")!, transport: transport, token: { _ in "verified" })
        let target = try await client.saveShortcutWord("bonjour")
        #expect(target.language == "fr")
        #expect(target.libraryName == "法语词汇仓库")
        #expect(target.shadow)
        #expect(await transport.operations == ["shortcutSelection", "browserDefinitions", "browserVocabulary", "browserVocabulary"])
        let requests = await transport.saveRequestIDs
        #expect(requests.count == 2)
        #expect(requests.first == requests.last)
    }

    @Test(arguments: ["quota", "incomplete", "language", "signedOut"])
    func failedLookupsNeverSave(failure: String) async throws {
        let transport = ShortcutTransport(failure: failure)
        let client = MobileClient(baseURL: URL(string: "https://example.com")!, transport: transport, token: { _ in "verified" })
        await #expect(throws: (any Error).self) { try await client.saveShortcutWord("bonjour") }
        #expect(await transport.saveRequestIDs.isEmpty)
    }

    private actor ShortcutTransport: ClientTransport {
        let failure: String?
        var operations: [String] = []
        var saveRequestIDs: [String] = []
        init(failure: String? = nil) { self.failure = failure }

        func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
            operations.append(operationID)
            #expect(request.headerFields[.authorization] == "Bearer verified")
            let data = try await Data(collecting: #require(body), upTo: 65536)
            let json = try #require(JSONSerialization.jsonObject(with: data) as? [String: String])
            switch operationID {
            case "shortcutSelection":
                #expect(baseURL.path == "/api/mobile/v1")
                #expect(request.path == "/shortcuts/selection")
                #expect(json == ["word": "bonjour"])
                if failure == "language" { throw MobileFailure(error: .init(code: "language_unresolved", message: "无法判断语言", retryable: false)) }
                if failure == "signedOut" { throw MobileFailure(error: .init(code: "unauthenticated", message: "请登录", retryable: false)) }
                return response(#"{"selectionId":"selection","language":"fr","libraryId":null,"libraryName":"法语词汇仓库","shadow":true}"#)
            case "browserDefinitions":
                #expect(json == ["selectionId": "selection"])
                if failure == "quota" { throw MobileFailure(error: .init(code: "quota_exceeded", message: "额度不足", retryable: false)) }
                let started = #"{"kind":"started","requestId":"completion"}"# + "\n"
                if failure == "incomplete" { return response(started) }
                return response(started + #"{"kind":"completed","requestId":"completion","definition":{"lemma":"bonjour","definition":"你好","etymology":null,"cognates":null}}"# + "\n")
            case "browserVocabulary":
                #expect(json["completionId"] == "completion")
                saveRequestIDs.append(try #require(json["requestId"]))
                if saveRequestIDs.count == 1 { throw URLError(.networkConnectionLost) }
                return response(#"{"id":"saved-word","libraryId":"french-shadow"}"#)
            default:
                Issue.record("Unexpected request: \(operationID)")
                throw URLError(.badURL)
            }
        }

        private func response(_ json: String) -> (HTTPResponse, HTTPBody?) {
            (HTTPResponse(status: .ok), HTTPBody(json))
        }
    }
}
