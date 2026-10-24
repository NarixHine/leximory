import Foundation
import Testing
import HTTPTypes
import OpenAPIRuntime
@testable import LeximoryCore

struct EbookHighlightTests {
    @Test func oldCachedHighlightsDefaultToSage() throws {
        let data = Data(#"{"id":1,"quote":"river","chapter":null,"location":"3","createdAt":null}"#.utf8)
        let bookmark = try JSONDecoder().decode(EbookBookmark.self, from: data)
        #expect(bookmark.color == .sage)
        #expect(bookmark.quote == "river")
        #expect(bookmark.location == "3")
    }

    @Test(arguments: EbookHighlightColor.allCases)
    func chosenColorSurvivesSavingAndReopeningTheCache(color: EbookHighlightColor) async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let origin = try #require(URL(string: "https://leximory.example"))
        let store = try LocalReadingStore(root: root, origin: origin, accountID: "reader")
        let transport = HighlightTransport(color: color)
        let client = MobileClient(baseURL: origin, transport: transport, token: { _ in "verified" }, localStore: store)
        let saved = try await client.saveEbookBookmark(textID: "book", quote: "river", chapter: nil, location: "3", color: color)
        #expect(saved.id == 42)
        #expect(saved.color == color)
        #expect(saved.location == "3")
        #expect(await transport.sentColor == color.rawValue)
        let reopened = try LocalReadingStore(root: root, origin: origin, accountID: "reader")
        let descriptor = try #require(await reopened.value(EbookDescriptor.self, for: "ebook/book"))
        #expect(descriptor.bookmarks == [saved])
    }

    @Test func recoloringKeepsTheBookmarkAndCacheWhenRefreshFails() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let origin = try #require(URL(string: "https://leximory.example"))
        let store = try LocalReadingStore(root: root, origin: origin, accountID: "reader")
        let transport = HighlightTransport(color: .sage)
        let client = MobileClient(baseURL: origin, transport: transport, token: { _ in "verified" }, localStore: store)
        _ = try await client.ebook(textID: "book")
        await transport.recolorWithoutRefresh()
        let saved = try await client.saveEbookBookmark(textID: "book", quote: "river", chapter: nil,
                                                      location: "3", color: .blue, bookmarkID: 42)
        #expect(saved.id == 42)
        #expect(saved.color == .blue)
        #expect(await transport.sentBookmarkID == 42)
        let reopened = try LocalReadingStore(root: root, origin: origin, accountID: "reader")
        let descriptor = try #require(await reopened.value(EbookDescriptor.self, for: "ebook/book"))
        #expect(descriptor.bookmarks == [saved])
    }

    private actor HighlightTransport: ClientTransport {
        var color: EbookHighlightColor
        var failRefresh = false
        var sentBookmarkID: Int?
        func recolorWithoutRefresh() { color = .blue; failRefresh = true }
        var sentColor: String?
        init(color: EbookHighlightColor) { self.color = color }
        func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
            let bookmark = #"{"id":42,"quote":"river","chapter":null,"location":"3","createdAt":null,"color":"\#(color.rawValue)"}"#
            let payload: String
            switch operationID {
            case "ebookBookmark":
                let data = try await Data(collecting: #require(body), upTo: 8192)
                let json = try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])
                sentColor = json["color"] as? String
                sentBookmarkID = json["bookmarkId"] as? Int
                #expect(json["quote"] as? String == "river")
                #expect(json["location"] as? String == "3")
                #expect(request.headerFields[.authorization] == "Bearer verified")
                payload = bookmark
            case "ebook":
                if failRefresh { throw URLError(.notConnectedToInternet) }
                payload = #"{"text":{"id":"book","libraryId":"library","title":"Book","topics":[],"emoji":null,"createdAt":null,"format":"ebook"},"library":{"id":"library","name":"Books","language":"en","owned":true,"archived":false,"shadow":false},"url":"https://leximory.example/book.pdf","format":"pdf","expiresAt":"2026-10-19T10:00:00Z","location":"3","bookmarks":[\#(bookmark)]}"#
            default: throw URLError(.unsupportedURL)
            }
            return (HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]), HTTPBody(payload))
        }
    }
}
