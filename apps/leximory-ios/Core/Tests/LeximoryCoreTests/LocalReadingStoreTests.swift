import Foundation
import Testing
import HTTPTypes
import OpenAPIRuntime
@testable import LeximoryCore

struct LocalReadingStoreTests {
    private func root() throws -> URL {
        let url = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }
    private let origin = URL(string: "https://leximory.example")!
    @Test func persistedDocumentPreservesRubyAnnotationsAndEveryUTF16Range() async throws {
        let root = try root(); defer { try? FileManager.default.removeItem(at: root) }
        let store = try LocalReadingStore(root: root, origin: origin, accountID: "first")
        let document = try ReadingTests().fixture()
        await store.save(document, for: "document")
        let reopened = try LocalReadingStore(root: root, origin: origin, accountID: "first")
        let restored = try #require(await reopened.value(ReadingDocument.self, for: "document"))
        #expect(restored == document)
        try restored.validate()
    }
    @Test func partitionsIsolateAccountsAndBackendOrigins() async throws {
        let root = try root(); defer { try? FileManager.default.removeItem(at: root) }
        let first = try LocalReadingStore(root: root, origin: origin, accountID: "first")
        await first.save("private", for: "secret")
        let second = try LocalReadingStore(root: root, origin: origin, accountID: "second")
        let staging = try LocalReadingStore(root: root, origin: URL(string: "https://staging.example")!, accountID: "first")
        #expect(await second.value(String.self, for: "secret") == nil)
        #expect(await staging.value(String.self, for: "secret") == nil)
        await first.close()
        await first.save("late response", for: "secret")
        let reopened = try LocalReadingStore(root: root, origin: origin, accountID: "first")
        #expect(await reopened.value(String.self, for: "secret") == nil)
    }
    @Test func corruptionIsDiscardedAndDiskBudgetEvictsOldContent() async throws {
        let root = try root(); defer { try? FileManager.default.removeItem(at: root) }
        let store = try LocalReadingStore(root: root, origin: origin, accountID: "first", budget: 20)
        try await store.saveData(Data(repeating: 1, count: 12), for: "old")
        try await store.saveData(Data(repeating: 2, count: 12), for: "new")
        #expect(await store.data(for: "old") == nil)
        #expect(await store.status().bytes <= 20)
        let directory = try #require(FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil).first)
        let file = try #require(FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil).first { $0.lastPathComponent != "manifest.json" })
        try Data(repeating: 9, count: 12).write(to: file)
        #expect(await store.data(for: "new") == nil)
    }
    @Test func ebookEvictionPreservesOfflineAccountAndCatalog() async throws {
        let root = try root(); defer { try? FileManager.default.removeItem(at: root) }
        let store = try LocalReadingStore(root: root, origin: origin, accountID: "first", budget: 32)
        let metadata = Data(repeating: 3, count: 4)
        try await store.saveData(metadata, for: "account")
        try await store.saveData(metadata, for: "libraries")
        try await store.saveData(metadata, for: "texts/library")
        try await store.saveData(Data(repeating: 1, count: 20), for: "book/old")
        try await store.saveData(Data(repeating: 2, count: 20), for: "book/new")
        #expect(await store.data(for: "book/old") == nil)
        #expect(await store.data(for: "account") == metadata)
        #expect(await store.data(for: "libraries") == metadata)
        #expect(await store.data(for: "texts/library") == metadata)
        #expect(await store.status().bytes <= 32)
    }
    @Test func offlineReadsKeepSnapshotsAndWritesNeverReachAuthOrTransport() async throws {
        let root = try root(); defer { try? FileManager.default.removeItem(at: root) }
        let store = try LocalReadingStore(root: root, origin: origin, accountID: "first")
        await store.save("saved", for: "position/book")
        await store.setOnline(false)
        let transport = CountingTransport()
        let client = MobileClient(baseURL: origin, transport: transport, token: { _ in
            Issue.record("Offline operation attempted authentication")
            return "unused"
        }, localStore: store)
        do { try await client.saveEbookPosition(textID: "book", location: "changed"); Issue.record("Offline write succeeded") }
        catch { #expect(MobileClient.isConnectionFailure(error)) }
        #expect(await transport.calls == 0)
        #expect(await store.value(String.self, for: "position/book") == "saved")
    }
    @Test func successfulFullSnapshotsRemoveDeletedTextsAndRevokedLibraries() async throws {
        let root = try root(); defer { try? FileManager.default.removeItem(at: root) }
        let store = try LocalReadingStore(root: root, origin: origin, accountID: "first")
        let text = CatalogText(id: "gone", libraryId: "library", title: "Gone", topics: [], emoji: nil, createdAt: nil, format: "ebook")
        await store.reconcileTexts([text], libraryID: "library")
        try await store.saveData(Data([1]), for: "book/gone")
        await store.reconcileTexts([], libraryID: "library")
        #expect(await store.data(for: "book/gone") == nil)
        await store.save([SavedWord](), for: "words/library")
        await store.reconcileLibraries([])
        #expect(await store.value([SavedWord].self, for: "words/library") == nil)
    }
    @Test func failedPaginationNeverReplacesTheLastCompleteCatalog() async throws {
        let root = try root(); defer { try? FileManager.default.removeItem(at: root) }
        let store = try LocalReadingStore(root: root, origin: origin, accountID: "first")
        let old = CatalogLibrary(id: "old", name: "Old", language: "ja", owned: true, archived: false, shadow: false)
        await store.reconcileLibraries([old])
        let client = MobileClient(baseURL: origin, transport: PartialCatalogTransport(), token: { _ in "test" }, localStore: store)
        do { _ = try await client.allLibraries(); Issue.record("Partial snapshot succeeded") } catch { }
        #expect(await store.value([CatalogLibrary].self, for: "libraries")?.map(\.id) == ["old"])
    }
    @Test func lateMetadataCannotOverwriteAConfirmedReadingPosition() async throws {
        let root = try root(); defer { try? FileManager.default.removeItem(at: root) }
        let store = try LocalReadingStore(root: root, origin: origin, accountID: "first")
        let version = await store.version(for: "position")
        await store.save("confirmed", for: "position")
        await store.save("stale", for: "position", ifUnchanged: version)
        #expect(await store.value(String.self, for: "position") == "confirmed")
    }
    @Test func accessRevocationPurgesDocumentsInsteadOfFallingBackToThem() async throws {
        let root = try root(); defer { try? FileManager.default.removeItem(at: root) }
        let store = try LocalReadingStore(root: root, origin: origin, accountID: "first")
        let text = CatalogText(id: "gone", libraryId: "library", title: "Gone", topics: [], emoji: nil, createdAt: nil, format: "article")
        let library = CatalogLibrary(id: "library", name: "Private", language: "ja", owned: true, archived: false, shadow: false)
        await store.save(RemoteDocument(text: text, library: library, document: try ReadingTests().fixture(), annotationProgress: nil), for: "document/gone")
        let client = MobileClient(baseURL: origin, transport: RevokedTransport(), token: { _ in "test" }, localStore: store)
        #expect(await client.cachedDocument(textID: "gone") != nil)
        do { _ = try await client.documentDetails(textID: "gone"); Issue.record("Revoked read succeeded") }
        catch { #expect(MobileClient.isAccessFailure(error)) }
        #expect(await client.cachedDocument(textID: "gone") == nil)
    }
    @Test func concurrentReadsShareOneNetworkResponse() async throws {
        let transport = DelayedAccountTransport()
        let client = MobileClient(baseURL: origin, transport: transport, token: { _ in "test" })
        async let first = client.account()
        async let second = client.account()
        let accounts = try await [first, second]
        #expect(accounts.map(\.userId) == ["first", "first"])
        #expect(await transport.calls == 1)
    }
    private struct RevokedTransport: ClientTransport {
        func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
            (HTTPResponse(status: .notFound, headerFields: [.contentType: "application/json"]),
             HTTPBody(#"{"error":{"code":"inaccessible","message":"此内容暂不可用。","retryable":false}}"#))
        }
    }
    private actor DelayedAccountTransport: ClientTransport {
        var calls = 0
        func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
            calls += 1
            try await Task.sleep(for: .milliseconds(100))
            return (HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]),
                    HTTPBody(#"{"userId":"first","plan":"beginner","definitions":{"used":0,"limit":10,"resetsIn":100}}"#))
        }
    }
    private actor CountingTransport: ClientTransport {
        var calls = 0
        func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
            calls += 1
            return (HTTPResponse(status: .ok), nil)
        }
    }
    private actor PartialCatalogTransport: ClientTransport {
        var calls = 0
        func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
            calls += 1
            if calls == 2 { throw URLError(.notConnectedToInternet) }
            return (HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]),
                    HTTPBody(#"{"items":[{"id":"new","name":"New","language":"ja","owned":true,"archived":false,"shadow":false}],"nextCursor":"next"}"#))
        }
    }
}
