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
        }, reload: { Issue.record("Successful edits must not reload"); return self.word }, changed: { updates.append($0.definition) })
        let task = try #require(taskPending)
        #expect(model.word?.fields.definition == "河堤")
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
        #expect(model.word?.fields == committed.fields)
        #expect(model.error == nil)
    }
    @Test func failedEditRollsBackAndRetainsDraftForRetry() async throws {
        let model = VocabularyEditModel(word: word)
        model.draft.definition = "河堤"
        var updates: [String] = []
        let taskPending = model.submit(persist: { _ in throw URLError(.notConnectedToInternet) },
            reload: { throw URLError(.notConnectedToInternet) }, changed: { updates.append($0.definition) })
        let task = try #require(taskPending)
        await task.value
        #expect(model.word?.fields == word.fields)
        #expect(model.draft.definition == "河堤")
        #expect(model.error != nil)
        #expect(!model.saving)
        #expect(updates == ["河堤", "河岸"])
        let retryPending = model.submit(persist: { self.word.replacingFields($0) }, reload: { self.word }, changed: { _ in })
        let retry = try #require(retryPending)
        await retry.value
        #expect(model.error == nil)
        #expect(model.word?.fields.definition == "河堤")
    }
    @Test func rejectedEditUsesServerValueAndKeepsDraft() async throws {
        let model = VocabularyEditModel(word: word)
        model.draft.definition = "河堤"
        let taskPending = model.submit(persist: { _ in throw URLError(.badServerResponse) }, reload: { self.word }, changed: { _ in })
        let task = try #require(taskPending)
        await task.value
        #expect(model.word?.fields == word.fields)
        #expect(model.draft.definition == "河堤")
        #expect(model.error != nil)
    }
    @Test func pendingIdentityResolvesWithoutReplacingDraft() {
        let model = VocabularyEditModel(fields: word.fields)
        model.draft.definition = "河堤"
        model.resolve(word: word)
        #expect(model.word?.id == word.id)
        #expect(model.fields == word.fields)
        #expect(model.draft.definition == "河堤")
    }
    @Test func failedQueuedEditRollsBackFieldsAndKeepsResolvedIdentity() async throws {
        let model = VocabularyEditModel(fields: word.fields)
        model.draft.definition = "河堤"
        let channel = AsyncThrowingStream<SavedWord, Error>.makeStream()
        let editing = model.submit(persist: { _ in
            for try await word in channel.stream { return word }
            throw URLError(.cancelled)
        }, reload: { throw URLError(.networkConnectionLost) }, changed: { _ in })
        model.resolve(word: word)
        #expect(model.fields.definition == "河堤")
        #expect(model.draft.definition == "河堤")
        channel.continuation.finish(throwing: URLError(.networkConnectionLost))
        await editing?.value
        #expect(model.word?.id == word.id)
        #expect(model.fields == word.fields)
        #expect(model.draft.definition == "河堤")
        #expect(model.error != nil)
    }
    @Test func lateCreationResponseCannotReplaceConfirmedEdit() async {
        let model = VocabularyEditModel(fields: word.fields)
        model.draft.definition = "河堤"
        let editing = model.submit(persist: { self.word.replacingFields($0) }, reload: { self.word }, changed: { _ in })
        await editing?.value
        model.resolve(word: word)
        #expect(model.word?.id == word.id)
        #expect(model.fields.definition == "河堤")
        #expect(model.draft.definition == "河堤")
    }

    @Test func successiveEditsStayOptimisticAndPersistInOrder() async throws {
        let model = VocabularyEditModel(word: word)
        let gate = AsyncStream<Void>.makeStream()
        var writes: [String] = []
        model.draft.definition = "first"
        let first = model.submit(persist: { fields in
            writes.append(fields.definition)
            for await _ in gate.stream { break }
            return self.word.replacingFields(fields)
        }, reload: { self.word }, changed: { _ in })
        model.draft.definition = "second"
        let second = model.submit(persist: { fields in
            #expect(writes == ["first"])
            writes.append(fields.definition)
            return self.word.replacingFields(fields)
        }, reload: { self.word }, changed: { _ in })
        #expect(second != nil)
        #expect(model.fields.definition == "second")
        model.draft.definition = "unsent typing"
        gate.continuation.yield(())
        gate.continuation.finish()
        await first?.value
        await second?.value
        #expect(writes == ["first", "second"])
        #expect(model.fields.definition == "second")
        #expect(model.draft.definition == "unsent typing")
        #expect(model.error == nil)
        #expect(!model.saving)
    }
    @Test func failedLatestEditRestoresLastConfirmedEdit() async {
        let model = VocabularyEditModel(word: word)
        model.draft.definition = "first"
        let first = model.submit(persist: { self.word.replacingFields($0) }, reload: { self.word }, changed: { _ in })
        let confirmed = word.replacingFields(model.draft)
        model.draft.definition = "second"
        var writes = 0
        let second = model.submit(persist: { _ in
            writes += 1
            throw MobileFailure(error: .init(code: "invalid_input", message: "invalid", retryable: false))
        }, reload: { confirmed }, changed: { _ in })
        await first?.value
        await second?.value
        #expect(writes == 1)
        #expect(model.fields.definition == "first")
        #expect(model.draft.definition == "second")
        #expect(model.error != nil)
    }
    @Test func transientEditFailureRetriesBeforeReportingFailure() async {
        let model = VocabularyEditModel(word: word)
        model.draft.definition = "edited"
        var writes = 0
        let task = model.submit(persist: { fields in
            writes += 1
            if writes < 3 { throw URLError(.timedOut) }
            return self.word.replacingFields(fields)
        }, reload: {
            #expect(model.error == nil)
            #expect(model.fields.definition == "edited")
            return self.word
        }, changed: { _ in })
        await task?.value
        #expect(writes == 3)
        #expect(model.fields.definition == "edited")
        #expect(model.error == nil)
    }
    @Test func supersededFailureDoesNotRetryOrOverwriteLatestEdit() async {
        let model = VocabularyEditModel(word: word)
        var writes = 0
        model.draft.definition = "first"
        let first = model.submit(persist: { _ in
            writes += 1
            throw URLError(.timedOut)
        }, reload: { self.word }, changed: { _ in })
        model.draft.definition = "second"
        let second = model.submit(persist: { self.word.replacingFields($0) }, reload: { self.word }, changed: { _ in })
        await first?.value
        await second?.value
        #expect(writes == 1)
        #expect(model.fields.definition == "second")
        #expect(model.error == nil)
    }

}
