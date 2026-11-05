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

struct HomePinConflictTests {
    private func pin(_ id: String = "a", title: String = "Reading", url: String = "https://example.com/", time: String = "2026-11-02T00:00:00.000Z") -> HomePin {
        HomePin(id: id, title: title, destination: .webpage(url: url, bookmarkId: nil), faviconURL: nil, sortOrder: 0, revision: id + "-original", updatedAt: time)
    }
    private func committed(_ mutation: HomePinMutation, time: String = "2026-11-02T00:00:03.000Z") -> HomePin {
        var value = mutation.pin; value.updatedAt = time
        if mutation.deleted { value.deletedAt = time }
        return value
    }
    @Test func independentEditsMergeEvenAfterRestart() throws {
        var state = HomePinSyncState()
        let original = pin(); state.receive(original)
        var local = original; local.title = "My name"; state.stage(local)
        state = try JSONDecoder().decode(HomePinSyncState.self, from: JSONEncoder().encode(state))
        var remote = original; remote.faviconURL = "https://example.com/new.png"; remote.revision = "remote-icon"
        state.receive(remote)
        let change = try #require(state.pending[original.id])
        #expect(change.title == "My name")
        #expect(change.faviconURL == remote.faviconURL)
        #expect(change.expectedRevision == remote.revision)
    }
    @Test func changingTheAddressDoesNotOverwriteARemoteRename() throws {
        var state = HomePinSyncState(); let original = pin(); state.receive(original)
        var local = original; local.destination = .webpage(url: "https://another.test/", bookmarkId: nil); state.stage(local)
        var remote = original; remote.title = "Renamed elsewhere"; remote.revision = "remote-name"
        state.receive(remote)
        #expect(state.visible.first?.title == "Renamed elsewhere")
        #expect(state.visible.first?.destination == local.destination)
    }
    @Test func guestAndLegacyImportsKeepExistingAccountNamesAndOrder() {
        var state = HomePinSyncState()
        var local = pin("guest", title: "Guest name"); local.sortOrder = 0
        state.importPins([local])
        var remote = pin("cloud", title: "Account name"); remote.sortOrder = 4
        state.receive(remote)
        #expect(state.visible.map(\.title) == ["Account name"])
        #expect(state.visible.first?.sortOrder == 4)
        #expect(state.pending.isEmpty)
        state.importPins([pin("other", title: "Other", url: "https://other.test/")])
        #expect(state.visible.map(\.title) == ["Account name", "Other"])
        #expect(state.visible.last?.sortOrder == 5)
    }
    @Test func anImportedPinWithTheSameIDKeepsItsExistingCloudNameAndOrder() {
        var state = HomePinSyncState()
        state.importPins([pin("same", title: "Old local name")])
        var cloud = pin("same", title: "Account name"); cloud.sortOrder = 9
        state.receive(cloud)
        #expect(state.visible.map(\.title) == ["Account name"])
        #expect(state.visible.first?.sortOrder == 9)
        #expect(state.pending.isEmpty)
    }
    @Test func queuedNewPinUpdatesAnExistingDestinationWithoutCreatingADuplicate() throws {
        var state = HomePinSyncState(); state.stage(pin("new", title: "My title"))
        state.receive(pin("existing", title: "Existing title"))
        #expect(state.visible.map(\.title) == ["My title"])
        #expect(state.pending["new"] == nil)
        #expect(try #require(state.pending["existing"]).expectedRevision == "existing-original")
    }
    @Test func duplicateCloudPinsAreShownOnceAndEditsAndRemovalReachEveryAlias() throws {
        var state = HomePinSyncState(); state.receive([pin("b"), pin("a")])
        #expect(state.visible.map(\.id) == ["a"])
        var edited = try #require(state.visible.first); edited.title = "Updated"
        state.stage(edited)
        #expect(Set(state.pending.values.map(\.title)) == ["Updated"])
        #expect(state.pending.count == 2)
        state.stage(edited, deleted: true)
        #expect(state.visible.isEmpty)
        #expect(state.pending.values.allSatisfy { $0.deleted })
    }
    @Test func deletingAnAliasSuppressesAnOlderDuplicateButAllowsAnExplicitLaterRepin() throws {
        var state = HomePinSyncState(); state.receive([pin("a"), pin("b")])
        var removed = pin("a", time: "2026-11-02T00:00:02.000Z"); removed.deletedAt = removed.updatedAt
        state.receive(removed)
        #expect(state.visible.isEmpty)
        state.stage(pin("new", title: "Pinned again"))
        let change = try #require(state.pending["new"])
        state.receive(committed(change))
        #expect(state.visible.map(\.title) == ["Pinned again"])
    }
    @Test func lateAcknowledgementCannotResurrectADeletedID() {
        var state = HomePinSyncState(); let original = pin()
        var removed = original; removed.deletedAt = "2026-11-02T00:00:02.000Z"
        state.receive(removed); state.receive(original)
        #expect(state.visible.isEmpty)
        #expect(state.records[original.id]?.deletedAt != nil)
    }
    @Test func unseenRemoteDeletionWinsOverAnOfflineCreationOfTheSameDestination() {
        var state = HomePinSyncState(); state.stage(pin("new"))
        var removed = pin("old"); removed.deletedAt = "2026-11-02T00:00:02.000Z"
        state.receive(removed)
        #expect(state.pending.isEmpty)
        #expect(state.visible.isEmpty)
    }
    @Test func repinningWhileRemovalIsInFlightKeepsTheNewIntent() throws {
        var state = HomePinSyncState(); let original = pin(); state.receive(original)
        state.stage(original, deleted: true)
        let removal = try #require(state.pending[original.id])
        state.stage(pin("new", title: "Pinned again"))
        #expect(state.visible.map(\.title) == ["Pinned again"])
        state.receive(committed(removal, time: "2026-11-02T00:00:02.000Z"))
        let creation = try #require(state.pending["new"])
        state.receive(committed(creation))
        #expect(state.visible.map(\.id) == ["new"])
    }
    @Test func URLIdentityNormalizesHostDefaultPortAndEmptyPathButPreservesAnchorsAndQueries() {
        let first = HomePinDestination.webpage(url: "HTTPS://EXAMPLE.COM:443", bookmarkId: nil)
        let second = HomePinDestination.webpage(url: "https://example.com/", bookmarkId: "saved")
        #expect(first.identity == second.identity)
        #expect(first.identity != HomePinDestination.webpage(url: "https://example.com/#part", bookmarkId: nil).identity)
        #expect(first.identity != HomePinDestination.webpage(url: "https://example.com/?q=1", bookmarkId: nil).identity)
    }
    @Test func olderPersistedSyncStatesRemainReadable() throws {
        var state = HomePinSyncState(); state.receive(pin()); state.stage(pin(title: "Edited"))
        var object = try #require(JSONSerialization.jsonObject(with: JSONEncoder().encode(state)) as? [String: Any])
        for key in ["bases", "imports", "observedDeletions"] { object.removeValue(forKey: key) }
        let restored = try JSONDecoder().decode(HomePinSyncState.self, from: JSONSerialization.data(withJSONObject: object))
        #expect(restored.visible.map(\.title) == ["Edited"])
    }
}
