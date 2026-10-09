import Foundation
import Observation

@MainActor @Observable public final class VocabularyEditModel {
    public private(set) var word: SavedWord
    public var draft: VocabularyFields
    public private(set) var saving = false
    public private(set) var error: String?

    public init(word: SavedWord) {
        self.word = word
        draft = word.fields
    }

    @discardableResult public func submit(
        persist: @escaping @MainActor (VocabularyFields) async throws -> SavedWord,
        reload: @escaping @MainActor () async throws -> SavedWord,
        changed: @escaping @MainActor (SavedWord) -> Void
    ) -> Task<Void, Never>? {
        guard !saving, draft.isValid else { return nil }
        let previous = word
        let submitted = draft
        saving = true
        error = nil
        word = previous.replacingFields(submitted)
        changed(word)
        // The mutation outlives the editor's presentation. Never cancel a write on dismissal.
        return Task {
            defer { saving = false }
            do {
                word = try await persist(submitted)
                draft = word.fields
                changed(word)
            } catch {
                // A lost response may still mean the edit committed. Confirm by reading, without another write.
                if let confirmed = try? await reload() {
                    word = confirmed
                    if confirmed.fields == submitted {
                        changed(word)
                        return
                    }
                } else {
                    word = previous
                }
                self.error = "修改未能确认，请重新编辑后重试。草稿已保留。"
                changed(word)
            }
        }
    }
}
