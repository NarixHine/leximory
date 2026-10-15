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
    private var confirmed: Record
    @ObservationIgnored private var tail: Task<Void, Never>?
    private var revision = 0
    private var lastSubmission: VocabularyFields?
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
        confirmed = .saved(word)
        draft = word.fields
    }
    public init(fields: VocabularyFields) {
        record = .pending(fields)
        confirmed = .pending(fields)
        draft = fields
    }
    public func resolve(word: SavedWord) {
        guard case .pending = confirmed else { return }
        confirmed = .saved(word)
        // Resolving identity must not replace a draft or an optimistic edit made during creation.
        record = .saved(word.replacingFields(fields))
    }

    @discardableResult public func submit(
        persist: @escaping @MainActor (VocabularyFields) async throws -> SavedWord,
        reload: @escaping @MainActor () async throws -> SavedWord,
        changed: @escaping @MainActor (VocabularyFields) -> Void
    ) -> Task<Void, Never>? {
        guard draft.isValid, !(saving && lastSubmission == draft) else { return nil }
        let submitted = draft
        revision += 1
        let submittedRevision = revision
        let predecessor = tail
        lastSubmission = submitted
        saving = true
        error = nil
        record = record.replacingFields(submitted)
        changed(fields)
        // Serialize writes without blocking editing or cancelling a write on dismissal.
        let task = Task {
            await predecessor?.value
            defer {
                if revision == submittedRevision {
                    saving = false
                    lastSubmission = nil
                    tail = nil
                }
            }
            var failed = false
            for attempt in 0..<MutationRetry.maxAttempts {
                do {
                    let word = try await persist(submitted)
                    confirmed = .saved(word)
                    failed = false
                    break
                } catch {
                    // A read-back confirms lost responses before an idempotent edit is retried.
                    if let word = try? await reload() {
                        confirmed = .saved(word)
                        failed = word.fields != submitted
                        if !failed { break }
                    } else {
                        failed = true
                    }
                    guard attempt + 1 < MutationRetry.maxAttempts, MutationRetry.isRetryable(error),
                          revision == submittedRevision else { break }
                    do { try await MutationRetry.pause(after: attempt) }
                    catch { break }
                    if revision != submittedRevision { break }
                }
            }
            guard revision == submittedRevision else {
                // Publish a newly confirmed identity while keeping the latest optimistic fields.
                if case .saved(let word) = confirmed {
                    record = .saved(word.replacingFields(fields))
                    changed(fields)
                }
                return
            }
            record = confirmed
            if failed {
                error = "修改未能确认，请重新编辑后重试。草稿已保留。"
            } else if draft == submitted {
                draft = confirmed.fields
            }
            changed(fields)
        }
        tail = task
        return task
    }
}
