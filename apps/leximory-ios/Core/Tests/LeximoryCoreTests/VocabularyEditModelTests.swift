import Foundation
import Testing
@testable import LeximoryCore

@MainActor struct VocabularyEditModelTests {
    private var word: SavedWord {
        SavedWord(id: "word", libraryId: "library", fields: VocabularyFields(original: "banks", definition: Definition(lemma: "bank", definition: "河岸")))
    }
    @Test func editUpdatesImmediatelyAndRejectsDoubleSubmission() async throws {
        let model = VocabularyEditModel(word: word)
        model.draft.definition = "河堤"
        var writes = 0
        var updates: [String] = []
        let taskPending = model.submit(persist: { fields in
            writes += 1
            return self.word.replacingFields(fields)
        }, reload: { Issue.record("Successful edits must not reload"); return self.word }, changed: { updates.append($0.fields.definition) })
        let task = try #require(taskPending)
        #expect(model.word.fields.definition == "河堤")
        #expect(model.saving)
        let duplicate = model.submit(persist: { _ in self.word }, reload: { self.word }, changed: { _ in })
        #expect(duplicate == nil)
        await task.value
        #expect(writes == 1)
        #expect(model.error == nil)
        #expect(!model.saving)
        #expect(updates == ["河堤", "河堤"])
    }
    @Test func lostEditResponseReconcilesWithoutRepeatingWrite() async throws {
        let model = VocabularyEditModel(word: word)
        model.draft.definition = "河堤"
        let committed = word.replacingFields(model.draft)
        var writes = 0
        let taskPending = model.submit(persist: { _ in
            writes += 1
            throw URLError(.networkConnectionLost)
        }, reload: { committed }, changed: { _ in })
        let task = try #require(taskPending)
        await task.value
        #expect(writes == 1)
        #expect(model.word.fields == committed.fields)
        #expect(model.error == nil)
    }
    @Test func failedEditRollsBackAndRetainsDraftForRetry() async throws {
        let model = VocabularyEditModel(word: word)
        model.draft.definition = "河堤"
        var updates: [String] = []
        let taskPending = model.submit(persist: { _ in throw URLError(.notConnectedToInternet) },
            reload: { throw URLError(.notConnectedToInternet) }, changed: { updates.append($0.fields.definition) })
        let task = try #require(taskPending)
        await task.value
        #expect(model.word.fields == word.fields)
        #expect(model.draft.definition == "河堤")
        #expect(model.error != nil)
        #expect(!model.saving)
        #expect(updates == ["河堤", "河岸"])
        let retryPending = model.submit(persist: { self.word.replacingFields($0) }, reload: { self.word }, changed: { _ in })
        let retry = try #require(retryPending)
        await retry.value
        #expect(model.error == nil)
        #expect(model.word.fields.definition == "河堤")
    }
    @Test func rejectedEditUsesServerValueAndKeepsDraft() async throws {
        let model = VocabularyEditModel(word: word)
        model.draft.definition = "河堤"
        let taskPending = model.submit(persist: { _ in throw URLError(.badServerResponse) }, reload: { self.word }, changed: { _ in })
        let task = try #require(taskPending)
        await task.value
        #expect(model.word.fields == word.fields)
        #expect(model.draft.definition == "河堤")
        #expect(model.error != nil)
    }
}
