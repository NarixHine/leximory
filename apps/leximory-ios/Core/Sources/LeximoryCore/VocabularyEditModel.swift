import Foundation
import Observation

@MainActor @Observable public final class VocabularyEditModel {
    private enum Record {
        case pending(VocabularyFields)
        case saved(SavedWord)

        var fields: VocabularyFields {
            switch self {
            case .pending(let fields): fields
            case .saved(let word): word.fields
            }
        }
        func replacingFields(_ fields: VocabularyFields) -> Record {
            switch self {
            case .pending: .pending(fields)
            case .saved(let word): .saved(word.replacingFields(fields))
            }
        }
    }
    private var record: Record
    public var word: SavedWord? {
        if case .saved(let word) = record { return word }
        return nil
    }
    public var fields: VocabularyFields { record.fields }
    public var draft: VocabularyFields
    public private(set) var saving = false
    public private(set) var error: String?

    public init(word: SavedWord) {
        record = .saved(word)
        draft = word.fields
    }
    public init(fields: VocabularyFields) {
        record = .pending(fields)
        draft = fields
    }
    public func resolve(word: SavedWord) {
        guard case .pending = record else { return }
        // Resolving identity must not replace a draft or an optimistic edit made during creation.
        record = .saved(word.replacingFields(fields))
    }

    @discardableResult public func submit(
        persist: @escaping @MainActor (VocabularyFields) async throws -> SavedWord,
        reload: @escaping @MainActor () async throws -> SavedWord,
        changed: @escaping @MainActor (VocabularyFields) -> Void
    ) -> Task<Void, Never>? {
        guard !saving, draft.isValid else { return nil }
        let previous = fields
        let submitted = draft
        saving = true
        error = nil
        record = record.replacingFields(submitted)
        changed(fields)
        // The mutation outlives the editor's presentation. Never cancel a write on dismissal.
        return Task {
            defer { saving = false }
            do {
                let word = try await persist(submitted)
                record = .saved(word)
                draft = word.fields
                changed(fields)
            } catch {
                // A lost response may still mean the edit committed. Confirm by reading, without another write.
                if let confirmed = try? await reload() {
                    record = .saved(confirmed)
                    if confirmed.fields == submitted {
                        changed(fields)
                        return
                    }
                } else {
                    record = record.replacingFields(previous)
                }
                self.error = "修改未能确认，请重新编辑后重试。草稿已保留。"
                changed(fields)
            }
        }
    }
}
