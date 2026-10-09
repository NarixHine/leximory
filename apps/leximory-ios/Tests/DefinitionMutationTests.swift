import Foundation
import Testing
import LeximoryCore
@testable import Leximory

@MainActor struct DefinitionMutationTests {
    private var definition: Definition { Definition(lemma: "bank", definition: "河岸") }
    @Test func saveSwitchesActionsImmediatelyAndIgnoresDoubleTap() async throws {
        let model = DefinitionModel(embedded: definition)
        let receipt = try JSONDecoder().decode(SavedVocabulary.self, from: Data(#"{"id":"word","libraryId":"library"}"#.utf8))
        var calls = 0
        let pending = model.save { _ in calls += 1; return receipt }
        let task = try #require(pending)
        guard case .saving = model.saveState else { Issue.record("Save must begin immediately"); return }
        let duplicate = model.save { _ in receipt }
        #expect(duplicate == nil)
        await task.value
        #expect(calls == 1)
        guard case .saved = model.saveState else { Issue.record("Expected saved state"); return }
        #expect(model.editor?.draft.note == definition)
        #expect(model.savedWord?.id == "word")
    }
    @Test func ambiguousSaveNeverAllowsDuplicateWrite() async throws {
        let model = DefinitionModel(embedded: definition)
        let pending = model.save { _ in throw URLError(.networkConnectionLost) }
        let task = try #require(pending)
        await task.value
        guard case .uncertain = model.saveState else { Issue.record("Expected uncertain state"); return }
        #expect(model.saveError != nil)
        let duplicate = model.save { _ in throw URLError(.badURL) }
        #expect(duplicate == nil)
    }
    @Test func definiteRejectionRestoresSaveAction() async throws {
        let model = DefinitionModel(embedded: definition)
        let failure = try JSONDecoder().decode(MobileFailure.self, from: Data(#"{"error":{"code":"unauthenticated","message":"请登录后继续。","retryable":false}}"#.utf8))
        let pending = model.save { _ in throw failure }
        let task = try #require(pending)
        await task.value
        guard case .idle = model.saveState else { Issue.record("Expected retryable UI"); return }
        #expect(model.saveError == "请登录后继续。")
    }
    private func receipt(_ id: String = "word") throws -> SavedVocabulary {
        try JSONDecoder().decode(SavedVocabulary.self, from: JSONSerialization.data(withJSONObject: ["id": id, "libraryId": "library"]))
    }
    @Test func editDraftIsAvailableBeforeSaveReturnsAndSurvivesConfirmation() async throws {
        let model = DefinitionModel(embedded: definition)
        let channel = AsyncThrowingStream<SavedVocabulary, Error>.makeStream()
        let saving = model.save { _ in
            for try await receipt in channel.stream { return receipt }
            throw URLError(.cancelled)
        }
        let editor = try #require(model.editor)
        #expect(editor.word == nil)
        #expect(!editor.saving)
        editor.draft.definition = "河堤"
        channel.continuation.yield(try receipt())
        channel.continuation.finish()
        await saving?.value
        #expect(model.editor === editor)
        #expect(editor.word?.id == "word")
        #expect(editor.draft.definition == "河堤")
    }
    @Test func editSubmittedDuringSaveWaitsForRealIdentity() async throws {
        let model = DefinitionModel(embedded: definition)
        let channel = AsyncThrowingStream<SavedVocabulary, Error>.makeStream()
        let saving = model.save { _ in
            for try await receipt in channel.stream { return receipt }
            throw URLError(.cancelled)
        }
        let editor = try #require(model.editor)
        editor.draft.definition = "河堤"
        var writes: [String] = []
        let editing = model.submitEdit(persist: { receipt, fields in
            writes.append(receipt.id)
            return SavedWord(id: receipt.id, libraryId: receipt.libraryId, fields: fields)
        }, reload: { _ in throw URLError(.badServerResponse) })
        #expect(editor.fields.definition == "河堤")
        let duplicate = model.submitEdit(persist: { _, _ in throw URLError(.badURL) }, reload: { _ in throw URLError(.badURL) })
        #expect(duplicate == nil)
        await Task.yield()
        #expect(writes.isEmpty)
        channel.continuation.yield(try receipt("confirmed-id"))
        channel.continuation.finish()
        await saving?.value
        await editing?.value
        #expect(writes == ["confirmed-id"])
        #expect(editor.word?.id == "confirmed-id")
        #expect(editor.fields.definition == "河堤")
        #expect(editor.error == nil)
        #expect(!editor.saving)
    }
    @Test(arguments: [false, true]) func failedCreationNeverSendsQueuedEditAndRetainsDraft(ambiguous: Bool) async throws {
        let model = DefinitionModel(embedded: definition)
        let channel = AsyncThrowingStream<SavedVocabulary, Error>.makeStream()
        let saving = model.save { _ in
            for try await receipt in channel.stream { return receipt }
            throw URLError(.cancelled)
        }
        let editor = try #require(model.editor)
        editor.draft.definition = "河堤"
        var writes = 0
        var reads = 0
        let editing = model.submitEdit(persist: { _, _ in
            writes += 1
            throw URLError(.badURL)
        }, reload: { _ in
            reads += 1
            throw URLError(.badURL)
        })
        let rejection = try JSONDecoder().decode(MobileFailure.self, from: Data(#"{"error":{"code":"unauthenticated","message":"请登录后继续。","retryable":false}}"#.utf8))
        channel.continuation.finish(throwing: ambiguous ? URLError(.networkConnectionLost) : rejection)
        await saving?.value
        await editing?.value
        #expect(writes == 0)
        #expect(reads == 0)
        #expect(editor.word == nil)
        #expect(editor.fields.note == definition)
        #expect(editor.draft.definition == "河堤")
        #expect(!editor.saving)
        #expect(model.saveError != nil)
        if !ambiguous {
            let confirmed = try receipt("retry-id")
            let retry = model.save { _ in confirmed }
            await retry?.value
            #expect(model.editor === editor)
            #expect(editor.draft.definition == "河堤")
            let retryEdit = model.submitEdit(persist: { receipt, fields in
                SavedWord(id: receipt.id, libraryId: receipt.libraryId, fields: fields)
            }, reload: { _ in throw URLError(.badURL) })
            await retryEdit?.value
            #expect(editor.word?.id == "retry-id")
            #expect(editor.fields.definition == "河堤")
        }
    }

}
