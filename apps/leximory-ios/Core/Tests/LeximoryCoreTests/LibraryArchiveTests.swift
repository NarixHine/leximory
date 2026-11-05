import Foundation
import Testing
import HTTPTypes
import OpenAPIRuntime
@testable import LeximoryCore

struct LibraryArchiveTests {
    @Test(arguments: [true, false])
    func transientFailuresRecoverBeforeChangingCachedArchiveState(archived: Bool) async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let origin = try #require(URL(string: "https://archive.test"))
        let store = try LocalReadingStore(root: root, origin: origin, accountID: "reader")
        await store.save([CatalogLibrary(id: "folder", name: "Books", language: "en", owned: true, archived: !archived, shadow: false)], for: "libraries")
        let transport = ArchiveTransport(failures: 2, failure: .unavailable)
        let client = MobileClient(baseURL: origin, transport: transport, token: { _ in "verified" }, localStore: store)

        try await client.setLibraryArchived(libraryID: "folder", archived: archived)

        #expect(await transport.targets == [archived, archived, archived])
        #expect(await store.value([CatalogLibrary].self, for: "libraries")?.first?.archived == archived)
    }

    @Test func losingTheCommittedResponseReplaysTheSameArchiveTarget() async throws {
        let transport = ArchiveTransport(failures: 1, failure: .lostResponse)
        let client = MobileClient(baseURL: try #require(URL(string: "https://archive.test")), transport: transport, token: { _ in "verified" })
        try await client.setLibraryArchived(libraryID: "folder", archived: true)
        #expect(await transport.targets == [true, true])
    }

    @Test(arguments: [Failure.unavailable, .inaccessible, .cancelled])
    func unresolvedFailuresPreserveTheCachedFolder(failure: Failure) async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let origin = try #require(URL(string: "https://archive.test"))
        let store = try LocalReadingStore(root: root, origin: origin, accountID: "reader")
        let library = CatalogLibrary(id: "folder", name: "Books", language: "en", owned: true, archived: false, shadow: false)
        await store.save([library], for: "libraries")
        let transport = ArchiveTransport(failures: 10, failure: failure)
        let client = MobileClient(baseURL: origin, transport: transport, token: { _ in "verified" }, localStore: store)

        await #expect(throws: (any Error).self) { try await client.setLibraryArchived(libraryID: "folder", archived: true) }

        #expect(await transport.targets.count == (failure == .unavailable ? 3 : 1))
        #expect(await store.value([CatalogLibrary].self, for: "libraries") == [library])
    }

    enum Failure: Sendable { case unavailable, lostResponse, inaccessible, cancelled }
    private actor ArchiveTransport: ClientTransport {
        var targets: [Bool] = []
        let failures: Int
        let failure: Failure
        init(failures: Int, failure: Failure) { self.failures = failures; self.failure = failure }
        func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
            #expect(operationID == "libraryArchive")
            #expect(request.method == .post)
            #expect(request.path == "/libraries/folder/archive")
            #expect(request.headerFields[.authorization] == "Bearer verified")
            let data = try await Data(collecting: #require(body), upTo: 1024)
            let payload = try JSONDecoder().decode([String: Bool].self, from: data)
            #expect(payload.keys.sorted() == ["archived"])
            let target = try #require(payload["archived"] as Bool?)
            targets.append(target)
            if targets.count <= failures {
                switch failure {
                case .cancelled: throw CancellationError()
                case .lostResponse: throw URLError(.networkConnectionLost)
                case .unavailable, .inaccessible:
                    let unavailable = failure == .unavailable
                    let code = unavailable ? "service_unavailable" : "inaccessible"
                    return (HTTPResponse(status: unavailable ? .serviceUnavailable : .notFound, headerFields: [.contentType: "application/json"]),
                            HTTPBody("{\"error\":{\"code\":\"\(code)\",\"message\":\"unavailable\",\"retryable\":\(unavailable)}}"))
                }
            }
            return (HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]), HTTPBody("{\"archived\":\(target)}"))
        }
    }
}
