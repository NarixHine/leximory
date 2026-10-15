import Foundation
import Testing
import HTTPTypes
import OpenAPIRuntime
@testable import LeximoryCore

struct ManagementTests {
    @Test func generatedManagementClientSavesSourceAndPurgesRemovedContent() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let origin = try #require(URL(string: "https://example.com"))
        let store = try LocalReadingStore(root: root, origin: origin, accountID: "reader")
        let transport = ManagementTransport()
        let client = MobileClient(baseURL: origin, transport: transport, token: { _ in "test" }, localStore: store)
        let original = try await client.editableText(id: "article")
        #expect(original.content == "A {{bank||bank||河岸}}.")
        var draft = TextEdit(original); draft.title = "River banks"
        let edited = try await client.editText(id: "article", revision: original.revision, fields: draft)
        #expect(edited.title == "River banks")
        let cached = try #require(await store.value([CatalogText].self, for: "texts/folder"))
        #expect(cached.first?.title == "River banks")
        try await store.saveData(Data("old book".utf8), for: "book/article")
        let book = try await client.replaceEbook(id: "article", filename: "new.pdf", data: Data("%PDF-1.7".utf8))
        #expect(book.format == "ebook")
        #expect(await store.data(for: "book/article") == nil)
        let detached = try await client.removeEbook(id: "article")
        #expect(detached.format == "article")
        await store.save("cached", for: "document/article")
        try await client.removeText(detached)
        #expect(await store.data(for: "document/article") == nil)
        #expect(await store.value([CatalogText].self, for: "texts/folder")?.isEmpty == true)
        #expect(await transport.paths == ["/texts/article/edit", "/texts/article/edit", "/texts/article/ebook-replace?filename=new.pdf", "/texts/article/ebook-remove", "/texts/article/remove"])
    }
    @Test func removingWordUpdatesCachedTimelineCountsAndLanguageProgress() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let origin = try #require(URL(string: "https://example.com"))
        let store = try LocalReadingStore(root: root, origin: origin, accountID: "reader")
        let word = SavedWord(id: "word", libraryId: "folder", fields: VocabularyFields(original: "bank", definition: Definition(lemma: "bank", definition: "河岸")))
        await store.save([word], for: "words/folder")
        let timeline = try JSONDecoder().decode(ReviewTimeline.self, from: Data(#"{"days":[{"date":"2026-10-14","displayDate":"10/14","dayOfWeek":"周三","isToday":false,"words":[{"id":"word","word":"bank","lang":"en","lib":"folder"},{"id":"other","word":"河岸","lang":"zh","lib":"chinese"}],"progressByLang":{"en":{"percentage":60,"conversationCompleted":false},"zh":{"percentage":40,"conversationCompleted":false}}}],"nextCursor":"next"}"#.utf8))
        await store.save(timeline, for: "review-timeline")
        let client = MobileClient(baseURL: origin, transport: ManagementTransport(), token: { _ in "test" }, localStore: store)
        try await client.removeWord(word)
        let updated = try #require(await store.value(ReviewTimeline.self, for: "review-timeline"))
        #expect(updated.days.first?.count == 1)
        #expect(updated.days.first?.words.first?.id == "other")
        #expect(updated.days.first?.progressByLang["en"] == nil)
        #expect(updated.days.first?.progressByLang["zh"]?.percentage == 40)
        #expect(updated.nextCursor == "next")
        #expect(await store.value([SavedWord].self, for: "words/folder")?.isEmpty == true)
        #expect(updated.days.removingWord("other").isEmpty)
    }
    @Test func removedDestinationsCannotReturnThroughHistoryAndReplacementUpdatesEveryCopy() {
        var history = ResourceHistory(home: "home")
        history.visit("article"); history.visit("folders"); history.visit("article"); history.visit("ebook")
        let back = history.go(-1); #expect(back)
        history.removeAll { $0 == "article" }
        #expect(history.entries == ["home", "folders", "ebook"])
        #expect(history.current == "folders")
        let forward = history.go(1); #expect(forward); #expect(history.current == "ebook")
        history.transform { $0 == "ebook" ? "new book" : $0 }
        #expect(history.current == "new book")
        #expect(history.entries == ["home", "folders", "new book"])
    }
    @Test func lateBookDownloadCannotRestoreAnInvalidatedFile() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let store = try LocalReadingStore(root: root, origin: #require(URL(string: "https://example.com")), accountID: "reader")
        let version = await store.version(for: "book/ebook")
        await store.removeText("ebook")
        await #expect(throws: CancellationError.self) {
            try await store.saveBook(Data("old book".utf8), source: "old.pdf", textID: "ebook", ifUnchanged: version)
        }
        #expect(await store.data(for: "book/ebook") == nil)
        #expect(await store.data(for: "book-source/ebook") == nil)
    }
    @Test func bookCacheUsesFileVersionButIgnoresRotatingAccessTokens() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let origin = try #require(URL(string: "https://example.com"))
        let store = try LocalReadingStore(root: root, origin: origin, accountID: "reader")
        let text = CatalogText(id: "book", libraryId: "folder", title: "Book", topics: [], emoji: nil, createdAt: nil, format: "ebook")
        let library = CatalogLibrary(id: "folder", name: "Books", language: "en", owned: true, archived: false, shadow: false)
        try await store.saveBook(Data("old".utf8), source: "https://example.com/book.pdf?v=1", textID: "book", ifUnchanged: 0)
        let client = MobileClient(baseURL: origin, transport: ManagementTransport(), token: { _ in "test" }, localStore: store)
        let same = try #require(URL(string: "https://example.com/book.pdf?token=renewed&v=1"))
        await store.save(EbookDescriptor(text: text, library: library, url: same, format: "pdf", expiresAt: .distantFuture, location: nil, bookmarks: []), for: "ebook/book")
        #expect(await client.cachedEbook(textID: "book")?.data == Data("old".utf8))
        let replacement = try #require(URL(string: "https://example.com/book.pdf?token=renewed&v=2"))
        await store.save(EbookDescriptor(text: text, library: library, url: replacement, format: "pdf", expiresAt: .distantFuture, location: nil, bookmarks: []), for: "ebook/book")
        #expect(await client.cachedEbook(textID: "book") == nil)
    }
    @Test func metadataEditsKeepEbookBytesPositionAndBookmarks() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let origin = try #require(URL(string: "https://example.com"))
        let store = try LocalReadingStore(root: root, origin: origin, accountID: "reader")
        let old = CatalogText(id: "book", libraryId: "folder", title: "Old", topics: [], emoji: nil, createdAt: nil, format: "ebook")
        let updated = CatalogText(id: "book", libraryId: "folder", title: "New", topics: ["Reading"], emoji: "📖", createdAt: nil, format: "ebook")
        let library = CatalogLibrary(id: "folder", name: "Books", language: "en", owned: true, archived: false, shadow: false)
        let bookmark = EbookBookmark(id: 1, quote: "A sentence", chapter: "Chapter", location: "old-cfi")
        await store.save(EbookDescriptor(text: old, library: library, url: origin.appending(path: "book.epub"), format: "epub", expiresAt: .distantFuture, location: "current-cfi", bookmarks: [bookmark]), for: "ebook/book")
        try await store.saveData(Data("book bytes".utf8), for: "book/book")
        await store.applyTextEdit(updated, content: "")
        let descriptor = try #require(await store.value(EbookDescriptor.self, for: "ebook/book"))
        #expect(descriptor.text.title == "New")
        #expect(descriptor.location == "current-cfi")
        #expect(descriptor.bookmarks.first?.location == "old-cfi")
        #expect(await store.data(for: "book/book") == Data("book bytes".utf8))
    }
    private actor ManagementTransport: ClientTransport {
        var paths: [String] = []
        func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
            paths.append(request.path ?? "")
            let text = #"{"id":"article","libraryId":"folder","title":"River banks","topics":[],"emoji":null,"createdAt":null,"format":"article"}"#
            let response: String
            switch operationID {
            case "editableText": response = "{\"text\":\(text),\"content\":\"A {{bank||bank||河岸}}.\",\"revision\":\"revision\",\"contentEditable\":true}"
            case "editText":
                let bytes = try await Data(collecting: #require(body), upTo: 100000)
                let json = try #require(JSONSerialization.jsonObject(with: bytes) as? [String: Any])
                #expect(json["content"] as? String == "A {{bank||bank||河岸}}.")
                #expect(json["revision"] as? String == "revision")
                response = text
            case "replaceEbook":
                #expect(try await Data(collecting: #require(body), upTo: 100) == Data("%PDF-1.7".utf8))
                response = text.replacingOccurrences(of: "\"format\":\"article\"", with: "\"format\":\"ebook\"")
            case "removeEbook": response = text
            case "removeText", "removeWord":
                let bytes = try await Data(collecting: #require(body), upTo: 1000)
                let json = try #require(JSONSerialization.jsonObject(with: bytes) as? [String: Any])
                #expect(json["libraryId"] as? String == "folder")
                response = #"{"removed":true}"#
            default: throw URLError(.unsupportedURL)
            }
            return (HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]), HTTPBody(response))
        }
    }
}
