import Foundation
import Observation
import Auth
import LeximoryCore

struct AppConfiguration: Decodable, Sendable {
    let apiURL: URL
    let supabaseURL: URL
    let anonKey: String
    private var allowedAPIURL: Bool {
        if apiURL.scheme == "https" { return true }
        #if DEBUG
        return apiURL.scheme == "http" && apiURL.host == "localhost" && apiURL.port == 3001
        #else
        return false
        #endif
    }
    static var bundled: AppConfiguration? {
        guard let url = Bundle.main.url(forResource: "Connection", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let config = try? JSONDecoder().decode(Self.self, from: data),
              config.allowedAPIURL, config.supabaseURL.scheme == "https",
              !config.anonKey.isEmpty else { return nil }
        return config
    }
}
actor AccountTokens {
    private let auth: AuthClient
    private var generation = 0
    private var signingIn: Task<Session, Error>?
    private var refresh: Task<String, Error>?
    init(configuration: AppConfiguration) {
        auth = AuthClient(url: configuration.supabaseURL.appending(path: "auth/v1"),
            headers: ["apikey": configuration.anonKey],
            storageKey: "leximory.session.\(configuration.supabaseURL.host ?? "project")",
            localStorage: KeychainLocalStorage(service: "com.leximory.reader.auth"),
            autoRefreshToken: false, emitLocalSessionAsInitialSession: false)
    }
    func token(rejected: String?) async throws -> String {
        let currentGeneration = generation
        let session = try await auth.session
        guard generation == currentGeneration else { throw CancellationError() }
        if rejected == nil || rejected != session.accessToken { return session.accessToken }
        if let refresh { return try await refresh.value }
        let task = Task { try await auth.refreshSession().accessToken }
        refresh = task
        defer { if generation == currentGeneration { refresh = nil } }
        let token = try await task.value
        guard generation == currentGeneration else { throw CancellationError() }
        return token
    }
    func signIn(email: String, password: String) async throws {
        let currentGeneration = generation
        let task = Task { try await auth.signIn(email: email, password: password) }
        signingIn = task
        defer { if generation == currentGeneration { signingIn = nil } }
        _ = try await task.value
        guard generation == currentGeneration else { throw CancellationError() }
    }
    func cachedUserID() -> String? { auth.currentSession?.user.id.uuidString.lowercased() }
    func matches(_ rejected: String) -> Bool { auth.currentSession?.accessToken == rejected }
    func signOut() async {
        generation += 1
        let refreshing = refresh
        refresh = nil
        refreshing?.cancel()
        if let refreshing { _ = await refreshing.result }
        signingIn?.cancel()
        if let signingIn { _ = await signingIn.result }
        signingIn = nil
        try? await auth.signOut(scope: .local)
    }
}

@MainActor @Observable final class AccountSession {
    enum State {
        case restoring, signedOut, expired, signedIn(Account), unavailable(String)
        var accountID: String? { if case .signedIn(let account) = self { return account.userId }; return nil }
    }
    private(set) var state: State = .restoring
    private(set) var generation = 0
    let tokens: AccountTokens
    private let configuration: AppConfiguration
    private(set) var sync: NativeSync?
    @ObservationIgnored private var scopedClient: MobileClient?
    var client: MobileClient { scopedClient ?? onlineClient }
    @ObservationIgnored private lazy var onlineClient = makeClient()
    private func makeClient(store: LocalReadingStore? = nil) -> MobileClient {
        MobileClient(baseURL: configuration.apiURL, token: { [tokens, weak self] rejected in
        let current = await self?.generation
        do { return try await tokens.token(rejected: rejected) }
        catch {
            if Self.requiresSignIn(error), let current { await self?.expire(generation: current) }
            throw error
        }
    }, unauthorized: { [weak self] rejected in
        await self?.expire(rejected: rejected)
    }, localStore: store)
    }
    init(configuration: AppConfiguration) {
        let tokens = AccountTokens(configuration: configuration)
        self.tokens = tokens
        self.configuration = configuration
    }
    func restore() async {
        let current = generation
        do {
            if scopedClient == nil, let id = await tokens.cachedUserID() { try await openStore(accountID: id) }
            if let cached = await client.localStore?.value(Account.self, for: "account"),
               generation == current, !Task.isCancelled {
                state = .signedIn(cached)
            }
            let account = try await client.account()
            guard generation == current, !Task.isCancelled else { return }
            if scopedClient == nil { try await openStore(accountID: account.userId) }
            await client.localStore?.save(account, for: "account")
            state = .signedIn(account)
        } catch {
            guard generation == current, !Task.isCancelled else { return }
            let cause = MobileClient.cause(of: error)
            if Self.requiresSignIn(cause) || (cause as? MobileFailure)?.error.code == "unauthenticated" {
                await clearStore(); state = .signedOut
            } else if !state.isSignedIn { state = .unavailable("暂时无法连接文库，请稍后重试。") }
        }
    }
    func signIn(email: String, password: String) async throws {
        let current = generation
        try await tokens.signIn(email: email, password: password)
        let account = try await onlineClient.account()
        guard generation == current, !Task.isCancelled else { throw CancellationError() }
        try await openStore(accountID: account.userId)
        await client.localStore?.save(account, for: "account")
        state = .signedIn(account)
    }
    func refreshAccount() async {
        let current = generation
        guard state.isSignedIn else { return }
        do {
            let account = try await client.account()
            guard generation == current, state.isSignedIn, !Task.isCancelled else { return }
            state = .signedIn(account)
        } catch { }
    }
    private func openStore(accountID: String) async throws {
        await clearStore()
        let store = try LocalReadingStore(root: LocalReadingStore.applicationRoot(), origin: configuration.apiURL, accountID: accountID.lowercased())
        let scoped = makeClient(store: store)
        scopedClient = scoped
        sync = NativeSync(store: store, client: scoped)
    }
    private func clearStore() async {
        let previous = sync
        sync = nil; scopedClient = nil
        await previous?.stop()
    }
    nonisolated static func requiresSignIn(_ error: any Error) -> Bool {
        guard let authError = error as? AuthError else { return false }
        return [ErrorCode.sessionNotFound, .sessionExpired, .refreshTokenNotFound, .refreshTokenAlreadyUsed, .badJWT, .invalidJWT, .userBanned].contains(authError.errorCode)
    }
    private func expire(generation current: Int) async {
        guard generation == current, state.isSignedIn else { return }
        if let id = state.accountID { UserDefaults.standard.removeObject(forKey: "recent-access.\(id)") }
        generation += 1
        let expiredGeneration = generation
        state = .restoring
        await clearStore()
        await tokens.signOut()
        guard generation == expiredGeneration else { return }
        state = .expired
    }
    private func expire(rejected: String) async {
        let current = generation
        guard await tokens.matches(rejected), generation == current else { return }
        await expire(generation: current)
    }
    func signOut() async {
        if let id = state.accountID { UserDefaults.standard.removeObject(forKey: "recent-access.\(id)") }
        generation += 1
        state = .restoring
        await clearStore()
        await tokens.signOut()
        state = .signedOut
    }
}
