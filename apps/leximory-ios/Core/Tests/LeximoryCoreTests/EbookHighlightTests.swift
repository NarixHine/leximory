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

    @Test func offlineEditsSurviveRelaunchAndReplayOnlyTheLatestColor() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let origin = try #require(URL(string: "https://leximory.example"))
        let store = try LocalReadingStore(root: root, origin: origin, accountID: "reader")
        let transport = HighlightTransport(color: .sage)
        let client = MobileClient(baseURL: origin, transport: transport, token: { _ in "verified" }, localStore: store)
        _ = try await client.ebook(textID: "book")
        await store.setOnline(false)
        await client.editHighlight(textID: "book", bookmark: .init(id: -7, quote: "river", chapter: nil, location: "3", color: .yellow))
        await client.editHighlight(textID: "book", bookmark: .init(id: -7, quote: "river", chapter: nil, location: "3", color: .pink))
        #expect(await transport.sentColor == nil)
        let reopened = try LocalReadingStore(root: root, origin: origin, accountID: "reader")
        let cached = try #require(await reopened.value(EbookDescriptor.self, for: "ebook/book"))
        #expect(cached.bookmarks.last?.color == .pink)
        let resumed = MobileClient(baseURL: origin, transport: transport, token: { _ in "verified" }, localStore: reopened)
        try await resumed.synchronizeHighlights()
        #expect(await transport.sentColor == "pink")
        #expect(await transport.sentBookmarkID == 42)
        let refreshed = try await resumed.ebook(textID: "book")
        #expect(refreshed.bookmarks.count == 1)
        #expect(refreshed.bookmarks.first?.id == -7)
        #expect(refreshed.bookmarks.first?.color == .pink)
        await reopened.setOnline(false)
        await resumed.editHighlight(textID: "book", bookmark: try #require(refreshed.bookmarks.first), removed: true)
        let removed = try #require(await reopened.value(EbookDescriptor.self, for: "ebook/book"))
        #expect(removed.bookmarks.isEmpty)
        #expect(await reopened.overlayHighlights(cached, textID: "book").bookmarks.isEmpty)
    }

    @Test func recoloringDuringAnUploadCommitsTheLatestLocalChoice() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let origin = try #require(URL(string: "https://leximory.example"))
        let store = try LocalReadingStore(root: root, origin: origin, accountID: "reader")
        let transport = HighlightTransport(color: .sage)
        let client = MobileClient(baseURL: origin, transport: transport, token: { _ in "verified" }, localStore: store)
        _ = try await client.ebook(textID: "book")
        await transport.duringNextSave {
            await store.editHighlight(textID: "book", bookmark: .init(id: -9, quote: "river", chapter: nil, location: "3", color: .purple))
        }
        await client.editHighlight(textID: "book", bookmark: .init(id: -9, quote: "river", chapter: nil, location: "3", color: .blue))
        #expect(await transport.sentColors == ["blue", "purple"])
        let cached = try #require(await store.value(EbookDescriptor.self, for: "ebook/book"))
        #expect(cached.bookmarks.last?.id == -9)
        #expect(cached.bookmarks.last?.color == .purple)
    }

    private actor HighlightTransport: ClientTransport {
        var sentColors: [String] = []
        var onSave: (@Sendable () async -> Void)?
        func duringNextSave(_ action: @escaping @Sendable () async -> Void) { onSave = action }
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
                if let sentColor { sentColors.append(sentColor) }
                let action = onSave; onSave = nil
                await action?()
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
