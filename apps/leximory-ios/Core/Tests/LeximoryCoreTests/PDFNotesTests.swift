import Foundation
import Testing
import HTTPTypes
import OpenAPIRuntime
@testable import LeximoryCore

struct PDFNotesTests {
    private let origin = URL(string: "https://notes.example")!
    private let document = PDFNoteDocument(textID: "book", pdfVersion: "original")
    private var key: PDFNoteKey { PDFNoteKey(document: document, pageIndex: 0) }
    private func root() throws -> URL {
        let url = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }
    private func note(_ text: String, page: Int = 0) -> PDFPageDrawing {
        PDFPageDrawing(pageIndex: page, drawing: Data(text.utf8), canvasWidth: 612, canvasHeight: 792)
    }
    @Test func drawingAndUploadStateSurviveReopeningAndRemainAccountScoped() async throws {
        let root = try root(); defer { try? FileManager.default.removeItem(at: root) }
        let store = try PDFNotesStore(root: root, origin: origin, accountID: "first")
        let original = note("editable archive")
        try await store.saveLocal(original, for: key)
        let upload = try #require(await store.prepareUpload(for: key))
        await store.close()
        let reopened = try PDFNotesStore(root: root, origin: origin, accountID: "FIRST")
        #expect(try await reopened.record(for: key)?.note == original)
        #expect(try await reopened.prepareUpload(for: key) == upload)
        let other = try PDFNotesStore(root: root, origin: origin, accountID: "second")
        let staging = try PDFNotesStore(root: root, origin: URL(string: "https://staging.example")!, accountID: "first")
        #expect(try await other.record(for: key) == nil)
        #expect(try await staging.record(for: key) == nil)
        await #expect(throws: CancellationError.self) { try await store.saveLocal(original, for: key) }
    }
    @Test func acknowledgmentCannotClearNewerStrokesAndEmptyDrawingsAreUploaded() async throws {
        let root = try root(); defer { try? FileManager.default.removeItem(at: root) }
        let store = try PDFNotesStore(root: root, origin: origin, accountID: "first")
        let original = note("first stroke")
        try await store.saveLocal(original, for: key)
        let first = try #require(await store.prepareUpload(for: key))
        let erased = note("encoded empty PKDrawing")
        try await store.saveLocal(erased, for: key)
        try await store.acknowledge(first, saved: original)
        #expect(try await store.record(for: key)?.state == .dirty)
        let second = try #require(await store.prepareUpload(for: key))
        #expect(second.note == erased)
        #expect(second.baseRevision == original.revision)
        try await store.acknowledge(first, saved: original)
        #expect(try await store.prepareUpload(for: key) == second)
        try await store.acknowledge(second, saved: erased)
        #expect(try await store.record(for: key)?.state == .clean)
    }
    @Test func staleRefreshCannotReplaceAPageAcknowledgedWhileItWasInFlight() async throws {
        let root = try root(); defer { try? FileManager.default.removeItem(at: root) }
        let store = try PDFNotesStore(root: root, origin: origin, accountID: "first")
        let remote = note("old remote")
        try await store.integrate(remote, document: document, baseline: nil)
        let newer = note("new stroke")
        try await store.saveLocal(newer, for: key)
        let upload = try #require(await store.prepareUpload(for: key))
        try await store.acknowledge(upload, saved: newer)
        try await store.integrate(remote, document: document, baseline: remote.revision)
        #expect(try await store.record(for: key)?.note == newer)
    }
    @Test func retryingAnAlreadySavedLocalDraftDoesNotCreateASelfConflict() async throws {
        let root = try root(); defer { try? FileManager.default.removeItem(at: root) }
        let store = try PDFNotesStore(root: root, origin: origin, accountID: "first")
        let drawing = note("recovered draft")
        try await store.saveLocal(drawing, for: key)
        let upload = try #require(await store.prepareUpload(for: key))
        try await store.acknowledge(upload, saved: drawing)
        try await store.saveLocal(drawing, for: key)
        #expect(try await store.record(for: key)?.state == .clean)
        #expect(try await store.prepareUpload(for: key) == nil)
    }
    @Test func lostResponseRetriesTheFrozenSnapshotBeforeSendingNewerEdits() async throws {
        let root = try root(); defer { try? FileManager.default.removeItem(at: root) }
        let store = try PDFNotesStore(root: root, origin: origin, accountID: "first")
        let remote = NotesRemote(loseFirstResponse: true)
        let first = note("first stroke")
        try await store.saveLocal(first, for: key)
        await #expect(throws: (any Error).self) { try await PDFNotesSync(store: store, remote: remote).synchronize() }
        let newer = note("first and second strokes")
        try await store.saveLocal(newer, for: key)
        await store.close()
        let reopened = try PDFNotesStore(root: root, origin: origin, accountID: "first")
        try await PDFNotesSync(store: reopened, remote: remote).synchronize(document: document)
        let saves = await remote.saves
        #expect(saves.count == 3)
        #expect(saves[0] == saves[1])
        #expect(saves[2].note == newer)
        #expect(saves[2].baseRevision == first.revision)
        #expect(try await reopened.record(for: key)?.state == .clean)
    }
    @Test func conflictsPreserveBothDrawingsAndRequireAnExplicitChoice() async throws {
        let root = try root(); defer { try? FileManager.default.removeItem(at: root) }
        let store = try PDFNotesStore(root: root, origin: origin, accountID: "first")
        let local = note("local erased stroke")
        let other = note("another device")
        let remote = NotesRemote(existing: [key: other])
        try await store.saveLocal(local, for: key)
        let sync = PDFNotesSync(store: store, remote: remote)
        try await sync.synchronize(document: document)
        let conflict = try #require(await store.record(for: key))
        #expect(conflict.note == local)
        #expect(conflict.state == .conflict(other))
        #expect(try await store.prepareUpload(for: key) == nil)
        try await store.resolve(key, keepingLocal: true)
        try await sync.synchronize()
        let saved = try #require(await store.record(for: key))
        #expect(saved.state == .clean)
        #expect(saved.note.drawing == local.drawing)
        #expect(saved.note.revision != local.revision)
        #expect(await remote.saves.last?.baseRevision == other.revision)
    }
    @Test func sourceVersionAndPageKeysPreventMisplacedNotes() async throws {
        let root = try root(); defer { try? FileManager.default.removeItem(at: root) }
        let store = try PDFNotesStore(root: root, origin: origin, accountID: "first")
        try await store.saveLocal(note("page one"), for: key)
        let replacement = PDFNoteKey(document: PDFNoteDocument(textID: "book", pdfVersion: "replacement"), pageIndex: 0)
        #expect(try await store.record(for: replacement) == nil)
        #expect(try await store.record(for: PDFNoteKey(document: document, pageIndex: 1)) == nil)
    }
    @Test func failedWritesRetainTheDrawingInMemoryAndRetryBeforeUpload() async throws {
        let root = try root(); defer { try? FileManager.default.removeItem(at: root) }
        let store = try PDFNotesStore(root: root, origin: origin, accountID: "first")
        let directory = try #require(FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil).first)
        try FileManager.default.removeItem(at: directory)
        try Data().write(to: directory)
        let drawing = note("only copy")
        await #expect(throws: (any Error).self) { try await store.saveLocal(drawing, for: key) }
        #expect(try await store.record(for: key)?.note == drawing)
        await #expect(throws: (any Error).self) { _ = try await store.prepareUpload(for: key) }
        try FileManager.default.removeItem(at: directory)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        #expect(try await store.prepareUpload(for: key)?.note == drawing)
        let reopened = try PDFNotesStore(root: root, origin: origin, accountID: "first")
        #expect(try await reopened.record(for: key)?.note == drawing)
    }
    @Test func oversizedDrawingsRemainLocalInsteadOfRetryingForever() async throws {
        let root = try root(); defer { try? FileManager.default.removeItem(at: root) }
        let store = try PDFNotesStore(root: root, origin: origin, accountID: "first")
        let large = PDFPageDrawing(pageIndex: 0, drawing: Data(repeating: 1, count: 2 * 1024 * 1024 + 1), canvasWidth: 612, canvasHeight: 792)
        try await store.saveLocal(large, for: key)
        #expect(try await store.prepareUpload(for: key) == nil)
        #expect(try await store.record(for: key)?.state == .blocked(.tooLarge))
        let smaller = note("erased unnecessary strokes")
        try await store.saveLocal(smaller, for: key)
        #expect(try await store.prepareUpload(for: key)?.note == smaller)
    }
    @Test func retainedPDFSurvivesCacheCleanupAndAccessRemovalPreservesHandwriting() async throws {
        let root = try root(); defer { try? FileManager.default.removeItem(at: root) }
        let store = try PDFNotesStore(root: root.appending(path: "notes"), origin: origin, accountID: "first")
        let cache = try LocalReadingStore(root: root.appending(path: "cache"), origin: origin, accountID: "first")
        let text = CatalogText(id: "book", libraryId: "folder", title: "Book", topics: [], emoji: nil, createdAt: nil, format: "ebook")
        let library = CatalogLibrary(id: "folder", name: "Books", language: "en", owned: true, archived: false, shadow: false)
        let descriptor = EbookDescriptor(text: text, library: library, url: origin.appending(path: "file.pdf"), format: "pdf",
            expiresAt: .distantFuture, location: "2", bookmarks: [], sourceVersion: document.pdfVersion)
        let data = Data("original PDF source bytes".utf8)
        try await store.retain(LocalEbook(descriptor: descriptor, data: data, location: "2"))
        let handwriting = note("private drawing")
        try await store.saveLocal(handwriting, for: key)
        await cache.close()
        let client = MobileClient(baseURL: origin, token: { _ in Issue.record("Cached PDF attempted authentication"); return "unused" }, localStore: cache, notesStore: store)
        #expect(await client.cachedEbook(textID: "book")?.data == data)
        try await store.reconcileSources(libraryID: "folder", textIDs: [])
        try await store.revokeSources(textID: "book")
        #expect(try await store.retainedBook(textID: "book") == nil)
        #expect(try await store.record(for: key)?.note == handwriting)
    }
    @Test func generatedClientPreservesDrawingBytesAndOmitsTheInitialBaseRevision() async throws {
        let original = note("editable binary \0 archive")
        let transport = NotesTransport(note: original)
        let client = MobileClient(baseURL: origin, transport: transport, token: { _ in "test" })
        let upload = PDFNoteUpload(key: key, note: original, baseRevision: nil)
        #expect(try await client.savePDFNote(upload) == original)
        let page = try await client.pdfNotes(textID: "book", pdfVersion: "source / + ?", after: 3)
        #expect(page.notes == [original])
        let bodies = await transport.bodies
        let body = try #require(bodies.first)
        let json = try #require(JSONSerialization.jsonObject(with: body) as? [String: Any])
        #expect(json["baseRevision"] == nil)
        #expect(json["drawingBase64"] as? String == original.drawing.base64EncodedString())
        #expect(json["pdfVersion"] as? String == document.pdfVersion)
        let path = try #require(await transport.paths.last)
        let url = try #require(URLComponents(string: "https://notes.example" + path))
        #expect(url.queryItems?.first(where: { $0.name == "pdfVersion" })?.value == "source / + ?")
        #expect(url.queryItems?.first(where: { $0.name == "after" })?.value == "3")
    }
}

private actor NotesTransport: ClientTransport {
    let note: PDFPageDrawing
    var bodies: [Data] = []
    var paths: [String] = []
    init(note: PDFPageDrawing) { self.note = note }
    func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws -> (HTTPResponse, HTTPBody?) {
        paths.append(request.path ?? "")
        if let body { bodies.append(try await Data(collecting: body, upTo: 3 * 1024 * 1024)) }
        let data: Data
        if operationID == "savePDFNote" { data = try JSONEncoder().encode(note) }
        else { data = try JSONEncoder().encode(PDFNotePage(notes: [note], nextCursor: note.pageIndex)) }
        return (HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]), HTTPBody(data))
    }
}

private actor NotesRemote: PDFNotesRemote {
    var notes: [PDFNoteKey: PDFPageDrawing]
    var saves: [PDFNoteUpload] = []
    var loseFirstResponse: Bool
    init(existing: [PDFNoteKey: PDFPageDrawing] = [:], loseFirstResponse: Bool = false) { notes = existing; self.loseFirstResponse = loseFirstResponse }
    func pdfNotes(textID: String, pdfVersion: String, after: Int?) async throws -> PDFNotePage {
        let document = PDFNoteDocument(textID: textID, pdfVersion: pdfVersion)
        let next = notes.filter { $0.key.document == document && $0.key.pageIndex > (after ?? -1) }.values.sorted { $0.pageIndex < $1.pageIndex }.first
        return PDFNotePage(notes: next.map { [$0] } ?? [], nextCursor: next?.pageIndex)
    }
    func savePDFNote(_ upload: PDFNoteUpload) async throws -> PDFPageDrawing {
        saves.append(upload)
        if let existing = notes[upload.key], existing.revision == upload.note.revision { return existing }
        guard notes[upload.key]?.revision == upload.baseRevision else {
            throw MobileFailure(error: .init(code: "stale_revision", message: "conflict", retryable: false))
        }
        notes[upload.key] = upload.note
        if loseFirstResponse { loseFirstResponse = false; throw URLError(.networkConnectionLost) }
        return upload.note
    }
}
