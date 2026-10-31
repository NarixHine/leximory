import Foundation
import Testing
import LeximoryCore
@testable import Leximory

@MainActor struct DefinitionMutationTests {
    private var definition: Definition { Definition(lemma: "bank", definition: "河岸") }
    @Test(.timeLimit(.minutes(1))) func generatedDefinitionIsReadyBeforeTheConnectionCloses() async throws {
        let model = DefinitionModel(embedded: nil)
        let channel = AsyncThrowingStream<DefinitionEvent, Error>.makeStream()
        channel.continuation.yield(.started("receipt"))
        channel.continuation.yield(.completed("receipt", definition))
        // Leave the body open: completion must not wait for EOF or a transport timeout.
        await model.generate { (channel.stream, nil) }
        channel.continuation.finish(throwing: URLError(.networkConnectionLost))
        guard case .ready(let result, let id) = model.state else { Issue.record("Completion was not retained"); return }
        #expect(result == definition)
        #expect(id == "receipt")
    }
    @Test func recoveryKeepsVisibleDefinitionUntilReplacementIsComplete() async throws {
        let model = DefinitionModel(embedded: nil)
        var events: [DefinitionEvent] = [
            .started("first"), .delta("first", "{{bank||bank||old"),
            .started("second"), .delta("second", "{{bank||bank||new")
        ]
        let stream = AsyncThrowingStream<DefinitionEvent, Error>(unfolding: { @MainActor in
            if events.count <= 2 {
                guard case .generating(let preview) = model.state else { Issue.record("Preview disappeared during recovery"); return nil }
                #expect(preview.definition == "old")
            }
            return events.isEmpty ? .completed("second", self.definition) : events.removeFirst()
        })
        await model.generate { (stream, nil) }
        guard case .ready(_, let id) = model.state else { Issue.record("Missing recovered definition"); return }
        #expect(id == "second")
    }
    @Test func generationStreamsAllSectionsAndRetainsThemAfterFailure() async throws {
        let model = DefinitionModel(embedded: nil)
        let channel = AsyncThrowingStream<DefinitionEvent, Error>.makeStream()
        channel.continuation.yield(.started("first"))
        channel.continuation.yield(.delta("first", "{{bank||bank||河岸||源自古英语||bench}"))
        channel.continuation.finish(throwing: URLError(.networkConnectionLost))
        await model.generate { (channel.stream, nil) }
        #expect(model.visibleDefinition == Definition(lemma: "bank", definition: "河岸", etymology: "源自古英语", cognates: "bench"))
        #expect(model.isReady == false)
        #expect(model.save { _ in throw URLError(.badURL) } == nil)
    }
    @Test func splitDelimitersNeverAppearInTheDefinition() {
        var previews: [Definition] = []
        let buffer = DefinitionPreviewBuffer { previews.append($0) }
        for chunk in ["{{bank||bank||河岸|", "|源自古英语|", "|bench}", "}"] {
            buffer.append(chunk)
            buffer.flush()
        }
        #expect(previews == [
            Definition(lemma: "bank", definition: "河岸"),
            Definition(lemma: "bank", definition: "河岸", etymology: "源自古英语"),
            Definition(lemma: "bank", definition: "河岸", etymology: "源自古英语", cognates: "bench")
        ])
    }
    @Test(.timeLimit(.minutes(1))) func providerBurstsPublishTogetherEvenWhenNoMoreChunksArrive() async {
        let updates = AsyncStream<Definition>.makeStream()
        let buffer = DefinitionPreviewBuffer { updates.continuation.yield($0) }
        buffer.append("{{bank||bank||河")
        buffer.append("岸")
        buffer.append("，河流两侧")
        buffer.append("的陆地。")
        var iterator = updates.stream.makeAsyncIterator()
        #expect(await iterator.next()?.definition == "河")
        #expect(await iterator.next()?.definition == "河岸，河流两侧的陆地。")
        buffer.cancel()
        updates.continuation.finish()
    }
    @Test func incompleteFormattingAndRubyWaitForTheirClosingDelimiter() {
        #expect(DefinitionPreviewBuffer.preview("{{bank||bank||**n. 河岸") == nil)
        #expect(DefinitionPreviewBuffer.preview("{{bank||bank||**n. 河岸** `bæ")?.definition == "**n. 河岸**")
        #expect(DefinitionPreviewBuffer.preview("{{語||語||意味。<ruby>不憫<rt>ふびん</rt>")?.definition == "意味。")
        #expect(DefinitionPreviewBuffer.preview("{{語||語||意味。<ruby>不憫<rt>ふびん</rt></ruby> 🙂")?.definition == "意味。<ruby>不憫<rt>ふびん</rt></ruby> 🙂")
    }
    @Test(.timeLimit(.minutes(1))) func earlySaveWaitsForValidatedCompletionAndSurvivesDismissal() async throws {
        let model = DefinitionModel(embedded: nil)
        let receipt = try receipt()
        let writes = AsyncStream<String?>.makeStream()
        var count = 0
        var events: [DefinitionEvent] = [.started("request"), .delta("request", "{{bank||bank||preview")]
        let stream = AsyncThrowingStream<DefinitionEvent, Error>(unfolding: { @MainActor in
            if !events.isEmpty { return events.removeFirst() }
            model.requestSave { id in
                count += 1
                #expect(model.visibleDefinition == self.definition)
                writes.continuation.yield(id)
                return receipt
            }
            #expect(model.saveState == .queued)
            #expect(count == 0)
            model.requestSave { _ in Issue.record("Duplicate queued save"); return receipt }
            model.dismiss()
            return .completed("verified-receipt", self.definition)
        })
        let generation = try #require(model.startGeneration { (stream, nil) })
        await generation.value
        #expect(!generation.isCancelled)
        var iterator = writes.stream.makeAsyncIterator()
        #expect(await iterator.next() == .some("verified-receipt"))
        #expect(count == 1)
        writes.continuation.finish()
    }
    @Test func incompleteGenerationNeverCommitsAnEarlySave() async {
        let model = DefinitionModel(embedded: nil)
        var writes = 0
        var events: [DefinitionEvent] = [.started("request"), .delta("request", "{{bank||bank||preview")]
        let stream = AsyncThrowingStream<DefinitionEvent, Error>(unfolding: { @MainActor in
            if !events.isEmpty { return events.removeFirst() }
            model.requestSave { _ in writes += 1; throw URLError(.badURL) }
            #expect(model.saveState == .queued)
            throw URLError(.networkConnectionLost)
        })
        await model.generate { (stream, nil) }
        #expect(writes == 0)
        #expect(model.saveState == .idle)
        #expect(model.visibleDefinition?.definition == "preview")
        #expect(model.saveError != nil)
    }
    @Test func dismissingAnUnsavedLookupCancelsItsGeneration() async throws {
        let model = DefinitionModel(embedded: nil)
        let channel = AsyncThrowingStream<DefinitionEvent, Error>.makeStream()
        var requested = false
        let generation = try #require(model.startGeneration { requested = true; return (channel.stream, nil) })
        model.dismiss()
        await generation.value
        #expect(generation.isCancelled)
        #expect(!requested)
        #expect(model.isReady == false)
        channel.continuation.finish()
    }
    @Test func streamingFeedbackIsPacedAndDoesNotReplayOldText() {
        var feedback = DefinitionStreamFeedback()
        let start = ContinuousClock.now
        feedback.update(characterCount: 3, now: start)
        #expect(feedback.pulse == 1)
        feedback.update(characterCount: 10, now: start + .milliseconds(20))
        #expect(feedback.pulse == 1)
        feedback.update(characterCount: 20, now: start + .milliseconds(160))
        #expect(feedback.pulse == 2)
        feedback.update(characterCount: 20, now: start + .seconds(1))
        feedback.update(characterCount: 5, now: start + .seconds(2))
        #expect(feedback.pulse == 2)
        feedback.update(characterCount: 1000, now: start + .seconds(3))
        #expect(feedback.pulse == 3)
    }
    @Test func streamingFeedbackKeepsUpWithVisibleTyping() {
        var feedback = DefinitionStreamFeedback()
        let start = ContinuousClock.now
        feedback.update(characterCount: 1, now: start)
        feedback.update(characterCount: 2, now: start + .milliseconds(20))
        #expect(feedback.pulse == 1)
        feedback.update(characterCount: 5, now: start + .milliseconds(70))
        #expect(feedback.pulse == 1)
        feedback.update(characterCount: 7, now: start + .milliseconds(120))
        #expect(feedback.pulse == 2)
        feedback.update(characterCount: 9, now: start + .milliseconds(140))
        #expect(feedback.pulse == 2)
        feedback.update(characterCount: 12, now: start + .milliseconds(240))
        #expect(feedback.pulse == 3)
        feedback.update(characterCount: 9, now: start + .seconds(2))
        #expect(feedback.pulse == 3)
    }
    @Test func suppressedTextIsNotReplayedWhenFeedbackIsEnabled() {
        var feedback = DefinitionStreamFeedback()
        let start = ContinuousClock.now
        feedback.update(characterCount: 20, enabled: false, now: start)
        feedback.update(characterCount: 20, now: start + .seconds(1))
        #expect(feedback.pulse == 0)
        feedback.update(characterCount: 21, now: start + .seconds(2))
        #expect(feedback.pulse == 1)
        feedback.update(characterCount: 100, enabled: false, now: start + .seconds(3))
        feedback.update(characterCount: 100, now: start + .seconds(4))
        #expect(feedback.pulse == 1)
    }
    @Test func recoveredCompletionReplacesPreviewAndUsesItsReceipt() async throws {
        let model = DefinitionModel(embedded: nil)
        let channel = AsyncThrowingStream<DefinitionEvent, Error>.makeStream()
        channel.continuation.yield(.started("first"))
        channel.continuation.yield(.delta("first", "{{bank||bank||old"))
        channel.continuation.yield(.started("second"))
        channel.continuation.yield(.delta("second", "{{bank||bank||new"))
        channel.continuation.yield(.completed("second", definition))
        await model.generate { (channel.stream, nil) }
        channel.continuation.finish()
        guard case .ready(let result, let id) = model.state else { Issue.record("Missing recovered definition"); return }
        #expect(result == definition)
        #expect(id == "second")
    }
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
