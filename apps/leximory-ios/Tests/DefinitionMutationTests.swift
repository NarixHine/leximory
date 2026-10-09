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
}
