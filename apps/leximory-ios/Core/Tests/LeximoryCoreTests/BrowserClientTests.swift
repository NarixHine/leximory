import Foundation
import Testing
import OpenAPIRuntime
import HTTPTypes
@testable import LeximoryCore

struct BrowserClientTests {
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
