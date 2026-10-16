import Foundation

public actor PDFNotesSync {
    private let store: PDFNotesStore
    private let remote: any PDFNotesRemote
    private var running = false
    private var requested: Set<PDFNoteDocument> = []
    private var stopped = false
    private var needsPass = false
    public init(store: PDFNotesStore, remote: any PDFNotesRemote) { self.store = store; self.remote = remote }
    public func stop() { stopped = true }

    public func synchronize(document: PDFNoteDocument? = nil) async throws {
        if let document { requested.insert(document) }
        needsPass = true
        guard !running, !stopped else { return }
        running = true
        defer { running = false }
        repeat {
            needsPass = false
            let documents = requested; requested.removeAll()
            let keys = try await store.keys()
            for key in keys {
                try Task.checkCancellation()
                guard !stopped else { return }
                while let upload = try await store.prepareUpload(for: key) {
                    do {
                        let saved = try await remote.savePDFNote(upload)
                        guard !stopped else { return }
                        try await store.acknowledge(upload, saved: saved)
                    } catch {
                        try Task.checkCancellation()
                        guard !stopped else { return }
                        let failure = MobileClient.cause(of: error) as? MobileFailure
                        switch failure?.error.code {
                        case "stale_revision":
                            let page = try await remote.pdfNotes(textID: key.document.textID, pdfVersion: key.document.pdfVersion, after: key.pageIndex - 1)
                            guard let note = page.notes.first, note.pageIndex == key.pageIndex else { throw URLError(.badServerResponse) }
                            try await store.conflict(upload, remote: note)
                        case "inaccessible", "unsupported_format":
                            try await store.block(upload, problem: .accessDenied)
                            try await store.revokeSources(textID: key.document.textID)
                        case "invalid_input": try await store.block(upload, problem: .cannotUpload)
                        default: throw error
                        }
                        break
                    }
                }
            }
            for document in documents {
                var baseline: [Int: UUID] = [:]
                for key in try await store.keys() where key.document == document {
                    baseline[key.pageIndex] = try await store.record(for: key)?.note.revision
                }
                var cursor: Int? = nil
                repeat {
                    try Task.checkCancellation()
                    guard !stopped else { return }
                    let page = try await remote.pdfNotes(textID: document.textID, pdfVersion: document.pdfVersion, after: cursor)
                    for note in page.notes {
                        guard note.pageIndex > (cursor ?? -1) else { throw URLError(.badServerResponse) }
                        try await store.integrate(note, document: document, baseline: baseline[note.pageIndex])
                    }
                    if let next = page.nextCursor {
                        guard next > (cursor ?? -1), page.notes.last?.pageIndex == next else { throw URLError(.badServerResponse) }
                    }
                    cursor = page.nextCursor
                } while cursor != nil
            }
        } while (needsPass || !requested.isEmpty) && !stopped
    }
}
