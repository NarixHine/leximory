import Foundation
import Testing
import OpenAPIRuntime
import HTTPTypes
@testable import LeximoryCore

struct BrowserClientTests {
    @Test func unsetBrowserChoicesAreOmittedFromTheWirePayload() throws {
        for bookmark in [String?.none, "bookmark"] {
            let payload = Operations.browserSelection.Input.Body.jsonPayload(quote: "quiet", context: "quiet", offset: 0,
                url: "https://news.example", bookmarkId: bookmark, libraryId: nil)
            let encoded = try JSONEncoder().encode(payload)
            let json = try #require(JSONSerialization.jsonObject(with: encoded) as? [String: Any])
            #expect(json["libraryId"] == nil)
            #expect(json["bookmarkId"] as? String == bookmark)
        }
    }
    @Test func bookmarkRetriesKeepIdentityAndDecodeURL() async throws {
        let transport = BrowserTransport()
        let client = MobileClient(baseURL: URL(string: "https://example.com")!, transport: transport, token: { _ in "verified" })
        let bookmark = try await client.createBookmark(libraryID: "library", url: "https://news.example/article", requestID: "stable-request")
        #expect(bookmark.format == "bookmark")
        #expect(bookmark.bookmarkURL == "https://news.example/article")
        #expect(await transport.requests.map(\.requestID) == ["stable-request", "stable-request"])
    }
    @Test func browserSelectionCarriesBothLibraryAndBookmarkChoices() async throws {
        let transport = BrowserTransport()
        let client = MobileClient(baseURL: URL(string: "https://example.com")!, transport: transport, token: { _ in "verified" })
        let target = try await client.browserSelection(url: "https://news.example/article", quote: "bonjour", context: "bonjour", offset: 0,
            bookmarkID: "bookmark", libraryID: "library")
        #expect(target.language == "en")
        #expect(target.libraryId == "library")
        #expect(await transport.requests.first?.bookmarkID == "bookmark")
        #expect(await transport.requests.first?.libraryID == "library")
    }
    @Test func serviceFailureDoesNotDisableTheNextLookup() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let origin = URL(string: "https://example.com")!
        let store = try LocalReadingStore(root: root, origin: origin, accountID: "reader")
        let transport = FailingSelectionTransport()
        let client = MobileClient(baseURL: origin, transport: transport, token: { _ in "verified" }, localStore: store)
        let result = try await client.browserSelection(url: "https://news.example", quote: "quiet", context: "quiet", offset: 0, bookmarkID: nil, libraryID: nil)
        #expect(result.language == "en")
        #expect(await transport.calls == 2)
    }
    private actor FailingSelectionTransport: ClientTransport {
        var calls = 0
        func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
            calls += 1
            #expect(request.headerFields[HTTPField.Name("X-Leximory-Request-ID")!] != nil)
            if calls == 1 {
                return (HTTPResponse(status: .serviceUnavailable, headerFields: [.contentType: "application/json"]), HTTPBody(#"{"error":{"code":"service_unavailable","message":"稍后重试","retryable":true}}"#))
            }
            return (HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]), HTTPBody(#"{"selectionId":"selection","language":"en","libraryId":null,"libraryName":"英语词汇仓库","shadow":true}"#))
        }
    }
    private actor BrowserTransport: ClientTransport {
        struct Request: Sendable { let requestID: String?; let bookmarkID: String?; let libraryID: String? }
        var requests: [Request] = []
        func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
            #expect(request.headerFields[.authorization] == "Bearer verified")
            let data = try await Data(collecting: #require(body), upTo: 65536)
            let json = try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])
            requests.append(Request(requestID: json["requestId"] as? String, bookmarkID: json["bookmarkId"] as? String, libraryID: json["libraryId"] as? String))
            if operationID == "createBookmark" {
                if requests.count == 1 { throw URLError(.networkConnectionLost) }
                return (HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]), HTTPBody(#"{"id":"bookmark","libraryId":"library","title":"News","topics":[],"emoji":"🌐","createdAt":null,"format":"bookmark","bookmarkURL":"https://news.example/article"}"#))
            }
            return (HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]), HTTPBody(#"{"selectionId":"selection","language":"en","libraryId":"library","libraryName":"English News","shadow":false}"#))
        }
    }
}
