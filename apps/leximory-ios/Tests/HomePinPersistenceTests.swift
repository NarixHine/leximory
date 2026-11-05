import Foundation
import LeximoryCore
import Testing
@testable import Leximory

@MainActor struct HomePinPersistenceTests {
    private let first = URL(string: "https://first.test")!
    private let second = URL(string: "https://second.test")!
    private func pin(_ title: String = "Guest reading") -> BrowserHomePin {
        BrowserHomePin(id: UUID(), title: title, destination: .webpage(URL(string: "https://example.com/")!))
    }
    private func defaults() throws -> (UserDefaults, String) {
        let name = "pin-persistence-test." + UUID().uuidString
        return (try #require(UserDefaults(suiteName: name)), name)
    }
    @Test func ownershipSurvivesAnInterruptedHandoffAndNeverTransfersToAnotherAccount() throws {
        let (defaults, name) = try defaults(); defer { defaults.removePersistentDomain(forName: name) }
        let store = HomePinPersistence(origin: first, defaults: defaults)
        let guest = store.guestPins(namespace: "local-guest"), original = pin()
        #expect(store.saveGuestPins([original], namespace: "local-guest", generation: guest.generation))
        #expect(store.claimGuestPins(account: "A") == [original])
        let reopened = HomePinPersistence(origin: first, defaults: defaults)
        #expect(reopened.guestPins(namespace: "local-guest").pins.isEmpty)
        #expect(reopened.claimGuestPins(account: "B").isEmpty)
        #expect(reopened.claimGuestPins(account: "A") == [original])
        reopened.completeGuestClaim(account: "A")
        #expect(reopened.claimGuestPins(account: "A").isEmpty)
    }
    @Test func lateGuestCallbacksCannotRestoreClaimedPinsButANewGuestSessionCanCreatePins() throws {
        let (defaults, name) = try defaults(); defer { defaults.removePersistentDomain(forName: name) }
        let store = HomePinPersistence(origin: first, defaults: defaults)
        let old = store.guestPins(namespace: "local-guest"), original = pin()
        store.saveGuestPins([original], namespace: "local-guest", generation: old.generation)
        _ = store.claimGuestPins(account: "A")
        #expect(!store.saveGuestPins([original], namespace: "local-guest", generation: old.generation))
        let new = store.guestPins(namespace: "local-guest")
        let added = pin("New guest session")
        #expect(store.saveGuestPins([added], namespace: "local-guest", generation: new.generation))
        #expect(store.claimGuestPins(account: "B") == [added])
        #expect(store.claimGuestPins(account: "A") == [original])
    }
    @Test func originsCannotImportEachOthersLegacyGuestOrAccountPins() throws {
        let (defaults, name) = try defaults(); defer { defaults.removePersistentDomain(forName: name) }
        let original = pin()
        defaults.set(try JSONEncoder().encode([original]), forKey: "browser.home-pins.local-guest")
        defaults.set(try JSONEncoder().encode([original]), forKey: "browser.home-pins.A")
        let one = HomePinPersistence(origin: first, defaults: defaults), two = HomePinPersistence(origin: second, defaults: defaults)
        #expect(one.guestPins(namespace: "local-guest").pins == [original])
        #expect(one.accountPins("A") == [original])
        #expect(two.guestPins(namespace: "local-guest").pins.isEmpty)
        #expect(two.accountPins("A").isEmpty)
        #expect(two.claimGuestPins(account: "A").isEmpty)
    }
    @Test func localEbookShortcutsDoNotBecomeBrokenCloudResources() throws {
        let (defaults, name) = try defaults(); defer { defaults.removePersistentDomain(forName: name) }
        let store = HomePinPersistence(origin: first, defaults: defaults)
        let text = try JSONDecoder().decode(CatalogText.self, from: Data(#"{"id":"local-book","libraryId":"local","title":"Local book","topics":[],"format":"ebook"}"#.utf8))
        let local = BrowserHomePin(id: UUID(), title: "Local book", destination: .document(text))
        let guest = store.guestPins(namespace: "local-guest")
        store.saveGuestPins([local, pin()], namespace: "local-guest", generation: guest.generation)
        let claimed = store.claimGuestPins(account: "A")
        #expect(claimed.count == 1)
        #expect(store.guestPins(namespace: "local-guest").pins == [local])
    }
    @Test func completingOrPurgingOneClaimLeavesTheOtherAccountAndGuestDataAlone() throws {
        let (defaults, name) = try defaults(); defer { defaults.removePersistentDomain(forName: name) }
        let store = HomePinPersistence(origin: first, defaults: defaults)
        let guest = store.guestPins(namespace: "local-guest")
        store.saveGuestPins([pin("A")], namespace: "local-guest", generation: guest.generation)
        _ = store.claimGuestPins(account: "A")
        let next = store.guestPins(namespace: "local-guest")
        store.saveGuestPins([pin("B")], namespace: "local-guest", generation: next.generation)
        _ = store.claimGuestPins(account: "B")
        store.completeGuestClaim(account: "A")
        #expect(store.claimGuestPins(account: "A").isEmpty)
        #expect(store.claimGuestPins(account: "B").map(\.title) == ["B"])
    }
}
