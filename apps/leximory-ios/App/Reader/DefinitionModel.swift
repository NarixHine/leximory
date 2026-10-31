import Foundation
import Observation
import LeximoryCore

enum DefinitionSource {
    case article(ReadingSelection)
    case ebook(textID: String, quote: String, context: String, offset: Int)
    case browser(quote: String, target: BrowserTarget)
    case webpage(id: UUID, selection: BrowserSelection, bookmarkID: String?, libraryID: String?)
    var text: String {
        switch self { case .article(let selection): selection.text; case .ebook(_, let quote, _, _): quote; case .browser(let quote, _): quote; case .webpage(_, let selection, _, _): selection.quote }
    }
    var id: String {
        switch self { case .article(let selection): selection.id; case .ebook(let id, let quote, let context, let offset): id + quote + context + String(offset); case .browser(_, let target): target.selectionId; case .webpage(let id, _, _, _): id.uuidString }
    }
    func stream(client: MobileClient) async throws -> (events: AsyncThrowingStream<DefinitionEvent, Error>, target: BrowserTarget?) {
        switch self {
        case .article(let selection): return (client.definitions(selection: selection), nil)
        case .ebook(let id, let quote, let context, let offset): return (client.ebookDefinitions(textID: id, quote: quote, context: context, offset: offset), nil)
        case .browser(_, let target): return (client.browserDefinitions(selectionID: target.selectionId), target)
        case .webpage(_, let selection, let bookmarkID, let libraryID):
            let target = try await client.browserSelection(url: selection.url, quote: selection.quote, context: selection.context,
                offset: selection.offset, bookmarkID: bookmarkID, libraryID: libraryID)
            try Task.checkCancellation()
            return (client.browserDefinitions(selectionID: target.selectionId), target)
        }
    }
    func save(client: MobileClient, completionID: String?) async throws -> SavedVocabulary {
        switch self {
        case .article(let selection): return try await client.save(selection: selection, completionID: completionID)
        case .ebook(let id, _, _, _):
            guard let completionID else { throw URLError(.badServerResponse) }
            return try await client.saveEbookVocabulary(textID: id, completionID: completionID)
        case .browser, .webpage:
            guard let completionID else { throw URLError(.badServerResponse) }
            return try await client.saveBrowserVocabulary(completionID: completionID)
        }
    }
}

@MainActor @Observable final class DefinitionModel {
    enum State {
        case generating(Definition)
        case ready(Definition, completionID: String?)
        case failed(String, preview: Definition?)
    }
    enum SaveState: Equatable { case idle, queued, saving, saved, uncertain }
    private(set) var state: State
    private(set) var browserTarget: BrowserTarget?
    private(set) var savedWord: SavedVocabulary?
    private(set) var editor: VocabularyEditModel?
    private(set) var saveError: String?
    private(set) var saveState: SaveState = .idle
    @ObservationIgnored private var saveRequest: Task<SavedVocabulary, Error>?
    @ObservationIgnored private var generationTask: Task<Void, Never>?
    @ObservationIgnored private var queuedSave: (@MainActor (String?) async throws -> SavedVocabulary)?
    private var creationDefinition: Definition?
    var visibleDefinition: Definition? {
        switch state {
        case .generating(let preview): preview.definition.isEmpty ? nil : preview
        case .ready(let definition, _): definition
        case .failed(_, let preview): preview
        }
    }
    var isReady: Bool { if case .ready = state { true } else { false } }
    var isGenerating: Bool { if case .generating = state { true } else { false } }
    init(embedded: Definition?) {
        state = embedded.map { .ready($0, completionID: nil) } ?? .generating(Definition(lemma: "", definition: ""))
    }
    func offline() { state = .failed("离线时可以查看已保存的释义。语境查词需要联网。", preview: visibleDefinition) }
    @discardableResult func startGeneration(client: MobileClient, source: DefinitionSource) -> Task<Void, Never>? {
        startGeneration { try await source.stream(client: client) }
    }
    @discardableResult func startGeneration(stream: @escaping @MainActor () async throws -> (events: AsyncThrowingStream<DefinitionEvent, Error>, target: BrowserTarget?)) -> Task<Void, Never>? {
        guard generationTask == nil, !isReady else { return nil }
        let task = Task {
            await generate(stream: stream)
            generationTask = nil
        }
        generationTask = task
        return task
    }
    func dismiss() {
        // An explicit save outlives the tray. An ordinary lookup does not.
        if saveState != .queued && saveState != .saving { generationTask?.cancel() }
    }
    func generate(stream: @MainActor () async throws -> (events: AsyncThrowingStream<DefinitionEvent, Error>, target: BrowserTarget?)) async {
        if case .ready = state { return }
        let retained = visibleDefinition
        state = .generating(retained ?? Definition(lemma: "", definition: ""))
        let buffer = DefinitionPreviewBuffer { [weak self] preview in self?.state = .generating(preview) }
        defer { buffer.cancel() }
        var started = false
        var recovering = retained != nil
        do {
            try Task.checkCancellation()
            let stream = try await stream()
            browserTarget = stream.target
            for try await event in stream.events {
                try Task.checkCancellation()
                switch event {
                case .started:
                    // A retry can produce different wording. Retain the visible response
                    // until its replacement completes instead of replaying its opening.
                    if started { recovering = visibleDefinition != nil }
                    started = true
                    buffer.restart(retaining: recovering)
                case .delta(_, let text):
                    buffer.append(text)
                case .completed(let id, let definition):
                    buffer.cancel()
                    state = .ready(definition, completionID: id)
                    if let operation = queuedSave {
                        queuedSave = nil
                        saveState = .idle
                        save(operation: operation)
                    }
                    return
                case .failed(_, let error): throw DefinitionFailure(message: error.message)
                }
            }
            try Task.checkCancellation()
            throw URLError(.cannotParseResponse)
        } catch {
            guard !Task.isCancelled else { return }
            buffer.flush()
            state = .failed((MobileClient.cause(of: error) as? MobileFailure)?.error.message ?? (error as? DefinitionFailure)?.message ?? "释义未能完成，请关闭后重试。", preview: visibleDefinition)
            if saveState == .queued {
                queuedSave = nil
                saveState = .idle
                saveError = "词汇尚未收藏，请在释义完成后重试。"
            }
        }
    }
    func requestSave(client: MobileClient, source: DefinitionSource) {
        requestSave { completionID in
            let receipt = try await source.save(client: client, completionID: completionID)
            SavedWordsWidgetSync.schedule(client: client)
            return receipt
        }
    }
    func requestSave(operation: @escaping @MainActor (String?) async throws -> SavedVocabulary) {
        guard saveState == .idle else { return }
        if isGenerating, visibleDefinition != nil {
            saveError = nil
            queuedSave = operation
            saveState = .queued
        } else { save(operation: operation) }
    }
    @discardableResult func save(operation: @escaping @MainActor (String?) async throws -> SavedVocabulary) -> Task<Void, Never>? {
        guard case .ready(let definition, let completionID) = state, case .idle = saveState else { return nil }
        let original = creationDefinition ?? definition
        creationDefinition = original
        if editor == nil { editor = VocabularyEditModel(fields: VocabularyFields(original: original.lemma, definition: original)) }
        saveError = nil
        saveState = .saving
        let request = Task { try await operation(completionID) }
        saveRequest = request
        return Task {
            do {
                let receipt = try await request.value
                savedWord = receipt
                editor?.resolve(word: SavedWord(id: receipt.id, libraryId: receipt.libraryId,
                    fields: VocabularyFields(original: original.lemma, definition: original)))
                saveState = .saved
            } catch {
                if let failure = MobileClient.cause(of: error) as? MobileFailure,
                   !failure.error.retryable {
                    saveState = .idle
                    saveError = failure.error.message
                } else {
                    saveState = .uncertain
                    saveError = "未能确认收藏结果，请先在已存词汇中查看，避免重复收藏。"
                }
            }
        }
    }
    @discardableResult func submitEdit(client: MobileClient) -> Task<Void, Never>? {
        submitEdit(persist: { receipt, fields in try await client.editWord(id: receipt.id, fields: fields) },
            reload: { receipt in try await client.savedWord(id: receipt.id) })
    }
    @discardableResult func submitEdit(
        persist: @escaping @MainActor (SavedVocabulary, VocabularyFields) async throws -> SavedWord,
        reload: @escaping @MainActor (SavedVocabulary) async throws -> SavedWord
    ) -> Task<Void, Never>? {
        guard let editor, let request = saveRequest else { return nil }
        return editor.submit(persist: { fields in
            let receipt = try await Self.confirmedReceipt(request)
            return try await persist(receipt, fields)
        }, reload: {
            let receipt = try await Self.confirmedReceipt(request)
            return try await reload(receipt)
        }, changed: { [weak self] fields in
            guard let self, case .ready(_, let completionID) = self.state else { return }
            self.state = .ready(fields.note, completionID: completionID)
        })
    }
    private static func confirmedReceipt(_ request: Task<SavedVocabulary, Error>) async throws -> SavedVocabulary {
        do { return try await request.value }
        catch { throw CreationFailed() }
    }
    private struct CreationFailed: Error {}
    private struct DefinitionFailure: Error { let message: String }
}
