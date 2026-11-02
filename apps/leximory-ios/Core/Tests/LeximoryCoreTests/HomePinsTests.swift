import Foundation
import Testing
@testable import LeximoryCore

struct HomePinsTests {
    private func pin(_ id: String = UUID().uuidString.lowercased(), title: String = "Reading", order: Int = 0) -> HomePin {
        HomePin(id: id, title: title, destination: .webpage(url: "https://example.com", bookmarkId: nil), faviconURL: nil, sortOrder: order)
    }
    @Test func offlineEditsAndTheirRetryIdentitiesSurviveReopening() throws {
        var state = HomePinSyncState()
        state.stage(pin())
        let restored = try JSONDecoder().decode(HomePinSyncState.self, from: JSONEncoder().encode(state))
        #expect(restored.pending == state.pending)
        #expect(restored.visible.map(\.title) == ["Reading"])
        let body = String(decoding: try JSONEncoder().encode(#require(restored.pending.values.first)), as: UTF8.self)
        #expect(body.contains("\"expectedRevision\":null"))
        #expect(body.contains("\"faviconURL\":null"))
    }
    @Test func lostAcknowledgementClearsOnlyTheCommittedEdit() throws {
        var state = HomePinSyncState()
        var original = pin()
        state.stage(original)
        let first = try #require(state.pending[original.id])
        original.title = "New title"
        state.stage(original)
        state.receive(first.pin)
        #expect(state.visible.map(\.title) == ["New title"])
        #expect(state.pending[original.id]?.expectedRevision == first.revision)
        let newest = try #require(state.pending[original.id])
        state.receive(newest.pin)
        #expect(state.pending.isEmpty)
    }
    @Test func remoteDeletionWinsOverOfflineEditsAndLegacyMigration() {
        var state = HomePinSyncState()
        let original = pin()
        state.stage(original)
        var deleted = original; deleted.deletedAt = "2026-11-02T00:00:00Z"
        state.receive(deleted)
        state.seed([original])
        #expect(state.visible.isEmpty)
        #expect(state.pending.isEmpty)
    }
    @Test func legacyPinsMigrateOnceWithoutDuplicatingCloudDestinations() {
        var state = HomePinSyncState()
        let cloud = pin(title: "Cloud title")
        state.receive(cloud)
        state.seed([pin(title: "Old local title")])
        #expect(state.visible.map(\.title) == ["Cloud title"])
        #expect(state.pending.isEmpty)
        state.seed([pin()])
        #expect(state.pending.isEmpty)
    }
    @Test func pendingRemovalStaysHiddenUntilItsTombstoneIsAcknowledged() throws {
        var state = HomePinSyncState()
        let original = pin()
        state.receive(original)
        state.stage(original, deleted: true)
        #expect(state.visible.isEmpty)
        let change = try #require(state.pending[original.id])
        state.receive(change.pin)
        #expect(state.pending.isEmpty)
        #expect(state.visible.isEmpty)
    }
}
