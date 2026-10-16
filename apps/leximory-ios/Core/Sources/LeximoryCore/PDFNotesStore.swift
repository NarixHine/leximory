import Foundation
import CryptoKit

public actor PDFNotesStore {
    private struct Source: Codable {
        let descriptor: EbookDescriptor
        let digest: String
    }
    private let directory: URL
    private let sources: URL
    private var closed = false
    private var unsaved: [PDFNoteKey: PDFNoteRecord] = [:]
    private var knownKeys: Set<PDFNoteKey>?
    private var listeners: [UUID: AsyncStream<PDFNoteKey>.Continuation] = [:]

    public static func applicationRoot() throws -> URL {
        try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
            .appending(path: "Leximory/PDFNotes", directoryHint: .isDirectory)
    }
    public init(root: URL, origin: URL, accountID: String) throws {
        directory = root.appending(path: Self.digest(Data((origin.absoluteString + "\n" + accountID.lowercased()).utf8)), directoryHint: .isDirectory)
        sources = directory.appending(path: "Sources", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: sources, withIntermediateDirectories: true)
        var sourceDirectory = sources
        var values = URLResourceValues(); values.isExcludedFromBackup = true
        try sourceDirectory.setResourceValues(values)
        #if os(iOS)
        try FileManager.default.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: directory.path)
        try FileManager.default.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: sources.path)
        #endif
    }
    private static func digest(_ data: Data) -> String { SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() }
    private func stem<T: Encodable>(_ key: T) throws -> String {
        let encoder = JSONEncoder(); encoder.outputFormatting = .sortedKeys
        return Self.digest(try encoder.encode(key))
    }
    private func requireOpen() throws { if closed { throw CancellationError() } }
    public func record(for key: PDFNoteKey) throws -> PDFNoteRecord? {
        try requireOpen()
        if let record = unsaved[key] { return record }
        let url = directory.appending(path: try stem(key) + ".note")
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        let record = try JSONDecoder().decode(PDFNoteRecord.self, from: Data(contentsOf: url))
        guard record.key == key, record.note.pageIndex == key.pageIndex, record.note.isSupported else { throw CocoaError(.fileReadCorruptFile) }
        return record
    }
    private func commit(_ record: PDFNoteRecord) throws {
        try requireOpen()
        do {
            try JSONEncoder().encode(record).write(to: directory.appending(path: try stem(record.key) + ".note"), options: .atomic)
            unsaved[record.key] = nil
        } catch { unsaved[record.key] = record; throw error }
        knownKeys?.insert(record.key)
        for listener in listeners.values { listener.yield(record.key) }
    }
    public func keys() throws -> [PDFNoteKey] {
        try requireOpen()
        if let knownKeys { return Array(knownKeys.union(unsaved.keys)) }
        let saved = try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
            .filter { $0.pathExtension == "note" }.map {
                try JSONDecoder().decode(PDFNoteRecord.self, from: Data(contentsOf: $0)).key
            }
        knownKeys = Set(saved)
        return Array(Set(saved).union(unsaved.keys))
    }
    public func updates() -> AsyncStream<PDFNoteKey> {
        let id = UUID()
        return AsyncStream { continuation in
            if closed { continuation.finish(); return }
            listeners[id] = continuation
            continuation.onTermination = { [weak self] _ in Task { await self?.removeListener(id) } }
        }
    }
    private func removeListener(_ id: UUID) { listeners[id] = nil }
    public func saveLocal(_ note: PDFPageDrawing, for key: PDFNoteKey) throws {
        guard note.isSupported, note.pageIndex == key.pageIndex else { throw PDFNotesError.invalidDrawing }
        let previous = try record(for: key)
        if let previous, previous.note == note {
            if unsaved[key] != nil { try commit(previous) }
            return
        }
        var record = previous ?? PDFNoteRecord(key: key, note: note, remoteRevision: nil, state: .dirty)
        record.note = note
        switch record.state {
        case .uploading, .conflict: break
        case .clean, .dirty, .blocked: record.state = .dirty
        }
        try commit(record)
    }
    public func prepareUpload(for key: PDFNoteKey) throws -> PDFNoteUpload? {
        if let record = unsaved[key] { try commit(record) }
        guard var record = try record(for: key) else { return nil }
        switch record.state {
        case .uploading(let upload): return upload
        case .dirty:
            if record.note.drawing.count > 2 * 1024 * 1024 {
                record.state = .blocked(.tooLarge); try commit(record); return nil
            }
            let upload = PDFNoteUpload(key: key, note: record.note, baseRevision: record.remoteRevision)
            record.state = .uploading(upload); try commit(record)
            return upload
        case .clean, .conflict, .blocked: return nil
        }
    }
    public func acknowledge(_ upload: PDFNoteUpload, saved: PDFPageDrawing) throws {
        guard saved == upload.note else { throw URLError(.badServerResponse) }
        guard var record = try record(for: upload.key), case .uploading(let current) = record.state, current == upload else { return }
        record.remoteRevision = saved.revision
        record.state = record.note.revision == saved.revision ? .clean : .dirty
        try commit(record)
    }
    public func conflict(_ upload: PDFNoteUpload, remote: PDFPageDrawing) throws {
        guard remote.isSupported, remote.pageIndex == upload.key.pageIndex else { throw URLError(.badServerResponse) }
        guard var record = try record(for: upload.key), case .uploading(let current) = record.state, current == upload else { return }
        record.remoteRevision = remote.revision; record.state = .conflict(remote)
        try commit(record)
    }
    public func block(_ upload: PDFNoteUpload, problem: PDFNoteProblem) throws {
        guard var record = try record(for: upload.key), case .uploading(let current) = record.state, current == upload else { return }
        record.state = .blocked(problem); try commit(record)
    }
    public func integrate(_ remote: PDFPageDrawing, document: PDFNoteDocument, baseline: UUID?) throws {
        guard remote.isSupported else { throw URLError(.badServerResponse) }
        let key = PDFNoteKey(document: document, pageIndex: remote.pageIndex)
        if let existing = try record(for: key) {
            guard existing.state == .clean, existing.note.revision == baseline else { return }
            if existing.note == remote { return }
        } else if baseline != nil { return }
        try commit(PDFNoteRecord(key: key, note: remote, remoteRevision: remote.revision, state: .clean))
    }
    public func resolve(_ key: PDFNoteKey, keepingLocal: Bool) throws {
        guard var record = try record(for: key), case .conflict(let remote) = record.state else { return }
        let history = directory.appending(path: "History", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: history, withIntermediateDirectories: true)
        try JSONEncoder().encode(record).write(to: history.appending(path: UUID().uuidString + ".json"), options: .atomic)
        record.remoteRevision = remote.revision
        if keepingLocal {
            record.note = PDFPageDrawing(pageIndex: key.pageIndex, drawing: record.note.drawing,
                canvasWidth: record.note.canvasWidth, canvasHeight: record.note.canvasHeight)
            record.state = .dirty
        } else { record.note = remote; record.state = .clean }
        try commit(record)
    }
    public func retry(_ key: PDFNoteKey) throws {
        guard var record = try record(for: key), case .blocked = record.state else { return }
        record.state = .dirty; try commit(record)
    }
    public func retain(_ book: LocalEbook) throws {
        try requireOpen()
        guard book.descriptor.format == "pdf", let version = book.descriptor.pdfSourceVersion else { throw URLError(.badServerResponse) }
        let document = PDFNoteDocument(textID: book.descriptor.text.id, pdfVersion: version)
        let name = try stem(document)
        let digest = Self.digest(book.data)
        let sourceURL = sources.appending(path: name + ".pdf")
        if (try? Data(contentsOf: sourceURL)).map(Self.digest) != digest { try book.data.write(to: sourceURL, options: .atomic) }
        try JSONEncoder().encode(Source(descriptor: book.descriptor, digest: digest))
            .write(to: sources.appending(path: name + ".json"), options: .atomic)
    }
    public func retainedBook(textID: String) throws -> LocalEbook? {
        try requireOpen()
        let urls = try FileManager.default.contentsOfDirectory(at: sources, includingPropertiesForKeys: [.contentModificationDateKey])
            .filter { $0.pathExtension == "json" }.sorted {
                ((try? $0.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast)
                > ((try? $1.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast)
            }
        for url in urls {
            let source = try JSONDecoder().decode(Source.self, from: Data(contentsOf: url))
            guard source.descriptor.text.id == textID else { continue }
            let data = try Data(contentsOf: url.deletingPathExtension().appendingPathExtension("pdf"))
            guard Self.digest(data) == source.digest else { throw CocoaError(.fileReadCorruptFile) }
            return LocalEbook(descriptor: source.descriptor, data: data, location: source.descriptor.location)
        }
        return nil
    }
    public func revokeSources(textID: String? = nil, libraryID: String? = nil) throws {
        try removeSources { $0.text.id == textID || $0.library.id == libraryID }
    }
    public func reconcileSources(libraryIDs: Set<String>) throws {
        try removeSources { !libraryIDs.contains($0.library.id) }
    }
    public func reconcileSources(libraryID: String, textIDs: Set<String>) throws {
        try removeSources { $0.library.id == libraryID && !textIDs.contains($0.text.id) }
    }
    private func removeSources(where revoked: (EbookDescriptor) -> Bool) throws {
        try requireOpen()
        for url in try FileManager.default.contentsOfDirectory(at: sources, includingPropertiesForKeys: nil) where url.pathExtension == "json" {
            let source = try JSONDecoder().decode(Source.self, from: Data(contentsOf: url))
            if revoked(source.descriptor) {
                let pdf = url.deletingPathExtension().appendingPathExtension("pdf")
                if FileManager.default.fileExists(atPath: pdf.path) { try FileManager.default.removeItem(at: pdf) }
                try FileManager.default.removeItem(at: url)
            }
        }
    }
    public func close() {
        closed = true
        for listener in listeners.values { listener.finish() }
        listeners.removeAll()
    }
}
