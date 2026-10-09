import Foundation
import Observation
import LeximoryCore

enum DefinitionSource {
    case article(ReadingSelection)
    case ebook(textID: String, quote: String, context: String, offset: Int)
    var text: String {
        switch self { case .article(let selection): selection.text; case .ebook(_, let quote, _, _): quote }
    }
    var id: String {
        switch self { case .article(let selection): selection.id; case .ebook(let id, let quote, let context, let offset): id + quote + context + String(offset) }
    }
    func stream(client: MobileClient) -> AsyncThrowingStream<DefinitionEvent, Error> {
        switch self {
        case .article(let selection): client.definitions(selection: selection)
        case .ebook(let id, let quote, let context, let offset): client.ebookDefinitions(textID: id, quote: quote, context: context, offset: offset)
        }
    }
    func save(client: MobileClient, completionID: String?) async throws -> SavedVocabulary {
        switch self {
        case .article(let selection): return try await client.save(selection: selection, completionID: completionID)
        case .ebook(let id, _, _, _):
            guard let completionID else { throw URLError(.badServerResponse) }
            return try await client.saveEbookVocabulary(textID: id, completionID: completionID)
        }
    }
}

@MainActor @Observable final class DefinitionModel {
    enum State {
        case generating(String)
        case ready(Definition, completionID: String?)
        case failed(String)
    }
    enum SaveState { case idle, saving, saved, uncertain }
    private(set) var state: State
    private(set) var savedWord: SavedVocabulary?
    private(set) var editor: VocabularyEditModel?
    private(set) var saveError: String?
    private(set) var saveState: SaveState = .idle
    @ObservationIgnored private var saveRequest: Task<SavedVocabulary, Error>?
    private var creationDefinition: Definition?
    init(embedded: Definition?) {
        state = embedded.map { .ready($0, completionID: nil) } ?? .generating("")
    }
    func offline() { state = .failed("离线时可以查看已保存的释义。语境查词需要联网。") }
    func generate(client: MobileClient, source: DefinitionSource) async {
        if case .ready = state { return }
        state = .generating("")
        var raw = ""
        var completed: (String, Definition)?
        do {
            for try await event in source.stream(client: client) {
                try Task.checkCancellation()
                switch event {
                case .started: break
                case .delta(_, let text):
                    raw += text
                    let fields = raw.components(separatedBy: "||")
                    let preview = fields.count >= 3 ? fields[2].replacingOccurrences(of: "}}", with: "") : ""
                    state = .generating(preview)
                case .completed(let id, let definition): completed = (id, definition)
                case .failed(_, let error): throw DefinitionFailure(message: error.message)
                }
            }
            try Task.checkCancellation()
            guard let completed else { throw URLError(.cannotParseResponse) }
            state = .ready(completed.1, completionID: completed.0)
        } catch {
            guard !Task.isCancelled else { return }
            state = .failed((MobileClient.cause(of: error) as? MobileFailure)?.error.message ?? (error as? DefinitionFailure)?.message ?? "释义未能完成，请关闭后重试。")
        }
    }
    @discardableResult func save(client: MobileClient, source: DefinitionSource) -> Task<Void, Never>? {
        save { completionID in try await source.save(client: client, completionID: completionID) }
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
                    saveError = "未能确认收藏结果，请先在语料本中查看，避免重复收藏。"
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
            let receipt = try await request.value
            return try await persist(receipt, fields)
        }, reload: {
            let receipt = try await request.value
            return try await reload(receipt)
        }, changed: { [weak self] fields in
            guard let self, case .ready(_, let completionID) = self.state else { return }
            self.state = .ready(fields.note, completionID: completionID)
        })
    }
    private struct DefinitionFailure: Error { let message: String }
}
