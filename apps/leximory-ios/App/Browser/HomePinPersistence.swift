import Foundation
import LeximoryCore

extension BrowserHomePin {
    var destinationIdentity: String {
        switch destination {
        case .webpage(let url, _): HomePinDestination.webpage(url: url.absoluteString, bookmarkId: nil).identity
        case .document(let text): HomePinDestination.document(text: text).identity
        }
    }
}

@MainActor final class HomePinPersistence {
    private struct GuestState: Codable {
        var generation = UUID()
        var pins: [BrowserHomePin] = []
        var claims: [String: [BrowserHomePin]] = [:]
    }
    let origin: String
    private let defaults: UserDefaults
    init(origin: URL, defaults: UserDefaults = .standard) {
        self.origin = origin.absoluteString; self.defaults = defaults
    }
    private func pinKey(_ namespace: String) -> String { "browser.home-pins." + origin + "." + namespace }
    private func guestKey(_ namespace: String) -> String { "browser.guest-pins." + origin + "." + namespace }
    private func legacyPins(_ namespace: String) -> [BrowserHomePin] {
        let marker = "browser.home-pins.legacy-origin." + namespace
        if let owner = defaults.string(forKey: marker), owner != origin { return [] }
        defaults.set(origin, forKey: marker)
        return defaults.data(forKey: "browser.home-pins." + namespace)
            .flatMap { try? JSONDecoder().decode([BrowserHomePin].self, from: $0) } ?? []
    }
    private func finishLegacyMigration(_ namespace: String) {
        guard defaults.string(forKey: "browser.home-pins.legacy-origin." + namespace) == origin else { return }
        defaults.removeObject(forKey: "browser.home-pins." + namespace)
    }
    func accountPins(_ account: String) -> [BrowserHomePin] {
        if let data = defaults.data(forKey: pinKey(account)), let pins = try? JSONDecoder().decode([BrowserHomePin].self, from: data) { return pins }
        let pins = legacyPins(account)
        if saveAccountPins(pins, account: account) { finishLegacyMigration(account) }
        return pins
    }
    @discardableResult func saveAccountPins(_ pins: [BrowserHomePin], account: String) -> Bool {
        guard let data = try? JSONEncoder().encode(pins) else { return false }
        defaults.set(data, forKey: pinKey(account)); return true
    }
    private func guestState(_ namespace: String) -> GuestState {
        if let data = defaults.data(forKey: guestKey(namespace)), let state = try? JSONDecoder().decode(GuestState.self, from: data) { return state }
        return GuestState(pins: legacyPins(namespace))
    }
    private func save(_ state: GuestState, namespace: String) -> Bool {
        guard let data = try? JSONEncoder().encode(state) else { return false }
        defaults.set(data, forKey: guestKey(namespace)); return true
    }
    func guestPins(namespace: String) -> (pins: [BrowserHomePin], generation: UUID) {
        var state = guestState(namespace)
        var seen: Set<String> = []
        state.pins = state.pins.filter { seen.insert($0.destinationIdentity).inserted }
        if save(state, namespace: namespace) { finishLegacyMigration(namespace) }
        return (state.pins, state.generation)
    }
    @discardableResult func saveGuestPins(_ pins: [BrowserHomePin], namespace: String, generation: UUID) -> Bool {
        var state = guestState(namespace)
        guard state.generation == generation else { return false }
        state.pins = pins
        return save(state, namespace: namespace)
    }
    func claimGuestPins(account: String) -> [BrowserHomePin] {
        var state = guestState("local-guest")
        let previous = state.claims[account] ?? []
        var seen = Set(previous.map(\.destinationIdentity))
        let added = state.pins.filter {
            guard case .webpage = $0.destination else { return false }
            return seen.insert($0.destinationIdentity).inserted
        }
        let pins = previous + added
        state.generation = UUID()
        state.pins = state.pins.filter { if case .document = $0.destination { return true }; return false }
        if !pins.isEmpty { state.claims[account] = pins }
        // Moving ownership and emptying the guest list are one persisted operation.
        guard save(state, namespace: "local-guest") else { return [] }
        finishLegacyMigration("local-guest")
        return pins
    }
    func completeGuestClaim(account: String) {
        var state = guestState("local-guest")
        state.claims.removeValue(forKey: account)
        _ = save(state, namespace: "local-guest")
    }
}
