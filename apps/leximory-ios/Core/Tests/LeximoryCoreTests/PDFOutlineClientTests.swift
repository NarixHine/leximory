import Foundation
import Testing
import OpenAPIRuntime
import HTTPTypes
@testable import LeximoryCore

struct PDFOutlineClientTests {
    @Test func generatedFirstSaveOmitsItsNilBaselineOnTheWire() throws {
        let id = UUID().uuidString
        let payload = Operations.savePDFOutline.Input.Body.jsonPayload(requestId: id, sourceVersion: "source",
            baseRevision: nil, generationId: id, pdfDigest: String(repeating: "a", count: 64))
        let bytes = try JSONEncoder().encode(payload)
        let object = try #require(JSONSerialization.jsonObject(with: bytes) as? [String: Any])
        #expect(object["baseRevision"] == nil)
        #expect(object["generationId"] as? String == id)
        #expect(object["requestId"] as? String == id)
    }

    @Test func generatedClientRetriesWithTheSameIdentityAndPreservesNestedEntries() async throws {
        let transport = OutlineTransport()
        let client = MobileClient(baseURL: URL(string: "https://outline.example")!, transport: transport, token: { _ in "verified" })
        let id = UUID()
        let entries = try await client.generatePDFOutline(textID: "book", sourceVersion: "source", pages: ["One", "Two"], requestID: id)
        #expect(entries == [.init(title: "One", page: 1), .init(title: "Two", page: 2, depth: 1)])
        #expect(await transport.requests == [id.uuidString, id.uuidString])
    }
    @Test func restoredPDFRetainsOutlineAndPrivateStateAcrossCacheAndNotesStoreReopening() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let origin = URL(string: "https://outline.example")!
        let store = try LocalReadingStore(root: root.appending(path: "cache"), origin: origin, accountID: "reader")
        let notes = try PDFNotesStore(root: root.appending(path: "notes"), origin: origin, accountID: "reader")
        let bookmark = EbookBookmark(id: 1, quote: "Preserve bookmark", chapter: "Original", location: "2")
        let text = CatalogText(id: "book", libraryId: "library", title: "Book", topics: [], emoji: nil, createdAt: nil, format: "ebook")
        let descriptor = EbookDescriptor(text: text, library: CatalogLibrary(id: "library", name: "Books", language: "English", owned: true, archived: false, shadow: false), url: URL(string: "https://files.example/original.pdf?v=source")!, format: "pdf", expiresAt: Date().addingTimeInterval(3600), location: "2", bookmarks: [bookmark], sourceVersion: "source")
        await store.save(descriptor, for: "ebook/book")
        let key = PDFNoteKey(document: PDFNoteDocument(textID: "book", pdfVersion: "source"), pageIndex: 0)
        let drawing = PDFPageDrawing(pageIndex: 0, drawing: Data("preserved drawing".utf8), canvasWidth: 400, canvasHeight: 600)
        try await notes.saveLocal(drawing, for: key)
        let client = MobileClient(baseURL: origin, transport: OutlineTransport(), token: { _ in "verified" }, localStore: store, notesStore: notes)
        let bytes = Data("%PDF-already-saved-outline".utf8)
        let id = UUID()
        let result = try await client.savePDFOutline(textID: "book", sourceVersion: "source", baseRevision: "previous", generationID: nil, requestID: id, data: bytes)
        #expect(result.data == bytes)
        await store.updateEbookLocation(textID: "book", location: "1")
        await store.saveEbookBookmark(textID: "book", bookmark: bookmark)
        let reopened = try LocalReadingStore(root: root.appending(path: "cache"), origin: origin, accountID: "reader")
        let reopenedNotes = try PDFNotesStore(root: root.appending(path: "notes"), origin: origin, accountID: "reader")
        let reopenedClient = MobileClient(baseURL: origin, transport: OutlineTransport(), token: { _ in "verified" }, localStore: reopened, notesStore: reopenedNotes)
        let book = try #require(await reopenedClient.cachedEbook(textID: "book"))
        #expect(book.data == bytes)
        #expect(book.descriptor.outlineRevision == id.uuidString)
        #expect(book.descriptor.pdfSourceVersion == "source")
        #expect(book.descriptor.bookmarks == [bookmark])
        #expect(book.location == "1")
        #expect(try await reopenedNotes.record(for: key)?.note == drawing)
        let retained = try #require(try await reopenedNotes.retainedBook(textID: "book"))
        #expect(retained.data == bytes)
        #expect(retained.descriptor.outlineRevision == id.uuidString)
        await reopened.removeEbookBookmark(textID: "book", bookmarkID: 1)
        #expect(await reopened.value(EbookDescriptor.self, for: "ebook/book")?.outlineRevision == id.uuidString)
    }
    private actor OutlineTransport: ClientTransport {
        var requests: [String] = []
        func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
            #expect(request.headerFields[.authorization] == "Bearer verified")
            struct Input: Decodable { let requestId: String }
            let input = try JSONDecoder().decode(Input.self, from: try await Data(collecting: #require(body), upTo: 65536))
            switch operationID {
            case "generatePDFOutline":
                requests.append(input.requestId)
                if requests.count == 1 {
                    return (HTTPResponse(status: .serviceUnavailable), HTTPBody(#"{"error":{"code":"service_unavailable","message":"Recovering","retryable":true}}"#))
                }
                return (HTTPResponse(status: .ok), HTTPBody(#"{"entries":[{"title":"One","page":1,"depth":0},{"title":"Two","page":2,"depth":1}]}"#))
            case "savePDFOutline":
                return (HTTPResponse(status: .ok), HTTPBody("{\"revision\":\"\(input.requestId)\",\"url\":\"https://files.example/outlined.pdf?v=source:outlined\"}"))
            default: throw URLError(.unsupportedURL)
            }
        }
    }
}
