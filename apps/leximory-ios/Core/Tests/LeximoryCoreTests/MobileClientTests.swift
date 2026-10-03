import Foundation
import Testing
import OpenAPIRuntime
import HTTPTypes
@testable import LeximoryCore

struct MobileClientTests {
    @Test func expiredReadsRefreshOnceThenReportTheRejectedToken() async throws {
        let transport = RejectedTransport()
        let rejected = RejectedTokens()
        let client = MobileClient(baseURL: try #require(URL(string: "https://example.com")), transport: transport, token: { previous in
            previous == nil ? "original" : "refreshed"
        }, unauthorized: { token in await rejected.record(token) })
        do { _ = try await client.account(); Issue.record("Unauthorized read succeeded") }
        catch { #expect((MobileClient.cause(of: error) as? MobileFailure)?.error.code == "unauthenticated") }
        #expect(await transport.count == 2)
        #expect(await rejected.values == ["refreshed"])
    }
    @Test func unauthorizedSaveIsNeverReplayed() async throws {
        let document = try ReadingTests().fixture()
        let layout = ReaderLayout(document: document)
        let entry = try #require(layout.entries.first(where: { $0.block.displayText.contains("We walked") }))
        let selection = try layout.selection(NSRange(location: entry.documentRange.location, length: 2), document: document, textID: TextID(rawValue: "text"))
        let transport = RejectedTransport()
        let rejected = RejectedTokens()
        let client = MobileClient(baseURL: try #require(URL(string: "https://example.com")), transport: transport, token: { _ in "original" }, unauthorized: { token in await rejected.record(token) })
        do { try await client.save(selection: selection, completionID: nil); Issue.record("Unauthorized save succeeded") }
        catch { #expect((MobileClient.cause(of: error) as? MobileFailure)?.error.code == "unauthenticated") }
        #expect(await transport.count == 1)
        #expect(await rejected.values == ["original"])
    }
    private actor RejectedTokens {
        var values: [String] = []
        func record(_ token: String) { values.append(token) }
    }
    private actor RejectedTransport: ClientTransport {
        var count = 0
        func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
            count += 1
            let payload = #"{"error":{"code":"unauthenticated","message":"登录已过期","retryable":false}}"#
            return (HTTPResponse(status: .unauthorized, headerFields: [.contentType: "application/json"]), HTTPBody(payload))
        }
    }
    @Test func articleLinksAcceptCanonicalRoutesAndRejectOtherOrigins() throws {
        let origin = try #require(URL(string: "http://localhost:3001"))
        for link in ["leximory://read/nano_ID-3", "leximory://library/library/nano_ID-3", "http://localhost:3001/read/nano_ID-3", "http://localhost:3001/library/library/nano_ID-3"] {
            #expect(TextLink.textID(from: try #require(URL(string: link)), webURL: origin)?.rawValue == "nano_ID-3")
        }
        for link in ["https://other.example/read/nano_ID-3", "http://localhost:3002/read/nano_ID-3", "leximory://read/invalid%20id", "leximory://read/a/extra", "leximory://account/password"] {
            #expect(TextLink.textID(from: try #require(URL(string: link)), webURL: origin) == nil)
        }
    }
    private func streamBytes() throws -> Data {
        let path = try #require(Bundle.module.url(forResource: "definition-stream", withExtension: "ndjson", subdirectory: "Fixtures"))
        return try Data(contentsOf: path)
    }
    @Test func actualHandlerFramesDecodeAcrossEveryByteBoundary() throws {
        let bytes = try streamBytes()
        for split in 0...bytes.count {
            var decoder = DefinitionFrames()
            let events = try decoder.append(Data(bytes.prefix(split))) + decoder.append(Data(bytes.dropFirst(split)))
            try decoder.finish()
            #expect(events.count == 4)
            guard case .completed(_, let definition) = events.last else { Issue.record("Missing completion"); return }
            #expect(definition.definition == "河岸 🙂")
            #expect(definition.etymology == nil)
        }
    }
    @Test func truncatedOrReorderedFramesNeverComplete() throws {
        let bytes = try streamBytes()
        var decoder = DefinitionFrames()
        _ = try decoder.append(Data(bytes.prefix(bytes.count / 2)))
        #expect(throws: (any Error).self) { try decoder.finish() }
        var invalid = DefinitionFrames()
        #expect(throws: (any Error).self) { _ = try invalid.append(Data("{\"kind\":\"delta\",\"requestId\":\"wrong\",\"text\":\"word\"}\n".utf8)) }
    }
    @Test func generatedStreamOperationConsumesTheActualHandlerContract() async throws {
        let document = try ReadingTests().fixture()
        let layout = ReaderLayout(document: document)
        let entry = try #require(layout.entries.first(where: { $0.block.displayText.contains("We walked") }))
        let selection = try layout.selection(NSRange(location: entry.documentRange.location, length: 2), document: document, textID: TextID(rawValue: "text"))
        let transport = StreamTransport(bytes: try streamBytes())
        let client = MobileClient(baseURL: try #require(URL(string: "https://example.com")), transport: transport, token: { _ in "verified" })
        var events: [DefinitionEvent] = []
        for try await event in client.definitions(selection: selection) { events.append(event) }
        #expect(events.count == 4)
    }
    @Test func nullableCursorAndMetadataDecodeThroughGeneratedClient() async throws {
        let client = MobileClient(baseURL: try #require(URL(string: "https://example.com")), transport: CatalogTransport(), token: { _ in "verified" })
        let result = try await client.texts(libraryID: "library")
        #expect(result.nextCursor == nil)
        #expect(result.items.first?.emoji == nil)
        #expect(result.items.first?.createdAt == nil)
    }
    @Test func realBookMetadataAndFractionalExpiryDecodeThroughGeneratedClient() async throws {
        let client = MobileClient(baseURL: try #require(URL(string: "https://example.com")), transport: EbookTransport(), token: { _ in "verified" })
        let result = try await client.ebook(textID: "book")
        #expect(result.format == "epub")
        #expect(result.location == nil)
        #expect(result.bookmarks.first?.id == 1)
        #expect(result.expiresAt.timeIntervalSince1970 > 0)
    }
    private struct EbookTransport: ClientTransport {
        func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
            let payload = #"{"text":{"id":"book","libraryId":"library","title":"Book","topics":[],"emoji":null,"createdAt":null,"format":"ebook"},"library":{"id":"library","name":"文库","language":"en","owned":true,"archived":false,"shadow":false},"url":"https://example.com/book.epub","format":"epub","expiresAt":"2026-10-03T10:43:13.505Z","location":null,"bookmarks":[{"id":1,"quote":"bank","chapter":null,"location":null,"createdAt":null}]}"#
            return (HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]), HTTPBody(payload))
        }
    }
    private struct StreamTransport: ClientTransport {
        let bytes: Data
        func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
            #expect(request.headerFields[.authorization] == "Bearer verified")
            #expect(request.method == .post)
            #expect(operationID == "definitions")
            let requestBody = try #require(body)
            let data = try await Data(collecting: requestBody, upTo: 8192)
            let json = try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])
            #expect(json["textId"] == nil)
            #expect(json["revision"] != nil)
            let chunks = AsyncThrowingStream<ArraySlice<UInt8>, Error> { continuation in
                for byte in bytes { continuation.yield([byte][...]) }
                continuation.finish()
            }
            return (HTTPResponse(status: .ok, headerFields: [.contentType: "application/x-ndjson"]), HTTPBody(chunks, length: .unknown, iterationBehavior: .single))
        }
    }
    private struct CatalogTransport: ClientTransport {
        func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
            let payload = #"{"items":[{"id":"text","libraryId":"library","title":"Title","topics":[],"emoji":null,"createdAt":null,"format":"article"}],"nextCursor":null}"#
            return (HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]), HTTPBody(payload))
        }
    }
}
