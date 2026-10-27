import SwiftUI
import PDFKit
import LeximoryCore

@MainActor @Observable final class PDFOutlineModel {
    enum Change { case generation, undo, redo }
    private struct Pending {
        let change: Change
        let data: Data
        let requestID: UUID
        let generationID: UUID?
    }
    let textID: String
    private(set) var busy = false
    private(set) var generating = false
    private(set) var error: String?
    private(set) var allowance: Account.Allowance?
    private var quotaBlocked = false
    private(set) var revision: String?
    private(set) var savedData: Data
    private(set) var canUndo = false
    private(set) var canRedo = false
    var writable: Bool
    var online = true
    @ObservationIgnored private weak var reader: EbookReaderState?
    @ObservationIgnored private var document: PDFDocument?
    @ObservationIgnored private var undoData: Data?
    @ObservationIgnored private var redoData: Data?
    @ObservationIgnored private var pending: Pending?
    @ObservationIgnored private var generationID = UUID()
    @ObservationIgnored private let generate: ([String], UUID) async throws -> [PDFOutlineEntry]
    @ObservationIgnored private let save: (Data, UUID, UUID?, String?) async throws -> SavedPDFOutline
    @ObservationIgnored private let usage: () async throws -> Account.Allowance

    init(textID: String, data: Data, revision: String?, writable: Bool,
         generate: @escaping ([String], UUID) async throws -> [PDFOutlineEntry],
         save: @escaping (Data, UUID, UUID?, String?) async throws -> SavedPDFOutline,
         usage: @escaping () async throws -> Account.Allowance) {
        self.textID = textID; savedData = data; self.revision = revision; self.writable = writable
        self.generate = generate; self.save = save; self.usage = usage
    }
    convenience init(book: LocalEbook, client: MobileClient) {
        let id = book.descriptor.text.id
        let version = book.descriptor.pdfSourceVersion ?? ""
        self.init(textID: id, data: book.data, revision: book.descriptor.outlineRevision,
                  writable: book.descriptor.library.owned && !book.descriptor.library.shadow && !version.isEmpty,
                  generate: { pages, request in
                      try await client.generatePDFOutline(textID: id, sourceVersion: version, pages: pages, requestID: request)
                  }, save: { data, request, generation, revision in
                      try await client.savePDFOutline(textID: id, sourceVersion: version, baseRevision: revision, generationID: generation, requestID: request, data: data)
                  }, usage: { try await client.accountSettings().definitions })
    }
    var unavailableReason: String? {
        if !writable { return "这份 PDF 暂不可修改。" }
        if !online { return "连接网络后可生成目录。" }
        if document?.isLocked != false || document?.allowsDocumentChanges != true { return "这份 PDF 不允许修改目录。" }
        if document?.isEncrypted == true { return "加密 PDF 暂不支持生成目录。" }
        if quotaBlocked { return "本期词点额度已用完。" }
        guard let allowance else { return nil }
        if allowance.limit - allowance.used < 1 { return "本期词点额度已用完。" }
        return nil
    }
    var exhausted: Bool { quotaBlocked || (allowance.map { $0.limit - $0.used < 1 } ?? false) }
    var hasPendingSave: Bool { pending != nil }
    var canGenerate: Bool {
        guard !busy, writable, online, document?.isLocked == false,
              document?.allowsDocumentChanges == true, document?.isEncrypted == false else { return false }
        return pending != nil || (allowance != nil && !exhausted)
    }
    var canRestore: Bool { !busy && pending == nil && writable && online && document?.allowsDocumentChanges == true }
    func attach(_ document: PDFDocument, reader: EbookReaderState) {
        self.document = document; self.reader = reader
        if let saved = PDFDocument(data: savedData) {
            document.outlineRoot = Self.copyOutline(saved.outlineRoot, from: saved, to: document)
        }
        updateChapters()
    }
    func refreshAllowance() async {
        if let result = try? await usage() { allowance = result; quotaBlocked = result.limit - result.used < 1 }
    }
    @discardableResult func start(_ change: Change = .generation) -> Task<Void, Never>? {
        guard !busy, writable, online else { return nil }
        if change == .generation && !canGenerate { return nil }
        if pending == nil && change != .generation && !canRestore { return nil }
        busy = true; generating = change == .generation && pending == nil; error = nil
        // This task belongs to the reading session, not the ToC presentation lifecycle.
        return Task { await perform(change) }
    }
    private func perform(_ change: Change) async {
        defer { busy = false; generating = false }
        do {
            if pending == nil {
                switch change {
                case .generation:
                    let bytes = savedData
                    let pages = try await Task.detached(priority: .utility) {
                        guard let pdf = PDFDocument(data: bytes), pdf.pageCount > 0 else { throw CocoaError(.fileReadCorruptFile) }
                        let pages = (0..<pdf.pageCount).map { String((pdf.page(at: $0)?.string ?? "").prefix(12000)) }
                        guard pages.contains(where: { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }),
                              pages.reduce(0, { $0 + $1.utf8.count }) < 1_800_000 else { throw CocoaError(.fileReadTooLarge) }
                        return pages
                    }.value
                    let entries = try await generate(pages, generationID)
                    try Self.validate(entries: entries, pageCount: pages.count)
                    pending = Pending(change: .generation, data: savedData, requestID: generationID, generationID: generationID)
                case .undo:
                    guard let undoData else { return }
                    pending = Pending(change: .undo, data: undoData, requestID: UUID(), generationID: nil)
                case .redo:
                    guard let redoData else { return }
                    pending = Pending(change: .redo, data: redoData, requestID: UUID(), generationID: nil)
                }
            }
            guard let pending else { return }
            let publication = try await save(pending.data, pending.requestID, pending.generationID, revision)
            guard let saved = PDFDocument(data: publication.data), saved.pageCount == document?.pageCount,
                  pending.change != .generation || (saved.outlineRoot?.numberOfChildren ?? 0) > 0 else { throw CocoaError(.fileReadCorruptFile) }
            switch pending.change {
            case .generation:
                undoData = savedData; redoData = publication.data; canUndo = true; canRedo = false
                generationID = UUID()
            case .undo: canUndo = false; canRedo = true
            case .redo: canUndo = true; canRedo = false
            }
            savedData = publication.data; revision = publication.revision
            if let document {
                document.outlineRoot = Self.copyOutline(saved.outlineRoot, from: saved, to: document)
            }
            updateChapters()
            self.pending = nil
            if pending.change == .generation {
                if let allowance { self.allowance = Account.Allowance(used: allowance.used + 1, limit: allowance.limit, resetsIn: allowance.resetsIn) }
                await refreshAllowance()
                NotificationCenter.default.post(name: .pdfOutlineUsageChanged, object: nil)
            }
        } catch {
            let cause = MobileClient.cause(of: error)
            if let failure = cause as? MobileFailure {
                switch failure.error.code {
                case "quota_exceeded":
                    quotaBlocked = true
                    pending = nil
                    await refreshAllowance(); self.error = "本期词点额度已用完。"
                case "inaccessible", "unauthenticated", "stale_revision":
                    writable = false; self.error = "这份 PDF 已更新或暂不可修改，请重新打开。"
                default: self.error = pending == nil ? "目录未能生成，请再试一次。" : "目录未能保存，请再试一次。"
                }
            } else { self.error = pending == nil ? "目录未能生成，请再试一次。" : "目录未能保存，请再试一次。" }
        }
    }
    static func validate(entries: [PDFOutlineEntry], pageCount: Int) throws {
        guard !entries.isEmpty else { throw CocoaError(.fileReadCorruptFile) }
        var lastPage = 1, lastDepth = -1
        for entry in entries {
            guard !entry.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                  entry.page >= lastPage, entry.page <= pageCount,
                  entry.depth >= 0, entry.depth <= lastDepth + 1, entry.depth <= 8 else { throw CocoaError(.fileReadCorruptFile) }
            lastPage = entry.page; lastDepth = entry.depth
        }
    }
    static func copyOutline(_ outline: PDFOutline?, from source: PDFDocument, to target: PDFDocument) -> PDFOutline? {
        guard let outline else { return nil }
        let copy = PDFOutline(); copy.label = outline.label
        if let destination = outline.destination, let sourcePage = destination.page,
           let page = target.page(at: source.index(for: sourcePage)) {
            let mapped = PDFDestination(page: page, at: destination.point); mapped.zoom = destination.zoom
            copy.destination = mapped
        } else { copy.action = outline.action?.copy() as? PDFAction }
        for index in 0..<outline.numberOfChildren {
            if let child = copyOutline(outline.child(at: index), from: source, to: target) { copy.insertChild(child, at: copy.numberOfChildren) }
        }
        copy.isOpen = outline.isOpen
        return copy
    }
    private func updateChapters() {
        guard let document, let reader, reader.pdfOutline === self else { return }
        reader.chapters = Self.chapters(document)
    }
    static func chapters(_ document: PDFDocument) -> [EbookChapter] {
        func visit(_ outline: PDFOutline, depth: Int = 0) -> [EbookChapter] {
            (0..<outline.numberOfChildren).flatMap { index -> [EbookChapter] in
                guard let node = outline.child(at: index) else { return [] }
                let own = node.destination?.page.map { page in
                    EbookChapter(title: node.label ?? "", location: String(document.index(for: page) + 1), depth: depth)
                }
                return (own.map { [$0] } ?? []) + visit(node, depth: depth + 1)
            }
        }
        let chapters = document.outlineRoot.map { visit($0) } ?? []
        return chapters.isEmpty ? (0..<document.pageCount).map { EbookChapter(title: "\($0 + 1)", location: "\($0 + 1)") } : chapters
    }
}
