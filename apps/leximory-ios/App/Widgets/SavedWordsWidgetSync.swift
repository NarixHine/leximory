import Foundation
import LeximoryCore
import WidgetKit

@MainActor enum SavedWordsWidgetSync {
    private static var pending: Task<Void, Never>?
    private static var revision = 0

    static func activate(origin: URL, accountID: String) {
        let store = SavedWordsWidgetStore()
        let previous = store.session
        let session = store.activate(origin: origin, accountID: accountID)
        if previous != session {
            WidgetCenter.shared.reloadTimelines(ofKind: SavedWordsWidgetStore.kind)
        }
    }

    static func clear() {
        revision += 1
        pending?.cancel()
        pending = nil
        SavedWordsWidgetStore().clear()
        WidgetCenter.shared.reloadTimelines(ofKind: SavedWordsWidgetStore.kind)
    }

    static func schedule(client: MobileClient) {
        revision += 1
        pending?.cancel()
        pending = Task {
            do { try await Task.sleep(for: .seconds(1)) } catch { return }
            await refresh(client: client)
        }
    }

    static func refresh(client: MobileClient) async {
        let revision = revision
        let store = SavedWordsWidgetStore()
        guard let session = store.session, session.origin == client.webURL else { return }
        if store.snapshot == nil,
           let cached = await client.localStore?.value(AccountSettings.self, for: "account-settings"),
           cached.userId == session.accountID {
            publish(cached, session: session, store: store)
        }
        do {
            let settings = try await MutationRetry.run { try await client.accountSettings() }
            try Task.checkCancellation()
            guard settings.userId == session.accountID, revision == Self.revision else { return }
            publish(settings, session: session, store: store)
        } catch { }
    }

    private static func publish(_ settings: AccountSettings, session: SavedWordsWidgetStore.Session, store: SavedWordsWidgetStore) {
        let snapshot = SavedWordsSnapshot(activity: settings.activity.map { ($0.date, $0.count) }, endingOn: settings.today)
        if store.publish(snapshot, for: session) {
            WidgetCenter.shared.reloadTimelines(ofKind: SavedWordsWidgetStore.kind)
        }
    }
}
