import Foundation
import Testing
import OpenAPIRuntime
import HTTPTypes
@testable import LeximoryCore

struct MutationRetryTests {
    @Test(arguments: [false, true], [false, true]) func vocabularyRetriesKeepTheSameIdentity(ebook: Bool, serverFailure: Bool) async throws {
        let transport = SaveTransport(failures: 1, serverFailure: serverFailure)
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let origin = try #require(URL(string: "https://example.com"))
        let store = try LocalReadingStore(root: root, origin: origin, accountID: "reader")
        let client = MobileClient(baseURL: origin, transport: transport, token: { _ in "verified" }, localStore: store)
        if ebook {
            _ = try await client.saveEbookVocabulary(textID: "book", completionID: "receipt")
            _ = try await client.saveEbookVocabulary(textID: "book", completionID: "receipt")
        } else {
            let document = try ReadingTests().fixture()
            let layout = ReaderLayout(document: document)
            let entry = try #require(layout.entries.first(where: { $0.block.displayText.contains("We walked") }))
            let selection = try layout.selection(NSRange(location: entry.documentRange.location, length: 2), document: document, textID: TextID(rawValue: "text"))
            _ = try await client.save(selection: selection, completionID: nil)
            _ = try await client.save(selection: selection, completionID: nil)
        }
        let identities = await transport.identities
        #expect(identities.count == 3)
        #expect(identities[0] == identities[1])
        #expect(identities[1] != identities[2])
    }
    @Test func retriesAreBoundedAndDoNotRetryPermanentFailures() async {
        let transport = SaveTransport(failures: 10)
        let client = MobileClient(baseURL: URL(string: "https://example.com")!, transport: transport, token: { _ in "verified" })
        await #expect(throws: (any Error).self) { try await client.saveEbookVocabulary(textID: "book", completionID: "receipt") }
        #expect(await transport.identities.count == 3)
        #expect(!MutationRetry.isRetryable(MobileFailure(error: .init(code: "unauthenticated", message: "expired", retryable: false))))
        #expect(!MutationRetry.isRetryable(CancellationError()))
    }
    private actor SaveTransport: ClientTransport {
        var identities: [String] = []
        let failures: Int
        let serverFailure: Bool
        init(failures: Int, serverFailure: Bool = false) { self.failures = failures; self.serverFailure = serverFailure }
        func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
            let data = try await Data(collecting: #require(body), upTo: 65536)
            let json = try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])
            identities.append(try #require(json["requestId"] as? String))
            if identities.count <= failures {
                if serverFailure {
                    return (HTTPResponse(status: .serviceUnavailable, headerFields: [.contentType: "application/json"]), HTTPBody(#"{"error":{"code":"service_unavailable","message":"retry","retryable":true}}"#))
                }
                throw URLError(.networkConnectionLost)
            }
            return (HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]), HTTPBody(#"{"id":"word","libraryId":"library"}"#))
        }
    }
}
